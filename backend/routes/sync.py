from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from typing import List
from backend.core.db import get_db, SessionLocal
from backend.schemas.sync import SyncTriggerRequest, SyncStatusResponse
from backend.services.scraper_service import ScraperService
from backend.repositories.sync_repository import SyncRepository

router = APIRouter(prefix="/sync", tags=["Sync"])

def run_sync_in_background(sites, keywords, gem_pages, extract_pdfs):
    db = SessionLocal()
    try:
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(
            ScraperService.run_sync(
                db=db,
                sites=sites,
                keywords=keywords,
                gem_pages=gem_pages,
                extract_pdfs=extract_pdfs
            )
        )
    finally:
        db.close()

@router.post("/run")
def trigger_sync(
    req: SyncTriggerRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    current = ScraperService.get_sync_state()
    if current["is_running"]:
        raise HTTPException(status_code=409, detail="A sync is already in progress.")

    background_tasks.add_task(
        run_sync_in_background,
        sites=req.sites,
        keywords=req.keywords,
        gem_pages=req.gem_pages or 3,
        extract_pdfs=req.extract_pdfs or False
    )

    return {"status": "started", "message": "Portal sync started in background"}

@router.get("/status")
def get_sync_status(db: Session = Depends(get_db)):
    state = ScraperService.get_sync_state()
    latest_log = SyncRepository.get_latest(db)
    parsed_log = SyncStatusResponse.model_validate(latest_log) if latest_log else None
    return {
        "live": state,
        "latest_completed": parsed_log
    }

@router.get("/history", response_model=List[SyncStatusResponse])
def get_sync_history(limit: int = 10, db: Session = Depends(get_db)):
    logs = SyncRepository.get_history(db, limit=limit)
    return [SyncStatusResponse.model_validate(log) for log in logs]

