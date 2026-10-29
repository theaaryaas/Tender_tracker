from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from typing import Optional
from backend.core.db import get_db
from backend.repositories.tender_repository import TenderRepository
from backend.services.export_service import ExportService
from datetime import datetime

router = APIRouter(prefix="/export", tags=["Export"])

@router.get("/excel")
def export_excel(
    search: Optional[str] = None,
    portal: Optional[str] = None,
    status: Optional[str] = None,
    eligibility: Optional[str] = None,
    db: Session = Depends(get_db)
):
    items, _ = TenderRepository.get_all(
        db=db,
        skip=0,
        limit=5000,
        search=search,
        portal=portal,
        status=status,
        eligibility=eligibility
    )
    buffer = ExportService.generate_excel(items)
    filename = f"BitVivid_Tender_Tracker_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    return Response(
        content=buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/csv")
def export_csv(
    search: Optional[str] = None,
    portal: Optional[str] = None,
    status: Optional[str] = None,
    eligibility: Optional[str] = None,
    db: Session = Depends(get_db)
):
    items, _ = TenderRepository.get_all(
        db=db,
        skip=0,
        limit=5000,
        search=search,
        portal=portal,
        status=status,
        eligibility=eligibility
    )
    buffer = ExportService.generate_csv(items)
    filename = f"BitVivid_Tender_Tracker_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

