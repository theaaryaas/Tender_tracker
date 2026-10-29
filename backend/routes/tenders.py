from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
import asyncio
from backend.core.db import get_db, SessionLocal
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
    limit: int = Query(50, ge=1, le=200),
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

