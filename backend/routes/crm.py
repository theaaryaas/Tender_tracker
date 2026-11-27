from fastapi import APIRouter, Depends, Query, HTTPException, status, Request, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, and_, func
from typing import Optional, List, Dict, Any
from datetime import date, datetime, timezone
import io
import re
import csv
import openpyxl

from backend.core.db import get_db
from backend.models.user import User
from backend.models.tender import Tender
from backend.models.crm_record import CRMRecord
from backend.services.auth_service import AuthService
from backend.services.audit_service import AuditService
from backend.schemas.crm import (
    CRMRecordCreate,
    CRMRecordUpdate,
    CRMRecordResponse,
    CRMRecordListResponse,
    CRMRecordBulkDeleteRequest,
    LinkedTenderInfo
)

router = APIRouter(prefix="/crm-records", tags=["CRM & Bidding Records"])

APPROVAL_STATUS_MAP = {
    "pending": "Pending",
    "accepted": "Accepted",
    "rejected": "Rejected",
}

PIPELINE_STAGE_MAP = {
    "new": "New",
    "new opportunities": "New",
    "reviewing": "Reviewing",
    "under review": "Reviewing",
    "under bd review": "Reviewing",
    "bid ready": "Bid Ready",
    "bid decided": "Bid Ready",
    "bid decided (go)": "Bid Ready",
    "submitted": "Submitted",
    "bid submitted": "Submitted",
    "won": "Won",
    "awarded": "Won",
    "awarded / won": "Won",
    "rejected": "Rejected",
    "lost": "Lost",
    "archived": "Archived",
    "archived (no-go)": "Archived",
}

def _normalize_approval_status(val: Optional[str], strict: bool = True) -> str:
    if val is None or not str(val).strip():
        return "Pending"
    normalized = APPROVAL_STATUS_MAP.get(str(val).strip().lower())
    if not normalized:
        if strict:
            raise HTTPException(
                status_code=400,
                detail="Invalid approval_status. Must be Pending, Accepted, or Rejected."
            )
        return "Pending"
    return normalized

def _normalize_pipeline_stage(val: Optional[str], strict: bool = True) -> str:
    if val is None or not str(val).strip():
        return "New"
    normalized = PIPELINE_STAGE_MAP.get(str(val).strip().lower())
    if not normalized:
        if strict:
            raise HTTPException(
                status_code=400,
                detail="Invalid pipeline_stage. Must be New, Reviewing, Bid Ready, Submitted, Won, Rejected, Lost, or Archived."
            )
        return "New"
    return normalized

def _effective_pipeline_stage(record: CRMRecord, tender: Optional[Tender]) -> str:
    if tender and tender.status:
        return PIPELINE_STAGE_MAP.get(tender.status.strip().lower(), tender.status)
    if record.pipeline_stage:
        return PIPELINE_STAGE_MAP.get(record.pipeline_stage.strip().lower(), record.pipeline_stage)
    return "New"

def _build_response_item(record: CRMRecord, user: Optional[User], tender: Optional[Tender]) -> CRMRecordResponse:
    tender_info = None
    if tender:
        tender_info = LinkedTenderInfo(
            id=tender.id,
            tender_id=tender.tender_id,
            title=tender.title,
            portal=tender.portal,
            status=tender.status,
            closing_date=tender.closing_date,
            estimated_value=tender.estimated_value,
            emd_amount=tender.emd_amount,
            doc_url=tender.doc_url,
            fit_score=tender.fit_score
        )
    return CRMRecordResponse(
        id=record.id,
        tender_id=record.tender_id,
        user_id=record.user_id,
        user_name=user.username if user else None,
        entered_date=record.entered_date,
        lead_status=record.lead_status,
        approval_status=record.approval_status or "Pending",
        pipeline_stage=_effective_pipeline_stage(record, tender),
        company_name=record.company_name,
        client_name=record.client_name,
        client_designation=record.client_designation,
        client_phone=record.client_phone,
        client_email=record.client_email,
        remarks=record.remarks,
        visibility=record.visibility,
        updated_by_id=record.updated_by_id,
        updated_by_name=record.updated_by_name,
        created_at=record.created_at,
        updated_at=record.updated_at,
        tender=tender_info
    )

