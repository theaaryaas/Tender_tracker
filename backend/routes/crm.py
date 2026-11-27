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
        bidding_status=record.bidding_status or "Reviewing",
        tender_end_date=record.tender_end_date or (tender.closing_date if tender else None),
        company_name=record.company_name,
        client_name=record.client_name,
        client_designation=record.client_designation,
        client_phone=record.client_phone,
        client_email=record.client_email,
        linkedin_url=record.linkedin_url,
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
    lead_status: Optional[str] = Query(None, description="Filter by Hot, Warm or Cold"),
    bidding_status: Optional[str] = Query(None, description="Filter by Reviewing, Bidding, Bidded, Rejected"),
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

    if bidding_status:
        query = query.filter(CRMRecord.bidding_status.ilike(bidding_status))

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
        bidding_status="Reviewing",
        tender_end_date=tender.closing_date,
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
            "bidding_status": crm_record.bidding_status,
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
        bidding_status=payload.bidding_status or "Reviewing",
        tender_end_date=payload.tender_end_date or (tender.closing_date if tender else None),
        client_name=payload.client_name,
        client_designation=payload.client_designation,
        client_phone=payload.client_phone,
        client_email=payload.client_email,
        linkedin_url=payload.linkedin_url,
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

# ==========================================
# BULK IMPORT ENGINE & TEMPLATE EXPORT
# ==========================================

