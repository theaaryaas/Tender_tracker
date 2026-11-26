from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Request, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
import asyncio
import io
from datetime import datetime, timezone
from backend.core.db import get_db, SessionLocal
from backend.core.date_utils import parse_closing_datetime, IST
from backend.models.tender import Tender
from backend.models.user import User
from backend.models.crm_record import CRMRecord
from backend.models.sync_log import SyncLog
from backend.services.auth_service import AuthService
from backend.services.audit_service import AuditService
from backend.schemas.tender import (
    TenderResponse,
    TenderListResponse,
    TenderUpdate,
    TenderBulkImportRequest,
    TenderBulkImportResponse
)
from backend.repositories.tender_repository import TenderRepository
from backend.services.pdf_service import PDFService
from backend.services.eligibility_service import EligibilityService
from backend.services.deep_analysis_service import TenderDeepAnalyzerService
from backend.models.setting import Setting
import json

router = APIRouter(prefix="/tenders", tags=["Tenders"])

@router.post("/batch-parse")
async def batch_parse_tenders(
    limit: int = Query(20, ge=1, le=100),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db)
):
    """
    Finds up to `limit` unparsed tenders (ordered by fit score) and parses their PDFs in the background.
    """
    unparsed = db.query(Tender).filter(
        ((Tender.doc_url.isnot(None)) & (Tender.doc_url != "")) | ((Tender.url.isnot(None)) & (Tender.url != "")),
        (Tender.turnover_required == "Check tender PDF / ATC") | (Tender.turnover_required.like("%₹ ,%")) | (Tender.emd_amount == "Check tender PDF / ATC")
    ).order_by(Tender.fit_score.desc()).limit(limit).all()

    items_to_parse = [
        (t.id, t.doc_url or t.url, t.matched_keywords, t.tender_id, t.title) 
        for t in unparsed
    ]

    async def _worker(items):
        db_worker = SessionLocal()
        try:
            for tid, doc_url, kw, tender_code, title in items:
                try:
                    c = await PDFService.extract_clauses_from_url(
                        doc_url,
                        keyword=kw,
                        tender_id=tender_code,
                        tender_title=title
                    )
                    t_db = db_worker.query(Tender).filter(Tender.id == tid).first()
                    if t_db:
                        for k, v in c.items():
                            if v and hasattr(t_db, k):
                                setattr(t_db, k, v)

                        # Recalculate dynamic fit score with newly parsed clauses
                        prof_setting = db_worker.query(Setting).filter(Setting.key == "company_profile").first()
                        prof = json.loads(prof_setting.value_json) if (prof_setting and prof_setting.value_json) else {}
                        kw_setting = db_worker.query(Setting).filter(Setting.key == "keywords").first()
                        custom_kw = json.loads(kw_setting.value_json).get("keywords", []) if (kw_setting and kw_setting.value_json) else []

                        st, pa, no, sc = EligibilityService.assess(
                            tender_title=t_db.title,
                            organisation=t_db.organisation,
                            keyword=t_db.matched_keywords,
                            profile=prof,
                            scope_summary=t_db.scope_summary,
                            full_text=t_db.extracted_pdf_text,
                            turnover_required=t_db.turnover_required,
                            bidder_turnover=t_db.bidder_turnover,
                            oem_turnover=t_db.oem_turnover,
                            mse_relaxation=t_db.mse_relaxation,
                            startup_relaxation=t_db.startup_relaxation,
                            emd_amount=t_db.emd_amount,
                            estimated_value=t_db.estimated_value,
                            emd_exemption=t_db.emd_exemption,
                            experience_years=t_db.experience_years or "",
                            experience_required=t_db.experience_required or "",
                            custom_keywords=custom_kw
                        )
                        t_db.eligibility_assessment = st
                        t_db.si_partner_route = pa
                        t_db.assessment_notes = no
                        t_db.fit_score = sc

                        db_worker.commit()
                except Exception as ex:
                    print(f"Error parsing tender {tid}: {ex}")
                await asyncio.sleep(0.3)
        finally:
            db_worker.close()

    if items_to_parse and background_tasks:
        background_tasks.add_task(_worker, items_to_parse)

    return {
        "status": "processing",
        "count": len(items_to_parse),
        "message": f"Parsing {len(items_to_parse)} tender documents in background (ordered by fit score)"
    }