@router.get("", response_model=CRMRecordListResponse)
def get_crm_records(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    lead_status: Optional[str] = Query(None, description="Filter by Warm or Cold"),
    approval_status: Optional[str] = Query(None, description="Filter by Pending, Accepted, or Rejected"),
    pipeline_stage: Optional[str] = Query(None, description="Filter by Bid Pipeline stage"),
    my_records: bool = Query(False, description="Filter only records owned by me"),
    search: Optional[str] = Query(None, description="Search company, client, or remarks"),
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.get_current_user)
):
    """
    Returns CRM records strictly filtered by user's role & visibility rules:
    - Super Admin: sees all records (all, manager, me).
    - Manager: sees 'all', 'manager', plus own 'me' records.
    - Executive: sees 'all', plus own 'me' / 'manager' records.
    """
    query = db.query(CRMRecord, User, Tender).outerjoin(User, CRMRecord.user_id == User.id).outerjoin(Tender, CRMRecord.tender_id == Tender.id)

    # Apply Visibility Security Scoping
    if current_user.role == "super_admin":
        pass # Super Admin has omniscient view
    elif current_user.role == "manager":
        query = query.filter(
            or_(
                CRMRecord.visibility.in_(["all", "manager"]),
                CRMRecord.user_id == current_user.id
            )
        )
    else: # executive
        query = query.filter(
            or_(
                CRMRecord.visibility == "all",
                CRMRecord.user_id == current_user.id
            )
        )

    # Optional Filters
    if my_records:
        query = query.filter(CRMRecord.user_id == current_user.id)

    if lead_status:
        query = query.filter(CRMRecord.lead_status.ilike(lead_status))

    if approval_status:
        norm_approval = _normalize_approval_status(approval_status)
        query = query.filter(CRMRecord.approval_status == norm_approval)

    if pipeline_stage:
        norm_stage = _normalize_pipeline_stage(pipeline_stage)
        stage_matches = [norm_stage]
        if norm_stage == "Reviewing":
            stage_matches.append("Under Review")
        query = query.filter(
            or_(
                and_(CRMRecord.tender_id.isnot(None), Tender.status.in_(stage_matches)),
                and_(CRMRecord.tender_id.is_(None), CRMRecord.pipeline_stage.in_(stage_matches)),
            )
        )

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                CRMRecord.company_name.ilike(search_filter),
                CRMRecord.client_name.ilike(search_filter),
                CRMRecord.remarks.ilike(search_filter),
                CRMRecord.updated_by_name.ilike(search_filter),
                Tender.tender_id.ilike(search_filter),
                Tender.title.ilike(search_filter)
            )
        )

    total = query.count()
    offset = (page - 1) * limit
    results = query.order_by(desc(CRMRecord.entered_date), desc(CRMRecord.id)).offset(offset).limit(limit).all()

    items = [_build_response_item(rec, u, t) for rec, u, t in results]

    return CRMRecordListResponse(
        total=total,
        page=page,
        limit=limit,
        items=items
    )

@router.post("/pick/{tender_id}", response_model=CRMRecordResponse, status_code=status.HTTP_201_CREATED)
def pick_tender(
    tender_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.get_current_user)
):
    """
    'Pick Tender' action: Claims a public tender into the user's CRM records.
    - Automatically links tender_id
    - Defaults visibility to 'all'
    - Defaults lead_status to 'Warm'
    - Records 'CLAIM' event in audit trail
    """
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    # Update tender claimed status (preserve explicit owner name if already assigned)
    tender.is_claimed = True
    tender.assigned_to_id = current_user.id
    if not tender.assigned_to:
        tender.assigned_to = current_user.username
    tender.claimed_at = datetime.now(timezone.utc)
    if tender.status == "New":
        tender.status = "Under Review"

    # Create corresponding CRM Record
    crm_record = CRMRecord(
        tender_id=tender.id,
        user_id=current_user.id,
        company_name=tender.organisation or tender.title[:50],
        entered_date=date.today(),
        lead_status="Warm",
        approval_status="Pending",
        pipeline_stage=_normalize_pipeline_stage(tender.status, strict=False),
        visibility="all",
        remarks=f"Picked from portal ({tender.portal}) on {date.today()}."
    )
    db.add(crm_record)
    db.commit()
    db.refresh(crm_record)

    # Log to Audit Trail
    client_ip = request.client.host if request.client else None
    AuditService.log(
        db=db,
        user=current_user,
        action="CLAIM",
        entity_type="tender",
        entity_id=tender.tender_id,
        new_values={
            "claimed_by": current_user.username,
            "crm_record_id": crm_record.id,
            "company_name": crm_record.company_name,
            "visibility": "all"
        },
        ip_address=client_ip
    )

    return _build_response_item(crm_record, current_user, tender)

