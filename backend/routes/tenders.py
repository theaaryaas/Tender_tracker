from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
import asyncio
from datetime import datetime
from backend.core.db import get_db, SessionLocal
from backend.core.date_utils import parse_closing_datetime, IST
from backend.models.tender import Tender
from backend.schemas.tender import TenderResponse, TenderListResponse, TenderUpdate
from backend.repositories.tender_repository import TenderRepository
from backend.services.pdf_service import PDFService

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

    db.commit()
    db.refresh(tender)
    return tender