HEADER_SYNONYMS = {
    "company_name": ["client", "clientname", "company", "companyname", "organisation", "organization", "customer"],
    "entered_date": ["date", "dateentered", "entrydate"],
    "lead_status": ["status", "leadstatus", "temperature"],
    "bidding_status": ["biddingstatus", "bidstatus", "stage", "pipelinestage", "biddingstage"],
    "tender_end_date": ["tenderenddate", "enddate", "closingdate", "duedate", "bidduedate", "submissiondate", "lastdate"],
    "client_name": ["name", "contactperson", "person", "contactname"],
    "client_phone": ["number", "phone", "phonenumber", "mobile", "mobilenumber", "contactno", "contactnumber"],
    "remarks": ["remarks", "remark", "notes", "comments", "discussion"],
    "client_designation": ["designation", "designationdept", "role", "department"],
    "client_email": ["email", "emailid", "mail", "mailid"],
    "linkedin_url": ["linkedin", "linkedinurl", "linkedinlink", "profile", "linkedinprofile"],
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

def _parse_bidding_status(val: Any) -> str:
    if not val:
        return "Reviewing"
    s = str(val).strip().lower()
    if "bidded" in s or "submitted" in s:
        return "Bidded"
    elif "bidding" in s or "progress" in s or "preparing" in s:
        return "Bidding"
    elif "reject" in s or "lost" in s or "drop" in s or "disqualif" in s:
        return "Rejected"
    elif "review" in s or "evaluat" in s:
        return "Reviewing"
    return "Reviewing"

def _clean_end_date(val: Any) -> Optional[str]:
    if not val:
        return None
    if isinstance(val, (datetime, date)):
        return val.strftime("%d-%m-%Y")
    val_str = str(val).strip()
    return val_str if val_str and val_str.lower() not in ("none", "null", "nan") else None

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
    the exact CRM import structure, plus 3 sample placeholder rows.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "CRM Leads"

    headers = [
        "Sr No", "Date", "Status", "Bidding Status", "Tender End Date",
        "Client", "Name", "Number", "Remarks", "Designation", "Email ID", "LinkedIn"
    ]
    ws.append(headers)

    # Style header row
    header_fill = openpyxl.styles.PatternFill(start_color="D9EAD3", end_color="D9EAD3", fill_type="solid")
    header_font = openpyxl.styles.Font(bold=True, color="1E182B")
    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font

    sample_rows = [
        [1, "17 Nov", "Warm", "Reviewing", "15-12-2026", "Solarium Green energy (Ahmedabad)", "Chintan Wachani ( Purchase department)", "9023725751", "Customer discussion ongoing regarding tender opportunity.", "Purchase Manager", "chintan@solarium.com", "https://linkedin.com/in/chintan"],
        [2, "18 Nov", "Cold", "Rejected", "30-11-2026", "Governement Hospital Dewas", "Dr Sarojni (CMO Dewas District)", "94251 34278", "Demo conducted with the CMO. She shared contact number and asked to reconnect.", "CMO", "cmo.dewas@mp.gov.in", ""],
        [3, "19 Nov", "Hot", "Bidding", "05-12-2026", "Zeal Life Sciences Pvt Ltd", "Sulabh ji", "87179 09999", "Customer requires video analytics solution for 70+ cameras.", "Director", "sulabh@zeallife.com", "https://linkedin.com/company/zeal-life"]
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
    - Supported headers (case-insensitive): Sr No, Date, Status, Bidding Status, Tender End Date, Client, Name, Number, Remarks, Designation, Email ID, LinkedIn
    - Updates existing records if company already exists, otherwise creates new.
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

    # 2. Parse and Create or Update Records
    created_records: List[CRMRecord] = []
    updated_records: List[CRMRecord] = []
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
        bidding_st = _parse_bidding_status(row_dict.get("bidding_status"))
        end_dt = _clean_end_date(row_dict.get("tender_end_date"))
        c_name = _clean_str(row_dict.get("client_name"))
        c_phone = _clean_phone(row_dict.get("client_phone"))
        c_email = _clean_str(row_dict.get("client_email"))
        c_desig = _clean_str(row_dict.get("client_designation"))
        c_linkedin = _clean_str(row_dict.get("linkedin_url"))
        rem = _clean_str(row_dict.get("remarks"))

        # Smart upsert: check if record with same company exists
        existing_record = db.query(CRMRecord).filter(
            func.lower(CRMRecord.company_name) == company.lower()
        ).first()

        if existing_record:
            if "entered_date" in col_mapping.values() and row_dict.get("entered_date"):
                existing_record.entered_date = entered_dt
            if "lead_status" in col_mapping.values() and row_dict.get("lead_status"):
                existing_record.lead_status = lead_st
            if "bidding_status" in col_mapping.values() and row_dict.get("bidding_status"):
                existing_record.bidding_status = bidding_st
            if end_dt:
                existing_record.tender_end_date = end_dt
            if c_name:
                existing_record.client_name = c_name
            if c_phone:
                existing_record.client_phone = c_phone
            if c_email:
                existing_record.client_email = c_email
            if c_desig:
                existing_record.client_designation = c_desig
            if c_linkedin:
                existing_record.linkedin_url = c_linkedin
            if rem:
                existing_record.remarks = rem
            existing_record.updated_at = datetime.now(timezone.utc)
            updated_records.append(existing_record)
        else:
            record = CRMRecord(
                user_id=current_user.id,
                company_name=company,
                entered_date=entered_dt,
                lead_status=lead_st,
                bidding_status=bidding_st,
                tender_end_date=end_dt,
                client_name=c_name,
                client_phone=c_phone,
                client_email=c_email,
                client_designation=c_desig,
                linkedin_url=c_linkedin,
                remarks=rem,
                visibility="all"
            )
            db.add(record)
            created_records.append(record)

    total_processed = len(created_records) + len(updated_records)
    if total_processed == 0:
        raise HTTPException(
            status_code=400,
            detail="No valid CRM lead records found. Please ensure the 'Client' column is populated."
        )

    db.commit()

    # 3. Register Audit Trail Entry
    client_ip = request.client.host if request.client else None
    sample_names = [r.company_name for r in (created_records + updated_records)[:5]]
    AuditService.log(
        db=db,
        user=current_user,
        action="BULK_IMPORT",
        entity_type="crm_record",
        entity_id=f"bulk_import_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        new_values={
            "filename": filename,
            "total_imported": total_processed,
            "created_count": len(created_records),
            "updated_count": len(updated_records),
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
        "total_imported": total_processed,
        "created_count": len(created_records),
        "updated_count": len(updated_records),
        "skipped_count": skipped_count,
        "visibility": "all",
        "message": f"Successfully processed {total_processed} CRM leads ({len(created_records)} new, {len(updated_records)} updated)."
    }




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
        "bidding_status": record.bidding_status,
        "tender_end_date": record.tender_end_date,
        "company_name": record.company_name,
        "client_name": record.client_name,
        "client_phone": record.client_phone,
        "client_designation": record.client_designation,
        "client_email": record.client_email,
        "linkedin_url": record.linkedin_url,
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
        record.updated_at = datetime.now(timezone.utc)
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