@router.post("/manual", response_model=CRMRecordResponse, status_code=status.HTTP_201_CREATED)
def create_manual_crm_record(
    payload: CRMRecordCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.get_current_user)
):
    """
    Creates a standalone or manually linked CRM record.
    """
    tender = None
    if payload.tender_id:
        tender = db.query(Tender).filter(Tender.id == payload.tender_id).first()

    approval_status = _normalize_approval_status(payload.approval_status)
    if tender and "pipeline_stage" not in payload.model_fields_set:
        pipeline_stage = _normalize_pipeline_stage(tender.status, strict=False)
    else:
        pipeline_stage = _normalize_pipeline_stage(payload.pipeline_stage)
        if tender:
            tender.status = pipeline_stage

    crm_record = CRMRecord(
        tender_id=payload.tender_id,
        user_id=current_user.id,
        company_name=payload.company_name,
        entered_date=payload.entered_date or date.today(),
        lead_status=payload.lead_status or "Warm",
        approval_status=approval_status,
        pipeline_stage=pipeline_stage,
        client_name=payload.client_name,
        client_designation=payload.client_designation,
        client_phone=payload.client_phone,
        client_email=payload.client_email,
        remarks=payload.remarks,
        visibility=payload.visibility or "all"
    )
    db.add(crm_record)
    db.commit()
    db.refresh(crm_record)

    client_ip = request.client.host if request.client else None
    AuditService.log(
        db=db,
        user=current_user,
        action="CREATE",
        entity_type="crm_record",
        entity_id=str(crm_record.id),
        new_values={
            "company_name": crm_record.company_name,
            "lead_status": crm_record.lead_status,
            "approval_status": crm_record.approval_status,
            "pipeline_stage": crm_record.pipeline_stage,
            "client_name": crm_record.client_name,
            "visibility": crm_record.visibility
        },
        ip_address=client_ip
    )

    return _build_response_item(crm_record, current_user, tender)

@router.patch("/{id}", response_model=CRMRecordResponse)
def update_crm_record(
    id: int,
    payload: CRMRecordUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.get_current_user)
):
    """
    Updates CRM engagement details (Warm/Cold toggle, approval status, pipeline stage, remarks, contact info, visibility).
    Syncs pipeline_stage changes back to any linked tender's status.
    Logs previous vs new values to audit trail.
    """
    record = db.query(CRMRecord).filter(CRMRecord.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="CRM Record not found")

    # Access check: Super Admin can edit all; Manager can edit team; Executive can edit own
    if current_user.role != "super_admin" and record.user_id != current_user.id:
        if current_user.role != "manager":
            raise HTTPException(status_code=403, detail="You do not have permission to edit this record")

    tender = db.query(Tender).filter(Tender.id == record.tender_id).first() if record.tender_id else None

    # Snapshot old values for audit
    old_values = {
        "lead_status": record.lead_status,
        "approval_status": record.approval_status or "Pending",
        "pipeline_stage": _effective_pipeline_stage(record, tender),
        "company_name": record.company_name,
        "client_name": record.client_name,
        "client_phone": record.client_phone,
        "client_designation": record.client_designation,
        "remarks": record.remarks,
        "visibility": record.visibility
    }

    # Apply updates
    update_data = payload.model_dump(exclude_unset=True)
    new_values = {}
    for key, value in update_data.items():
        if value is None:
            continue
        if key == "approval_status":
            normalized_val = _normalize_approval_status(value)
            if (record.approval_status or "Pending") != normalized_val:
                new_values["approval_status"] = normalized_val
                record.approval_status = normalized_val
        elif key == "pipeline_stage":
            normalized_stage = _normalize_pipeline_stage(value)
            current_effective_stage = _effective_pipeline_stage(record, tender)
            if current_effective_stage != normalized_stage or record.pipeline_stage != normalized_stage:
                new_values["pipeline_stage"] = normalized_stage
                record.pipeline_stage = normalized_stage
            if tender and tender.status != normalized_stage:
                tender.status = normalized_stage
        elif getattr(record, key) != value:
            new_values[key] = value
            setattr(record, key, value)

    if new_values:
        record.updated_by_id = current_user.id
        record.updated_by_name = current_user.username
        record.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(record)
        if tender:
            db.refresh(tender)

        client_ip = request.client.host if request.client else None
        AuditService.log(
            db=db,
            user=current_user,
            action="UPDATE",
            entity_type="crm_record",
            entity_id=str(record.id),
            old_values=old_values,
            new_values={**new_values, "updated_by": current_user.username},
            ip_address=client_ip
        )

    owner = db.query(User).filter(User.id == record.user_id).first()
    return _build_response_item(record, owner, tender)

