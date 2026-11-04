from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
import asyncio
from datetime import datetime, timezone
from backend.core.db import get_db, SessionLocal
from backend.core.date_utils import parse_closing_datetime, IST
from backend.models.tender import Tender
from backend.models.sync_log import SyncLog
from backend.schemas.tender import TenderResponse, TenderListResponse, TenderUpdate
from backend.repositories.tender_repository import TenderRepository
from backend.services.pdf_service import PDFService
from backend.services.eligibility_service import EligibilityService
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
        Tender.doc_url.isnot(None),
        Tender.doc_url != "",
        (Tender.turnover_required == "Check tender PDF / ATC") | (Tender.turnover_required.like("%₹ ,%"))
    ).order_by(Tender.fit_score.desc()).limit(limit).all()

    items_to_parse = [(t.id, t.doc_url) for t in unparsed]

    async def _worker(items):
        db_worker = SessionLocal()
        try:
            for tid, doc_url in items:
                try:
                    c = await PDFService.extract_clauses_from_url(doc_url)
                    t_db = db_worker.query(Tender).filter(Tender.id == tid).first()
                    if t_db:
                        for k, v in c.items():
                            if v and hasattr(t_db, k):
                                setattr(t_db, k, v)

                        # Recalculate dynamic fit score with newly parsed clauses
                        prof_setting = db_worker.query(Setting).filter(Setting.key == "company_profile").first()
                        prof = json.loads(prof_setting.value_json) if (prof_setting and prof_setting.value_json) else {}
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
                            estimated_value=t_db.estimated_value
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

@router.get("/{tender_id}", response_model=TenderResponse)
def get_tender(tender_id: int, db: Session = Depends(get_db)):
    tender = TenderRepository.get_by_id(db, tender_id)
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
def delete_tender(tender_id: int, db: Session = Depends(get_db)):
    success = TenderRepository.delete(db, tender_id)
    if not success:
        raise HTTPException(status_code=404, detail="Tender not found")
    return {"status": "success", "message": "Tender deleted"}

@router.post("/{tender_id}/parse-pdf", response_model=TenderResponse)
async def parse_tender_pdf(tender_id: int, db: Session = Depends(get_db)):
    tender = TenderRepository.get_by_id(db, tender_id)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    
    if not tender.doc_url:
        raise HTTPException(status_code=400, detail="Tender does not have a valid document URL")

    clauses = await PDFService.extract_clauses_from_url(tender.doc_url)
    for k, v in clauses.items():
        if v and hasattr(tender, k):
            setattr(tender, k, v)

    # Recalculate dynamic fit score & eligibility with newly extracted PDF clauses
    profile_setting = db.query(Setting).filter(Setting.key == "company_profile").first()
    profile = json.loads(profile_setting.value_json) if (profile_setting and profile_setting.value_json) else {}

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
        estimated_value=tender.estimated_value
    )
    tender.eligibility_assessment = status
    tender.si_partner_route = partner
    tender.assessment_notes = notes
    tender.fit_score = score

    db.commit()
    db.refresh(tender)
    return tender

