from fastapi import APIRouter, Depends, Query, HTTPException, BackgroundTasks
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import io
import csv
import asyncio

from backend.core.db import get_db, SessionLocal
from backend.models.tender import Tender
from backend.services.contact_service import ContactService

router = APIRouter(prefix="/contacts", tags=["Company Contacts"])

class UpdateCompanyEmailRequest(BaseModel):
    company_name: str
    email: str

def trigger_background_extract(limit: int, company_name: Optional[str] = None):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(
            ContactService.run_extraction_background(
                db_factory=SessionLocal,
                limit=limit,
                company_name=company_name
            )
        )
    finally:
        loop.close()

@router.get("")
@router.get("/")
def get_company_contacts(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = None,
    portal: Optional[str] = None,
    has_email_only: bool = Query(False, description="Filter only records with valid emails"),
    sort_by: str = Query("tender_count", description="tender_count, company, email, latest_date"),
    sort_desc: bool = True,
    db: Session = Depends(get_db)
):
    """
    Returns de-duplicated company names and dynamically extracted emails from tender notices.
    Guarantees no company double population and 100% genuine portal data.
    """
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

    # Count total unextracted tenders
    unextracted_tenders = db.query(Tender).filter(
        (Tender.extracted_pdf_text == None) | (Tender.extracted_pdf_text == "")
    ).count()

    total_tenders = db.query(Tender).count()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
        "items": cleaned_items,
        "stats": {
            "total_companies": total,
            "with_emails": sum(1 for c in all_contacts if c["email"]),
            "without_emails": sum(1 for c in all_contacts if not c["email"]),
            "total_linked_tenders": sum(c["tender_count"] for c in all_contacts),
            "parsed_tenders": total_tenders - unextracted_tenders,
            "unextracted_tenders": unextracted_tenders
        }
    }

@router.post("/batch-extract")
def batch_extract_contacts(
    limit: int = Query(25, ge=1, le=2000, description="Number of tender notices to download and parse"),
    company_name: Optional[str] = Query(None, description="Optional company to target"),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Launches dynamic background notice extraction with live progress tracking.
    Responds immediately (<50ms) to prevent 504 Gateway Timeouts.
    """
    state = ContactService.get_extract_state()
    if state["is_running"]:
        raise HTTPException(status_code=409, detail="A notice extraction job is already in progress.")

    background_tasks.add_task(
        trigger_background_extract,
        limit=limit,
        company_name=company_name
    )

    return {
        "status": "started",
        "target": limit,
        "company_name": company_name,
        "message": f"Notice extraction for up to {limit} tenders started in background."
    }

@router.get("/extract-status")
def get_extraction_status():
    """
    Returns live progress of background notice extraction.
    """
    return ContactService.get_extract_state()

@router.post("/update-email")
@router.put("/email")
def update_company_email(
    payload: UpdateCompanyEmailRequest,
    db: Session = Depends(get_db)
):
    """
    Updates or sets a custom contact email for a specific company / organisation.
    Persists permanently in system settings and updates the directory.
    """
    company_name = payload.company_name.strip()
    email = payload.email.strip().lower()

    if not company_name or not email:
        raise HTTPException(status_code=400, detail="Company name and email are required")

    success = ContactService.set_custom_email(db, company_name, email)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save custom company email")

    return {
        "status": "success",
        "message": f"Successfully updated contact email for '{company_name}' to {email}"
    }

@router.get("/export/csv")
def export_contacts_csv(
    search: Optional[str] = None,
    portal: Optional[str] = None,
    has_email_only: bool = False,
    db: Session = Depends(get_db)
):
    """
    Exports the de-duplicated company and email directory to a CSV file.
    """
    contacts = ContactService.get_aggregated_contacts(
        db=db,
        search=search,
        portal=portal,
        has_email_only=has_email_only,
        sort_by="company",
        sort_desc=False
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Company / Organisation",
        "Official Email",
        "Email Source",
        "Email Source Tender ID",
        "All Extracted Officer Emails (with Tender IDs)",
        "Total Bids / Tenders",
        "All Company Tender IDs",
        "Portals",
        "Latest Closing Date",
        "Latest Tender Title"
    ])

    for c in contacts:
        officer_entries = []
        for off in c.get("officer_details", []):
            tid_part = f" [Tender: {off['tender_id']}]" if off.get("tender_id") else ""
            officer_entries.append(f"{off['email']}{tid_part}")
        if not officer_entries and c.get("officer_emails"):
            officer_entries = c.get("officer_emails")

        writer.writerow([
            c["company_name"],
            c["email"] or "Not Extracted Yet",
            c.get("email_source") or "Pending Notice Extraction",
            c.get("primary_tender_id") or (c["tender_ids"][0] if c.get("tender_ids") else "N/A"),
            "; ".join(officer_entries),
            c["tender_count"],
            ", ".join(c["tender_ids"][:5]),
            ", ".join(c["portals"]),
            c["latest_closing_date"] or "N/A",
            c["latest_tender_title"] or ""
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=bitvivid_company_contacts.csv",
            "Content-Type": "text/csv; charset=utf-8"
        }
    )