@router.post("/unpick/{tender_id}")
def unpick_tender(
    tender_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.get_current_user)
):
    """
    Unclaims / releases a picked tender and removes the associated CRM record(s).
    Allowed by the assignee, manager, or super admin.
    """
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    if current_user.role != "super_admin" and tender.assigned_to_id != current_user.id:
        if current_user.role != "manager":
            raise HTTPException(status_code=403, detail="Permission denied to unclaim this tender")

    # Delete CRM records linked to this tender
    crm_query = db.query(CRMRecord).filter(CRMRecord.tender_id == tender.id)
    if current_user.role not in ("super_admin", "manager"):
        crm_query = crm_query.filter(CRMRecord.user_id == current_user.id)

    deleted_crm_ids = []
    for crm_rec in crm_query.all():
        deleted_crm_ids.append(crm_rec.id)
        db.delete(crm_rec)

    tender.is_claimed = False
    tender.assigned_to_id = None
    tender.assigned_to = None
    tender.claimed_at = None
    if tender.status == "Under Review":
        tender.status = "New"

    db.commit()

    client_ip = request.client.host if request.client else None
    AuditService.log(
        db=db,
        user=current_user,
        action="RELEASE",
        entity_type="tender",
        entity_id=tender.tender_id,
        new_values={
            "released_by": current_user.username,
            "deleted_crm_ids": deleted_crm_ids,
            "action": "Unpick Tender"
        },
        ip_address=client_ip
    )

    return {"status": "success", "message": f"Tender {tender.tender_id} released and unpicked"}

def _ensure_delete_permission(current_user: User) -> None:
    """Requires Super Admin or explicit 'can_delete_tenders' permission."""
    user_perms = current_user.permissions or []
    if current_user.role != "super_admin" and "can_delete_tenders" not in user_perms:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete records. Contact your manager or administrator."
        )


def _can_delete_record(record: CRMRecord, current_user: User) -> bool:
    """Super Admin and Managers can delete team records; Executives only their own."""
    return current_user.role in ("super_admin", "manager") or record.user_id == current_user.id


def _release_unreferenced_tenders(db: Session, tender_ids: set[int], deleting_ids: set[int]) -> List[Tender]:
    """Unclaims any linked tender that has no remaining CRM records after deletion."""
    released_tenders: List[Tender] = []
    for tid in tender_ids:
        other_records_exist = db.query(CRMRecord).filter(
            CRMRecord.tender_id == tid,
            ~CRMRecord.id.in_(deleting_ids)
        ).first() is not None
        if not other_records_exist:
            linked_tender = db.query(Tender).filter(Tender.id == tid).first()
            if linked_tender:
                linked_tender.is_claimed = False
                linked_tender.assigned_to_id = None
                linked_tender.assigned_to = None
                linked_tender.claimed_at = None
                if linked_tender.status == "Under Review":
                    linked_tender.status = "New"
                released_tenders.append(linked_tender)
    return released_tenders


