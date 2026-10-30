from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class TenderBase(BaseModel):
    tender_id: str
    reference: Optional[str] = None
    portal: str
    site_key: str
    title: str
    organisation: Optional[str] = None
    published_date: Optional[str] = None
    closing_date: Optional[str] = None
    opening_date: Optional[str] = None
    url: Optional[str] = None
    doc_url: Optional[str] = None
    estimated_value: Optional[str] = "Check tender PDF / ATC"
    emd_amount: Optional[str] = "Check tender PDF / ATC"
    emd_exemption: Optional[str] = "Verify MSME / Startup rules"
    epbg_required: Optional[str] = "Check tender PDF / ATC"
    turnover_required: Optional[str] = "Check tender PDF / ATC"
    bidder_turnover: Optional[str] = None
    oem_turnover: Optional[str] = None
    experience_required: Optional[str] = "Check tender PDF / ATC"
    experience_years: Optional[str] = None
    mse_relaxation: Optional[str] = "Check tender PDF / ATC"
    startup_relaxation: Optional[str] = "Check tender PDF / ATC"
    scope_summary: Optional[str] = None
    extracted_pdf_text: Optional[str] = None
    eligibility_assessment: Optional[str] = "Potential direct fit — verify tender clauses"
    si_partner_route: Optional[str] = "Assess SI / OEM partner route"
    matched_keywords: Optional[str] = None
    assessment_notes: Optional[str] = None
    fit_score: Optional[int] = 70
    status: Optional[str] = "New"
    priority: Optional[str] = "Normal"
    user_notes: Optional[str] = ""
    assigned_to: Optional[str] = None
    is_starred: Optional[bool] = False

class TenderCreate(TenderBase):
    pass

class TenderUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    user_notes: Optional[str] = None
    assigned_to: Optional[str] = None
    is_starred: Optional[bool] = None

class TenderResponse(TenderBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TenderListResponse(BaseModel):
    total: int
    page: int
    limit: int
    pages: int
    items: List[TenderResponse]

