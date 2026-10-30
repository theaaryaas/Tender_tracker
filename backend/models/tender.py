from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float
from datetime import datetime, timezone
from backend.core.db import Base

class Tender(Base):
    __tablename__ = "tenders"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(String(120), unique=True, index=True, nullable=False)
    reference = Column(String(120), nullable=True)
    portal = Column(String(100), index=True, nullable=False)
    site_key = Column(String(50), index=True, nullable=False)
    title = Column(Text, nullable=False)
    organisation = Column(String(255), index=True, nullable=True)
    
    published_date = Column(String(60), nullable=True)
    closing_date = Column(String(60), index=True, nullable=True)
    opening_date = Column(String(60), nullable=True)
    
    url = Column(Text, nullable=True)
    doc_url = Column(Text, nullable=True)
    
    # Financial & Technical Criteria (Extracted or Checked)
    estimated_value = Column(String(100), default="Check tender PDF / ATC")
    emd_amount = Column(String(100), default="Check tender PDF / ATC")
    emd_exemption = Column(String(100), default="Verify MSME / Startup rules")
    epbg_required = Column(String(100), default="Check tender PDF / ATC")
    turnover_required = Column(String(100), default="Check tender PDF / ATC")
    bidder_turnover = Column(String(120), nullable=True)
    oem_turnover = Column(String(120), nullable=True)
    experience_required = Column(Text, default="Check tender PDF / ATC")
    experience_years = Column(String(120), nullable=True)
    mse_relaxation = Column(String(120), default="Check tender PDF / ATC")
    startup_relaxation = Column(String(120), default="Check tender PDF / ATC")
    scope_summary = Column(Text, nullable=True)
    extracted_pdf_text = Column(Text, nullable=True)
    
    # Intelligence & Screening
    eligibility_assessment = Column(String(100), index=True, default="Potential direct fit — verify tender clauses")
    si_partner_route = Column(String(100), default="Assess SI / OEM partner route")
    matched_keywords = Column(String(255), nullable=True)
    assessment_notes = Column(Text, nullable=True)
    fit_score = Column(Integer, default=70) # 0 to 100
    
    # User Workflow & Lifecycle State
    status = Column(String(50), index=True, default="New") # New, Reviewing, Bid Ready, Submitted, Won, Lost, Archived
    priority = Column(String(20), index=True, default="Normal") # High, Normal, Low
    user_notes = Column(Text, default="")
    assigned_to = Column(String(100), nullable=True)
    is_starred = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