@router.post("/bulk-delete")
def bulk_delete_crm_records(
    payload: CRMRecordBulkDeleteRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.get_current_user)
):
    """
    Bulk deletes selected CRM records.
    Requires Super Admin or 'can_delete_tenders' permission, plus ownership/manager scope.
    Unclaims any linked tenders that have no remaining CRM records.
    """
    _ensure_delete_permission(current_user)

    unique_ids = list(dict.fromkeys(payload.ids))
    records = db.query(CRMRecord).filter(CRMRecord.id.in_(unique_ids)).all()
    if not records:
        raise HTTPException(status_code=404, detail="No matching CRM records found")

    for rec in records:
        if not _can_delete_record(rec, current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied: you can only delete your own CRM records"
            )

    deleting_ids = {rec.id for rec in records}
    tender_ids = {rec.tender_id for rec in records if rec.tender_id is not None}
    deleted_items = [
        {"id": rec.id, "company_name": rec.company_name, "tender_id": rec.tender_id}
        for rec in records
    ]

    released_tenders = _release_unreferenced_tenders(db, tender_ids, deleting_ids)
    for rec in records:
        db.delete(rec)
    db.commit()

    client_ip = request.client.host if request.client else None
    AuditService.log(
        db=db,
        user=current_user,
        action="BULK_DELETE",
        entity_type="crm_record",
        entity_id=f"bulk_delete_{len(records)}",
        old_values={
            "deleted_count": len(records),
            "deleted_ids": [item["id"] for item in deleted_items],
            "records": deleted_items[:10],
            "deleted_by": current_user.username
        },
        ip_address=client_ip
    )

    for linked_tender in released_tenders:
        AuditService.log(
            db=db,
            user=current_user,
            action="RELEASE",
            entity_type="tender",
            entity_id=linked_tender.tender_id,
            new_values={
                "released_by": current_user.username,
                "reason": "Bulk CRM record deletion"
            },
            ip_address=client_ip
        )

    return {
        "status": "success",
        "deleted_count": len(records),
        "deleted_ids": [item["id"] for item in deleted_items],
        "released_tender_ids": [t.id for t in released_tenders],
        "message": f"Deleted {len(records)} CRM record(s)"
    }


@router.delete("/{id}")
def delete_crm_record(
    id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.get_current_user)
):
    """
    Deletes a CRM record.
    Allowed by creator, manager (if created by team), or super admin.
    Requires 'can_delete_tenders' permission if not super_admin.
    If this was the only CRM record linked to a tender, unclaims the tender
    so it can be picked again.
    """
    record = db.query(CRMRecord).filter(CRMRecord.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="CRM Record not found")

    _ensure_delete_permission(current_user)

    if not _can_delete_record(record, current_user):
        raise HTTPException(status_code=403, detail="Permission denied")

    tender_id = record.tender_id
    old_info = {
        "id": record.id,
        "company_name": record.company_name,
        "tender_id": tender_id,
        "deleted_by": current_user.username
    }

    tender_ids = {tender_id} if tender_id else set()
    released_tenders = _release_unreferenced_tenders(db, tender_ids, {record.id})

    db.delete(record)
    db.commit()

    client_ip = request.client.host if request.client else None
    AuditService.log(
        db=db,
        user=current_user,
        action="DELETE",
        entity_type="crm_record",
        entity_id=str(id),
        old_values=old_info,
        ip_address=client_ip
    )

    for linked_tender in released_tenders:
        AuditService.log(
            db=db,
            user=current_user,
            action="RELEASE",
            entity_type="tender",
            entity_id=linked_tender.tender_id,
            new_values={
                "released_by": current_user.username,
                "reason": f"CRM Record #{id} deleted"
            },
            ip_address=client_ip
        )

    return {"status": "success", "message": "CRM Record deleted and tender released"}


# ==========================================
# BULK IMPORT ENGINE & TEMPLATE EXPORT
# ==========================================