@router.post("/import-bulk", response_model=TenderBulkImportResponse)
def import_bulk_tenders(
    req: TenderBulkImportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Bulk import tenders from GeM or external tools (e.g. Chrome Extension).
    Automatically deduplicates by tender_id using TenderRepository.upsert,
    evaluates initial eligibility/fit score, and optionally triggers background PDF extraction.
    """
    if not req.tenders:
        return {
            "status": "success",
            "total_received": 0,
            "tenders_added": 0,
            "tenders_updated": 0,
            "message": "No tenders provided in payload.",
            "tender_ids": []
        }

    # Fetch company profile and keywords for eligibility scoring
    profile_setting = db.query(Setting).filter(Setting.key == "company_profile").first()
    profile = json.loads(profile_setting.value_json) if (profile_setting and profile_setting.value_json) else {}
    kw_setting = db.query(Setting).filter(Setting.key == "keywords").first()
    custom_keywords = json.loads(kw_setting.value_json).get("keywords", []) if (kw_setting and kw_setting.value_json) else []

    added_count = 0
    updated_count = 0
    processed_ids = []
    tenders_for_pdf_parse = []

    for item in req.tenders:
        tender_code = (item.tender_id or item.reference or "").strip()
        if not tender_code:
            continue

        tender_dict = item.model_dump()
        # Clean doc_url if relative
        doc_url = tender_dict.get("doc_url") or ""
        if doc_url.startswith("/"):
            tender_dict["doc_url"] = f"https://bidplus.gem.gov.in{doc_url}"
        elif doc_url and not doc_url.startswith("http"):
            tender_dict["doc_url"] = f"https://bidplus.gem.gov.in/{doc_url}"

        # Clean url if relative
        item_url = tender_dict.get("url") or ""
        if item_url.startswith("/"):
            tender_dict["url"] = f"https://bidplus.gem.gov.in{item_url}"

        # Merge quantity into scope_summary if provided
        scope_parts = []
        if item.quantity:
            scope_parts.append(f"Quantity: {item.quantity}")
        if tender_dict.get("scope_summary"):
            scope_parts.append(tender_dict["scope_summary"])
        if scope_parts:
            tender_dict["scope_summary"] = " • ".join(scope_parts)

        # Calculate initial fit score & eligibility
        status, partner, notes, score = EligibilityService.assess(
            tender_title=item.title,
            organisation=item.organisation or "",
            keyword=item.matched_keywords or item.title,
            profile=profile,
            scope_summary=tender_dict.get("scope_summary") or "",
            turnover_required=item.turnover_required or "Check tender PDF / ATC",
            emd_amount=item.emd_amount or "Check tender PDF / ATC",
            estimated_value=item.estimated_value or "Check tender PDF / ATC",
            experience_years=getattr(item, "experience_years", "") or "",
            experience_required=getattr(item, "experience_required", "") or "",
            custom_keywords=custom_keywords
        )
        tender_dict["eligibility_assessment"] = status
        tender_dict["si_partner_route"] = partner
        tender_dict["assessment_notes"] = notes
        tender_dict["fit_score"] = score

        # Filter strictly to valid Tender table columns to prevent keyword argument errors
        valid_cols = {c.name for c in Tender.__table__.columns}
        cleaned_data = {k: v for k, v in tender_dict.items() if k in valid_cols}

        tender_obj, is_new = TenderRepository.upsert(db, cleaned_data)
        if tender_obj:
            processed_ids.append(tender_obj.tender_id)
            if is_new:
                added_count += 1
            else:
                updated_count += 1

            if req.auto_parse_pdf and tender_obj.doc_url:
                tenders_for_pdf_parse.append((tender_obj.id, tender_obj.doc_url))

    # Optional background PDF clause extraction
    if req.auto_parse_pdf and tenders_for_pdf_parse and background_tasks:
        async def _parse_worker(items):
            db_worker = SessionLocal()
            try:
                for tid, doc_link in items:
                    try:
                        c = await PDFService.extract_clauses_from_url(doc_link)
                        t_db = db_worker.query(Tender).filter(Tender.id == tid).first()
                        if t_db:
                            for k, v in c.items():
                                if v and hasattr(t_db, k):
                                    setattr(t_db, k, v)
                            db_worker.commit()
                    except Exception as ex:
                        print(f"Error parsing imported tender {tid}: {ex}")
                    await asyncio.sleep(0.3)
            finally:
                db_worker.close()

        background_tasks.add_task(_parse_worker, tenders_for_pdf_parse)

    return {
        "status": "success",
        "total_received": len(req.tenders),
        "tenders_added": added_count,
        "tenders_updated": updated_count,
        "message": f"Successfully processed {len(processed_ids)} tenders: {added_count} added, {updated_count} updated.",
        "tender_ids": processed_ids
    }

@router.post("/purge-past")
def purge_past_tenders(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.get_current_user)
):
    """
    Bulk purges tenders whose closing_date has passed and are NOT in the active bid pipeline.
    Preserves all active pipeline tenders (Reviewing, Bid Ready, Submitted, Won, Lost, Archived),
    starred tenders, and tenders claimed in Bidding CRM.
    By default only super_admin has this authority; managers and executives require explicit permission.
    """
    user_perms = current_user.permissions or []
    if current_user.role != "super_admin" and "can_bulk_delete_expired" not in user_perms:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to bulk delete past tenders. Contact your Super Admin."
        )

    deleted_count = TenderRepository.purge_past_unactioned(db)

    client_ip = request.client.host if request.client else None
    AuditService.log(
        db=db,
        user=current_user,
        action="BULK_DELETE",
        entity_type="tender",
        entity_id="past_tenders",
        new_values={
            "deleted_count": deleted_count,
            "purged_by": current_user.username,
            "filter": "closing_date < now AND not in bid pipeline"
        },
        ip_address=client_ip
    )

    return {
        "status": "success",
        "purged_count": deleted_count,
        "message": f"Successfully purged {deleted_count} past unacted tenders not in the bid pipeline."
    }


@router.post("/cleanup-expired")
def cleanup_expired_tenders(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.get_current_user)
):
    return purge_past_tenders(request=request, db=db, current_user=current_user)

@router.get("/contacts")
@router.get("/contacts/")
def get_tenders_contacts_alias(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = None,
    portal: Optional[str] = None,
    has_email_only: bool = Query(False),
    sort_by: str = Query("tender_count"),
    sort_desc: bool = True,
    db: Session = Depends(get_db)
):
    """Alias for company contacts directory under /tenders/contacts"""
    from backend.services.contact_service import ContactService
    all_contacts = ContactService.get_aggregated_contacts(
        db=db,
        search=search,
        portal=portal,
        has_email_only=has_email_only,
        sort_by=sort_by,
        sort_desc=sort_desc
    )
    total = len(all_contacts)
    skip = (page - 1) * limit
    paged_items = all_contacts[skip : skip + limit]
    pages = (total + limit - 1) // limit if total > 0 else 1

    cleaned_items = []
    for item in paged_items:
        c = dict(item)
        c.pop("latest_dt", None)
        cleaned_items.append(c)

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
        "items": cleaned_items,
        "stats": {
            "total_companies": total,
            "with_emails": sum(1 for c in all_contacts if c["email"]),
            "total_linked_tenders": sum(c["tender_count"] for c in all_contacts)
        }
    }


@router.get("/", response_model=TenderListResponse)
def get_tenders(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=1000),
    search: Optional[str] = None,
    portal: Optional[str] = None,
    status: Optional[str] = None,
    eligibility: Optional[str] = None,
    priority: Optional[str] = None,
    is_starred: Optional[bool] = None,
    sort_by: str = "id",
    sort_desc: bool = True,
    db: Session = Depends(get_db)
):
    skip = (page - 1) * limit
    items, total = TenderRepository.get_all(
        db=db,
        skip=skip,
        limit=limit,
        search=search,
        portal=portal,
        status=status,
        eligibility=eligibility,
        priority=priority,
        is_starred=is_starred,
        sort_by=sort_by,
        sort_desc=sort_desc
    )
    pages = (total + limit - 1) // limit if total > 0 else 1
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
        "items": items
    }

@router.get("/upcoming-deadlines")
def get_upcoming_deadlines(
    limit: int = Query(50, ge=1, le=1000),
    days: Optional[int] = Query(None, description="Filter within next N days"),
    include_expired: bool = Query(False, description="Whether to include expired deadlines"),
    db: Session = Depends(get_db)
):
    all_tenders = db.query(Tender).filter(
        Tender.closing_date.isnot(None),
        Tender.closing_date != ""
    ).all()

    now = datetime.now(IST)
    deadline_items = []
    
    closing_24h_count = 0
    closing_48h_count = 0
    closing_7d_count = 0

    for t in all_tenders:
        dt = parse_closing_datetime(t.closing_date)
        if not dt:
            continue

        diff_seconds = (dt - now).total_seconds()
        is_expired = diff_seconds < 0

        if not include_expired and is_expired:
            continue

        if 0 <= diff_seconds <= 86400:
            closing_24h_count += 1
        if 0 <= diff_seconds <= 172800:
            closing_48h_count += 1
        if 0 <= diff_seconds <= 7 * 86400:
            closing_7d_count += 1

        if days is not None and not is_expired:
            if diff_seconds > (days * 86400):
                continue

        # Format human-readable time remaining
        if is_expired:
            time_left = "Expired"
            urgency = "expired"
        elif diff_seconds < 3600:
            minutes = max(1, int(diff_seconds // 60))
            time_left = f"{minutes}m left"
            urgency = "critical"
        elif diff_seconds < 86400:
            hours = int(diff_seconds // 3600)
            mins = int((diff_seconds % 3600) // 60)
            time_left = f"{hours}h {mins}m left"
            urgency = "critical"
        elif diff_seconds < 172800:
            hours = int((diff_seconds - 86400) // 3600)
            time_left = f"1d {hours}h left"
            urgency = "urgent"
        elif diff_seconds < 7 * 86400:
            d = int(diff_seconds // 86400)
            time_left = f"{d} days left"
            urgency = "upcoming"
        else:
            d = int(diff_seconds // 86400)
            time_left = f"{d} days left"
            urgency = "normal"

        deadline_items.append({
            "tender": TenderResponse.model_validate(t),
            "closing_datetime": dt.isoformat(),
            "time_left": time_left,
            "diff_seconds": diff_seconds,
            "urgency": urgency,
            "is_expired": is_expired,
            "closing_date": t.closing_date,
        })

    # Sort strictly chronologically: nearest deadline FIRST
    deadline_items.sort(key=lambda x: x["diff_seconds"])

    total = len(deadline_items)
    items = deadline_items[:limit]

    return {
        "total": total,
        "items": items,
        "counts": {
            "critical_24h": closing_24h_count,
            "urgent_48h": closing_48h_count,
            "week_7d": closing_7d_count,
            "total_upcoming": total
        }
    }

@router.get("/notifications")
def get_tender_notifications(
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db)
):
    now = datetime.now(IST)
    all_tenders = db.query(Tender).all()

    # 1. Approaching Deadlines (<= 48h)
    deadline_items = []
    for t in all_tenders:
        dt = parse_closing_datetime(t.closing_date)
        if not dt:
            continue
        diff_seconds = (dt - now).total_seconds()
        if 0 <= diff_seconds <= 48 * 3600:
            if diff_seconds < 3600:
                mins = max(1, int(diff_seconds // 60))
                time_left = f"{mins}m left"
                title_text = f"Bid Due in {mins}m"
            elif diff_seconds < 86400:
                h = int(diff_seconds // 3600)
                m = int((diff_seconds % 3600) // 60)
                time_left = f"{h}h {m}m left"
                title_text = f"Bid Due in {h}h {m}m"
            else:
                h = int((diff_seconds - 86400) // 3600)
                time_left = f"1d {h}h left"
                title_text = f"Bid Due in 1d {h}h"

            urgency = "critical" if diff_seconds < 86400 else "urgent"
            tender_dict = TenderResponse.model_validate(t).model_dump()
            deadline_items.append({
                "id": f"deadline_{t.id}",
                "tender_id": t.id,
                "type": "deadline",
                "title": title_text,
                "desc": f"{t.title} • {t.organisation or 'GeM BidPlus'}",
                "badge": time_left,
                "time": t.closing_date or "Closing Soon",
                "urgency": urgency,
                "diff_seconds": diff_seconds,
                "tender": tender_dict
            })

    # Sort deadlines nearest first
    deadline_items.sort(key=lambda x: x["diff_seconds"])

    # 2. Top Direct Fit Opportunities (fit_score >= 85)
    direct_fits = [t for t in all_tenders if (t.fit_score or 0) >= 85]
    direct_fits.sort(key=lambda t: (t.fit_score or 0, t.id), reverse=True)
    fit_items = []
    for t in direct_fits[:12]:
        tender_dict = TenderResponse.model_validate(t).model_dump()
        fit_items.append({
            "id": f"fit_{t.id}",
            "tender_id": t.id,
            "type": "direct_fit",
            "title": f"High Direct Fit ({t.fit_score}% Match)",
            "desc": f"{t.title} • {t.organisation or 'GeM BidPlus'}",
            "badge": f"{t.fit_score}% FIT",
            "time": "AI Synergy Match",
            "urgency": "high",
            "tender": tender_dict
        })

    # 3. Latest Portal Sync Activity
    recent_syncs = db.query(SyncLog).order_by(SyncLog.id.desc()).limit(3).all()
    sync_items = []
    now_utc = datetime.now(timezone.utc)
    for s in recent_syncs:
        t_ref = s.completed_at or s.started_at
        if t_ref:
            if t_ref.tzinfo is None:
                t_ref = t_ref.replace(tzinfo=timezone.utc)
            sec_ago = max(0, (now_utc - t_ref).total_seconds())
            if sec_ago < 60:
                time_ago = "Just now"
            elif sec_ago < 3600:
                time_ago = f"{int(sec_ago // 60)}m ago"
            elif sec_ago < 86400:
                time_ago = f"{int(sec_ago // 3600)}h ago"
            else:
                time_ago = f"{int(sec_ago // 86400)}d ago"
        else:
            time_ago = "Recently"

        status_text = "Sync Finished" if s.status == "COMPLETED" else f"Sync {s.status.title()}"
        if s.status == "COMPLETED":
            desc_text = f"Scanned {s.tenders_found} bids: {s.tenders_added} added, {s.tenders_updated} updated."
        elif s.status == "FAILED":
            desc_text = "Sync encountered an issue. View details in Sync Center."
        else:
            desc_text = f"Sync status: {s.status} ({s.portal_filter or 'All'})"

        sync_items.append({
            "id": f"sync_{s.id}",
            "tender_id": None,
            "type": "sync",
            "title": f"GeM Portal {status_text}",
            "desc": desc_text,
            "badge": s.status,
            "time": time_ago,
            "urgency": "info" if s.status == "COMPLETED" else "warning",
            "tender": None
        })

    # Combined prioritized list: Critical deadlines -> High Direct Fit -> Urgent deadlines -> Sync logs
    critical_deadlines = [d for d in deadline_items if d["urgency"] == "critical"]
    urgent_deadlines = [d for d in deadline_items if d["urgency"] == "urgent"]

    combined = []
    combined.extend(critical_deadlines)
    combined.extend(fit_items[:6])
    combined.extend(urgent_deadlines)
    combined.extend(sync_items)

    return {
        "notifications": combined[:limit],
        "all_deadlines": deadline_items,
        "all_direct_fit": fit_items,
        "all_sync": sync_items,
        "counts": {
            "all": len(combined[:limit]),
            "deadlines": len(deadline_items),
            "direct_fit": len(fit_items),
            "sync": len(sync_items),
        }
    }

@router.post("/analyze-ad-hoc")
async def analyze_tender_ad_hoc(
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    raw_text: Optional[str] = Form(None),
    boq_file: Optional[UploadFile] = File(None),
    tender_id: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    organisation: Optional[str] = Form(None),
):
    """
    On-the-fly deep eligibility analysis for single or multiple uploaded PDFs/Excels or pasted tender text
    without requiring a pre-existing tender in the database.
    """
    text_content = raw_text or ""
    boq_content = ""

    uploaded_files: List[UploadFile] = []
    if files:
        uploaded_files.extend(files)
    if file and file not in uploaded_files:
        uploaded_files.append(file)

    for up_file in uploaded_files:
        content = await up_file.read()
        fname = (up_file.filename or "").lower()
        if fname.endswith(".pdf"):
            pdf_txt = TenderDeepAnalyzerService.extract_text_from_pdf_bytes(content)
            text_content = (text_content + f"\n\n=== FILE: {up_file.filename} ===\n" + pdf_txt) if text_content else pdf_txt
        elif fname.endswith(".xlsx") or fname.endswith(".xls") or fname.endswith(".csv"):
            excel_text = TenderDeepAnalyzerService.extract_text_from_excel_bytes(content, fname)
            boq_content = (boq_content + "\n\n" + excel_text) if boq_content else excel_text
            text_content = (text_content + "\n\n" + excel_text) if text_content else excel_text
        elif fname.endswith(".txt"):
            t_txt = content.decode("utf-8", errors="ignore")
            text_content = (text_content + "\n\n" + t_txt) if text_content else t_txt

    if boq_file:
        bcontent = await boq_file.read()
        bfname = (boq_file.filename or "").lower()
        if bfname.endswith(".xlsx") or bfname.endswith(".xls") or bfname.endswith(".csv"):
            b_text = TenderDeepAnalyzerService.extract_text_from_excel_bytes(bcontent, bfname)
        else:
            b_text = bcontent.decode("utf-8", errors="ignore")
        boq_content = (boq_content + "\n\n" + b_text) if boq_content else b_text
        text_content = (text_content + "\n\n" + b_text) if text_content else b_text

    analysis = TenderDeepAnalyzerService.analyze(
        text=text_content,
        tender_id=tender_id or "",
        title=title or "",
        organisation=organisation or "",
        boq_content=boq_content
    )
    return analysis

@router.get("/{tender_id:path}/deep-analysis")
async def get_tender_deep_analysis(tender_id: str, db: Session = Depends(get_db)):
    import urllib.parse
    code = urllib.parse.unquote(tender_id).strip()

    tender = None
    if code.isdigit():
        tender = TenderRepository.get_by_id(db, int(code))
    if not tender:
        tender = TenderRepository.get_by_tender_code(db, code)
    if not tender and code != tender_id:
        tender = TenderRepository.get_by_tender_code(db, tender_id.strip())
    if not tender and tender_id.isdigit():
        tender = TenderRepository.get_by_id(db, int(tender_id))

    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    if tender.deep_analysis:
        return tender.deep_analysis

    text = tender.extracted_pdf_text or ""
    if not text:
        text = f"Tender {tender.tender_id}: {tender.title}. Organisation: {tender.organisation or 'N/A'}. Value: {tender.estimated_value or 'N/A'}. EMD: {tender.emd_amount or 'N/A'}. {tender.scope_summary or ''}"

    analysis = TenderDeepAnalyzerService.analyze(
        text=text,
        tender_id=tender.tender_id,
        title=tender.title,
        organisation=tender.organisation or ""
    )
    tender.deep_analysis = analysis
    db.commit()
    return analysis

@router.post("/{tender_id:path}/deep-analyze")
async def force_tender_deep_analyze(tender_id: str, db: Session = Depends(get_db)):
    import urllib.parse
    code = urllib.parse.unquote(tender_id).strip()

    tender = None
    if code.isdigit():
        tender = TenderRepository.get_by_id(db, int(code))
    if not tender:
        tender = TenderRepository.get_by_tender_code(db, code)
    if not tender and code != tender_id:
        tender = TenderRepository.get_by_tender_code(db, tender_id.strip())
    if not tender and tender_id.isdigit():
        tender = TenderRepository.get_by_id(db, int(tender_id))

    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    target_url = tender.doc_url or tender.url
    if not tender.extracted_pdf_text and target_url:
        try:
            clauses = await PDFService.extract_clauses_from_url(
                target_url,
                keyword=tender.matched_keywords,
                tender_id=tender.tender_id,
                tender_title=tender.title
            )
            for k, v in clauses.items():
                if v and hasattr(tender, k):
                    setattr(tender, k, v)
        except Exception:
            pass

    text = tender.extracted_pdf_text or ""
    if not text:
        text = f"Tender {tender.tender_id}: {tender.title}. Organisation: {tender.organisation or 'N/A'}. Value: {tender.estimated_value or 'N/A'}. EMD: {tender.emd_amount or 'N/A'}."

    analysis = TenderDeepAnalyzerService.analyze(
        text=text,
        tender_id=tender.tender_id,
        title=tender.title,
        organisation=tender.organisation or ""
    )
    tender.deep_analysis = analysis
    if analysis.get("overall_verdict", {}).get("score"):
        tender.fit_score = analysis["overall_verdict"]["score"]

    db.commit()
    db.refresh(tender)
    return analysis

@router.post("/{tender_id:path}/upload-document")
async def upload_document_and_analyze(
    tender_id: str,
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db)
):
    import urllib.parse
    code = urllib.parse.unquote(tender_id).strip()

    tender = None
    if code.isdigit():
        tender = TenderRepository.get_by_id(db, int(code))
    if not tender:
        tender = TenderRepository.get_by_tender_code(db, code)
    if not tender and code != tender_id:
        tender = TenderRepository.get_by_tender_code(db, tender_id.strip())
    if not tender and tender_id.isdigit():
        tender = TenderRepository.get_by_id(db, int(tender_id))

    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    uploaded_files: List[UploadFile] = []
    if files:
        uploaded_files.extend(files)
    if file and file not in uploaded_files:
        uploaded_files.append(file)

    if not uploaded_files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    accumulated_texts = []
    accumulated_boq = []
    existing_docs = list(tender.documents or [])

    for up_file in uploaded_files:
        content = await up_file.read()
        filename = up_file.filename or "uploaded_document"
        lower_fname = filename.lower()

        text_content = ""
        if lower_fname.endswith(".pdf"):
            text_content = TenderDeepAnalyzerService.extract_text_from_pdf_bytes(content)
        elif lower_fname.endswith(".xlsx") or lower_fname.endswith(".xls") or lower_fname.endswith(".csv"):
            excel_text = TenderDeepAnalyzerService.extract_text_from_excel_bytes(content, filename)
            accumulated_boq.append(excel_text)
            text_content = excel_text
        elif lower_fname.endswith(".txt"):
            text_content = content.decode("utf-8", errors="ignore")
            accumulated_boq.append(text_content)

        if text_content:
            accumulated_texts.append(f"=== DOCUMENT: {filename} ===\n{text_content}")

        is_excel = lower_fname.endswith(".xlsx") or lower_fname.endswith(".xls") or lower_fname.endswith(".csv")
        doc_entry = {
            "name": filename,
            "title": "Uploaded Bill of Quantities (BOQ)" if is_excel else "Uploaded Bid / Specifications File",
            "category": "Uploaded BOQ / Excel" if is_excel else "Uploaded Document",
            "size": f"{round(len(content) / 1024, 1)} KB",
            "url": ""
        }
        if not any(d.get("name") == filename for d in existing_docs):
            existing_docs.append(doc_entry)

    tender.documents = existing_docs
    combined_uploaded = "\n\n".join(accumulated_texts)
    combined_text = ((tender.extracted_pdf_text or "") + "\n\n" + combined_uploaded).strip()
    boq_joined = "\n\n".join(accumulated_boq)

    analysis = TenderDeepAnalyzerService.analyze(
        text=combined_text,
        tender_id=tender.tender_id,
        title=tender.title,
        organisation=tender.organisation or "",
        boq_content=boq_joined or None
    )

    tender.extracted_pdf_text = combined_text
    tender.deep_analysis = analysis
    if analysis.get("overall_verdict", {}).get("score"):
        tender.fit_score = analysis["overall_verdict"]["score"]

    db.commit()
    db.refresh(tender)
    return analysis

@router.post("/{tender_id:path}/parse-pdf", response_model=TenderResponse)
async def parse_tender_pdf(tender_id: str, db: Session = Depends(get_db)):
    import urllib.parse
    code = urllib.parse.unquote(tender_id).strip()

    tender = None
    if code.isdigit():
        tender = TenderRepository.get_by_id(db, int(code))
    if not tender:
        tender = TenderRepository.get_by_tender_code(db, code)
    if not tender and code != tender_id:
        tender = TenderRepository.get_by_tender_code(db, tender_id.strip())
    if not tender and tender_id.isdigit():
        tender = TenderRepository.get_by_id(db, int(tender_id))

    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    target_url = tender.doc_url or tender.url
    if not target_url:
        raise HTTPException(status_code=400, detail="Tender does not have a valid document URL or portal link")

    clauses = await PDFService.extract_clauses_from_url(
        target_url,
        keyword=tender.matched_keywords,
        tender_id=tender.tender_id,
        tender_title=tender.title
    )
    for k, v in clauses.items():
        if v and hasattr(tender, k):
            setattr(tender, k, v)

    # Ensure extracted_pdf_text is populated with structured clauses for RAG and UI
    if not tender.extracted_pdf_text or len(tender.extracted_pdf_text.strip()) < 30:
        clauses_summary = [
            f"Tender Reference: {tender.tender_id}",
            f"Tender Title: {tender.title}",
            f"Organisation / Department: {tender.organisation or 'Central Ministry / Department'}",
            f"Portal: {tender.portal or 'GeM BidPlus'}",
            f"Estimated Contract Value: {tender.estimated_value or 'Not Disclosed on Portal'}",
            f"Earnest Money Deposit (EMD): {tender.emd_amount or 'Verify in ATC clauses'}",
            f"EMD Exemption: {tender.emd_exemption or 'Standard MSME / Startup rules apply'}",
            f"Bidder Turnover Mandate: {tender.bidder_turnover or tender.turnover_required or 'No Minimum Turnover'}",
            f"OEM Turnover Mandate: {tender.oem_turnover or 'N/A'}",
            f"Experience Criteria: {tender.experience_required or 'Past project experience required'}",
            f"MSE Purchase Preference & Relaxation: {tender.mse_relaxation or 'Applicable as per GFR'}",
            f"Startup Exemption: {tender.startup_relaxation or 'DPIIT recognized relaxation'}",
            f"Equipment & BOQ Scope: {tender.scope_summary or tender.title}",
        ]
        tender.extracted_pdf_text = "\n".join(clauses_summary)

    profile_setting = db.query(Setting).filter(Setting.key == "company_profile").first()
    profile = json.loads(profile_setting.value_json) if (profile_setting and profile_setting.value_json) else {}
    kw_setting = db.query(Setting).filter(Setting.key == "keywords").first()
    custom_keywords = json.loads(kw_setting.value_json).get("keywords", []) if (kw_setting and kw_setting.value_json) else []

    status, partner, notes, score = EligibilityService.assess(
        tender_title=tender.title,
        organisation=tender.organisation,
        keyword=tender.matched_keywords,
        profile=profile,
        scope_summary=tender.scope_summary,
        full_text=tender.extracted_pdf_text,
        turnover_required=tender.turnover_required,
        bidder_turnover=tender.bidder_turnover,
        oem_turnover=tender.oem_turnover,
        mse_relaxation=tender.mse_relaxation,
        startup_relaxation=tender.startup_relaxation,
        emd_amount=tender.emd_amount,
        estimated_value=tender.estimated_value,
        emd_exemption=tender.emd_exemption,
        experience_years=tender.experience_years or "",
        experience_required=tender.experience_required or "",
        custom_keywords=custom_keywords
    )
    tender.eligibility_assessment = status
    tender.si_partner_route = partner
    tender.assessment_notes = notes
    tender.fit_score = score

    db.commit()
    db.refresh(tender)
    return tender

@router.get("/{tender_id:path}", response_model=TenderResponse)
def get_tender(tender_id: str, db: Session = Depends(get_db)):
    import urllib.parse
    code = urllib.parse.unquote(tender_id).strip()

    # 1. Primary match by tender_id / reference code (e.g. 2026_BBAU_934932_1)
    tender = TenderRepository.get_by_tender_code(db, code)
    if not tender and code != tender_id:
        tender = TenderRepository.get_by_tender_code(db, tender_id.strip())

    # 2. Secondary match by numeric database primary key ID (e.g. 670)
    if not tender and code.isdigit():
        tender = TenderRepository.get_by_id(db, int(code))
    if not tender and tender_id.isdigit():
        tender = TenderRepository.get_by_id(db, int(tender_id))

    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    return tender

@router.patch("/{tender_id}", response_model=TenderResponse)
def update_tender(tender_id: int, updates: TenderUpdate, db: Session = Depends(get_db)):
    tender = TenderRepository.update(db, tender_id, updates)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    return tender

@router.delete("/{tender_id}")
def delete_tender(
    tender_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.get_current_user)
):
    user_perms = current_user.permissions or []
    if current_user.role != "super_admin" and "can_delete_tenders" not in user_perms:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete tenders. Contact your administrator."
        )

    tender = TenderRepository.get_by_id(db, tender_id)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    tender_ref = tender.tender_id or str(tender_id)
    # Clean up associated CRM records first
    db.query(CRMRecord).filter(CRMRecord.tender_id == tender_id).delete()

    success = TenderRepository.delete(db, tender_id)
    if not success:
        raise HTTPException(status_code=404, detail="Tender not found")

    client_ip = request.client.host if request.client else None
    AuditService.log(
        db=db,
        user=current_user,
        action="DELETE",
        entity_type="tender",
        entity_id=tender_ref,
        old_values={"id": tender_id, "tender_id": tender_ref, "title": tender.title[:60]},
        ip_address=client_ip
    )

    return {"status": "success", "message": f"Tender {tender_ref} deleted"}

@router.post("/recalculate-eligibility")
def recalculate_all_eligibility(db: Session = Depends(get_db)):
    """
    Recalculates eligibility assessment, partner route, notes, and fit_score
    for all tenders using the latest company profile and active frontend keywords.
    """
    profile_setting = db.query(Setting).filter(Setting.key == "company_profile").first()
    profile = json.loads(profile_setting.value_json) if (profile_setting and profile_setting.value_json) else {}
    kw_setting = db.query(Setting).filter(Setting.key == "keywords").first()
    custom_keywords = json.loads(kw_setting.value_json).get("keywords", []) if (kw_setting and kw_setting.value_json) else []

    tenders = db.query(Tender).all()
    updated = 0
    for t in tenders:
        st, pa, no, sc = EligibilityService.assess(
            tender_title=t.title or "",
            organisation=t.organisation or "",
            keyword=t.matched_keywords or "",
            profile=profile,
            scope_summary=t.scope_summary or "",
            full_text=t.extracted_pdf_text or "",
            turnover_required=t.turnover_required or "",
            bidder_turnover=t.bidder_turnover or "",
            oem_turnover=t.oem_turnover or "",
            mse_relaxation=t.mse_relaxation or "",
            startup_relaxation=t.startup_relaxation or "",
            emd_amount=t.emd_amount or "",
            estimated_value=t.estimated_value or "",
            emd_exemption=t.emd_exemption or "",
            experience_years=t.experience_years or "",
            experience_required=t.experience_required or "",
            custom_keywords=custom_keywords
        )
        t.eligibility_assessment = st
        t.si_partner_route = pa
        t.assessment_notes = no
        t.fit_score = sc
        updated += 1

    db.commit()
    return {
        "status": "success",
        "updated_count": updated,
        "message": f"Successfully recalculated eligibility for {updated} tenders with latest company profile & active keywords."
    }


