from fastapi import APIRouter, Depends, Query, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, and_, func
from typing import Optional
from datetime import date, datetime, timezone

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
    LinkedTenderInfo
)

router = APIRouter(prefix="/crm-records", tags=["CRM & Bidding Records"])

def _build_response_item(record: CRMRecord, user: Optional[User], tender: Optional[Tender]) -> CRMRecordResponse:
    tender_info = None
    if tender:
        tender_info = LinkedTenderInfo(
            id=tender.id,
            tender_id=tender.tender_id,
            title=tender.title,
            portal=tender.portal,
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
        company_name=record.company_name,
        client_name=record.client_name,
        client_designation=record.client_designation,
        client_phone=record.client_phone,
        client_email=record.client_email,
        remarks=record.remarks,
        visibility=record.visibility,
        created_at=record.created_at,
        updated_at=record.updated_at,
        tender=tender_info
    )

@router.get("", response_model=CRMRecordListResponse)
def get_crm_records(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    lead_status: Optional[str] = Query(None, description="Filter by Warm or Cold"),
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

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                CRMRecord.company_name.ilike(search_filter),
                CRMRecord.client_name.ilike(search_filter),
                CRMRecord.remarks.ilike(search_filter),
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

    # Update tender claimed status
    tender.is_claimed = True
    tender.assigned_to_id = current_user.id
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

    crm_record = CRMRecord(
        tender_id=payload.tender_id,
        user_id=current_user.id,
        company_name=payload.company_name,
        entered_date=payload.entered_date or date.today(),
        lead_status=payload.lead_status or "Warm",
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
    Updates CRM engagement details (Warm/Cold toggle, remarks, contact info, visibility).
    Logs previous vs new values to audit trail.
    """
    record = db.query(CRMRecord).filter(CRMRecord.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="CRM Record not found")

    # Access check: Super Admin can edit all; Manager can edit team; Executive can edit own
    if current_user.role != "super_admin" and record.user_id != current_user.id:
        if current_user.role != "manager":
            raise HTTPException(status_code=403, detail="You do not have permission to edit this record")

    # Snapshot old values for audit
    old_values = {
        "lead_status": record.lead_status,
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
        if value is not None and getattr(record, key) != value:
            new_values[key] = value
            setattr(record, key, value)

    if new_values:
        db.commit()
        db.refresh(record)

        client_ip = request.client.host if request.client else None
        AuditService.log(
            db=db,
            user=current_user,
            action="UPDATE",
            entity_type="crm_record",
            entity_id=str(record.id),
            old_values=old_values,
            new_values=new_values,
            ip_address=client_ip
        )

    owner = db.query(User).filter(User.id == record.user_id).first()
    tender = db.query(Tender).filter(Tender.id == record.tender_id).first() if record.tender_id else None
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

    # Enforce granular delete permission
    user_perms = current_user.permissions or []
    if current_user.role != "super_admin" and "can_delete_tenders" not in user_perms:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete records. Contact your manager or administrator."
        )

    if current_user.role != "super_admin" and record.user_id != current_user.id:
        if current_user.role != "manager":
            raise HTTPException(status_code=403, detail="Permission denied")

    tender_id = record.tender_id
    old_info = {
        "id": record.id,
        "company_name": record.company_name,
        "tender_id": tender_id,
        "deleted_by": current_user.username
    }

    linked_tender = None
    if tender_id:
        # Check if any other CRM record is linked to this tender
        other_records_exist = db.query(CRMRecord).filter(
            CRMRecord.tender_id == tender_id,
            CRMRecord.id != record.id
        ).first() is not None

        if not other_records_exist:
            linked_tender = db.query(Tender).filter(Tender.id == tender_id).first()
            if linked_tender:
                linked_tender.is_claimed = False
                linked_tender.assigned_to_id = None
                linked_tender.assigned_to = None
                linked_tender.claimed_at = None
                if linked_tender.status == "Under Review":
                    linked_tender.status = "New"

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

    if linked_tender:
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