HEADER_SYNONYMS = {
    "company_name": ["client", "clientname", "company", "companyname", "organisation", "organization", "customer"],
    "entered_date": ["date", "dateentered", "entrydate"],
    "lead_status": ["status", "leadstatus"],
    "approval_status": ["acceptedrejected", "approvalstatus", "decision", "accepted", "approval"],
    "pipeline_stage": ["bidpipeline", "pipelinestage", "stage", "pipeline"],
    "client_name": ["name", "contactperson", "person", "contactname"],
    "client_phone": ["number", "phone", "phonenumber", "mobile", "mobilenumber", "contactno", "contactnumber"],
    "remarks": ["remarks", "remark", "notes", "comments", "discussion"],
    "client_designation": ["designation", "designationdept", "role", "department"],
    "client_email": ["email", "emailid", "mail", "mailid"],
}

def _normalize_header(h: Any) -> str:
    if not h:
        return ""
    return re.sub(r"[^a-z0-9]", "", str(h).lower())

def _parse_flexible_date(val: Any) -> date:
    if not val:
        return date.today()
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    val_str = str(val).strip()
    if not val_str or val_str.lower() in ("none", "null", "nan"):
        return date.today()
    
    # Common full date formats
    for fmt in (
        "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y",
        "%d-%b-%Y", "%d %b %Y", "%d-%b-%y", "%d %b %y",
        "%d-%B-%Y", "%d %B %Y", "%b %d, %Y", "%B %d, %Y"
    ):
        try:
            return datetime.strptime(val_str, fmt).date()
        except ValueError:
            pass

    # Formats without year: e.g. "17 Nov", "17-Nov", "Nov 17" -> current year
    current_year = date.today().year
    for fmt in ("%d %b", "%d-%b", "%d %B", "%d-%B", "%b %d", "%B %d", "%d/%m", "%d-%m"):
        try:
            dt = datetime.strptime(val_str, fmt)
            return dt.replace(year=current_year).date()
        except ValueError:
            pass

    return date.today()

def _parse_lead_status(val: Any) -> str:
    if not val:
        return "Warm"
    s = str(val).strip().lower()
    if "hot" in s:
        return "Hot"
    elif "cold" in s:
        return "Cold"
    return "Warm"

def _clean_phone(val: Any) -> Optional[str]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        val_str = str(int(val))
    else:
        val_str = str(val).strip()
    return val_str if val_str and val_str.lower() not in ("none", "null", "nan") else None

def _clean_str(val: Any) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    return s if s and s.lower() not in ("none", "null", "nan") else None


@router.get("/template")
def download_import_template():
    """
    Downloads an Excel (.xlsx) template pre-formatted with headers matching
    the exact CRM import structure, plus 2 sample placeholder rows.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "CRM Leads"

    headers = ["Sr No", "Date", "Status", "Client", "Name", "Number", "Remarks", "Designation", "Email ID"]
    ws.append(headers)

    # Style header row
    header_fill = openpyxl.styles.PatternFill(start_color="D9EAD3", end_color="D9EAD3", fill_type="solid")
    header_font = openpyxl.styles.Font(bold=True, color="1E182B")
    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font

    sample_rows = [
        [1, "17 Nov", "Warm", "Solarium Green energy (Ahmedabad)", "Chintan Wachani ( Purchase department)", "9023725751", "Customer discussion ongoing regarding tender opportunity.", "Purchase Manager", "chintan@solarium.com"],
        [2, "18 Nov", "Cold", "Governement Hospital Dewas", "Dr Sarojni (CMO Dewas District)", "94251 34278", "Demo conducted with the CMO. She shared contact number and asked to reconnect.", "CMO", "cmo.dewas@mp.gov.in"],
        [3, "19 Nov", "Hot", "Zeal Life Sciences Pvt Ltd", "Sulabh ji", "87179 09999", "Customer requires video analytics solution for 70+ cameras.", "Director", "sulabh@zeallife.com"]
    ]
    for row in sample_rows:
        ws.append(row)

    # Adjust column widths
    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = "CRM_Leads_Import_Template.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_crm_records(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.get_current_user)
):
    """
    Bulk import CRM records from Excel (.xlsx, .xls) or CSV file.
    - Supported headers (case-insensitive): Sr No, Date, Status, Client, Name, Number, Remarks, Designation, Email ID
    - Sets visibility to 'all' strictly by default.
    - Records an immutable BULK_IMPORT entry in the audit trail.
    """
    filename = file.filename or "upload"
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    if ext not in ("xlsx", "xls", "csv"):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file."
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    raw_rows: List[List[Any]] = []

    if ext in ("xlsx", "xls"):
        try:
            wb = openpyxl.load_workbook(filename=io.BytesIO(contents), data_only=True)
            ws = wb.active
            for row in ws.iter_rows(values_only=True):
                if any(row):  # skip completely blank rows
                    raw_rows.append(list(row))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse Excel file: {str(e)}")
    else:  # csv
        try:
            text = contents.decode("utf-8")
        except UnicodeDecodeError:
            text = contents.decode("latin-1")
        reader = csv.reader(io.StringIO(text))
        for row in reader:
            if any(cell.strip() for cell in row):
                raw_rows.append(row)

    if not raw_rows:
        raise HTTPException(status_code=400, detail="No data rows found in the uploaded file.")

    # 1. Match Header Row
    header_row = raw_rows[0]
    col_mapping: Dict[int, str] = {}
    for idx, col in enumerate(header_row):
        norm = _normalize_header(col)
        for target_field, synonyms in HEADER_SYNONYMS.items():
            if norm in synonyms:
                col_mapping[idx] = target_field
                break

    if "company_name" not in col_mapping.values():
        raise HTTPException(
            status_code=400,
            detail="Missing required 'Client' or 'Company' column in header row. Please refer to the template."
        )

    # 2. Parse and Create Records
    created_records: List[CRMRecord] = []
    skipped_count = 0

    for row_idx, row in enumerate(raw_rows[1:], start=2):
        row_dict: Dict[str, Any] = {}
        for idx, field in col_mapping.items():
            if idx < len(row):
                row_dict[field] = row[idx]

        company = _clean_str(row_dict.get("company_name"))
        if not company:
            skipped_count += 1
            continue

        entered_dt = _parse_flexible_date(row_dict.get("entered_date"))
        lead_st = _parse_lead_status(row_dict.get("lead_status"))
        approval_st = _normalize_approval_status(row_dict.get("approval_status"), strict=False)
        pipe_stage = _normalize_pipeline_stage(row_dict.get("pipeline_stage"), strict=False)
        c_name = _clean_str(row_dict.get("client_name"))
        c_phone = _clean_phone(row_dict.get("client_phone"))
        c_email = _clean_str(row_dict.get("client_email"))
        c_desig = _clean_str(row_dict.get("client_designation"))
        rem = _clean_str(row_dict.get("remarks"))

        record = CRMRecord(
            user_id=current_user.id,
            company_name=company,
            entered_date=entered_dt,
            lead_status=lead_st,
            approval_status=approval_st,
            pipeline_stage=pipe_stage,
            client_name=c_name,
            client_phone=c_phone,
            client_email=c_email,
            client_designation=c_desig,
            remarks=rem,
            visibility="all"  # Strictly enforced default 'all'
        )
        db.add(record)
        created_records.append(record)

    if not created_records:
        raise HTTPException(
            status_code=400,
            detail="No valid CRM lead records found. Please ensure the 'Client' column is populated."
        )

    db.commit()

    # 3. Register Audit Trail Entry
    client_ip = request.client.host if request.client else None
    sample_names = [r.company_name for r in created_records[:5]]
    AuditService.log(
        db=db,
        user=current_user,
        action="BULK_IMPORT",
        entity_type="crm_record",
        entity_id=f"bulk_import_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        new_values={
            "filename": filename,
            "total_imported": len(created_records),
            "skipped_count": skipped_count,
            "visibility": "all",
            "imported_by": current_user.username,
            "sample_clients": sample_names
        },
        ip_address=client_ip
    )

    return {
        "status": "success",
        "filename": filename,
        "total_imported": len(created_records),
        "skipped_count": skipped_count,
        "visibility": "all",
        "message": f"Successfully imported {len(created_records)} CRM leads with visibility set to 'all'."
    }


