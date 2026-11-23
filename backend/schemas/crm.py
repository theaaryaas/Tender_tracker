from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime

class LinkedTenderInfo(BaseModel):
    id: int
    tender_id: str
    title: str
    portal: str
    closing_date: Optional[str] = None
    estimated_value: Optional[str] = None
    emd_amount: Optional[str] = None
    doc_url: Optional[str] = None
    fit_score: Optional[int] = None

    class Config:
        from_attributes = True

class CRMRecordCreate(BaseModel):
    tender_id: Optional[int] = None
    company_name: str = Field(..., min_length=2, max_length=255)
    entered_date: Optional[date] = None
    lead_status: str = Field(default="Warm") # 'Warm' | 'Cold'
    client_name: Optional[str] = None
    client_designation: Optional[str] = None
    client_phone: Optional[str] = None
    client_email: Optional[str] = None
    remarks: Optional[str] = None
    visibility: str = Field(default="all") # 'me' | 'manager' | 'all'

class CRMRecordUpdate(BaseModel):
    company_name: Optional[str] = None
    lead_status: Optional[str] = None # 'Warm' | 'Cold'
    client_name: Optional[str] = None
    client_designation: Optional[str] = None
    client_phone: Optional[str] = None
    client_email: Optional[str] = None
    remarks: Optional[str] = None
    visibility: Optional[str] = None # 'me' | 'manager' | 'all'

class CRMRecordResponse(BaseModel):
    id: int
    tender_id: Optional[int] = None
    user_id: int
    user_name: Optional[str] = None
    entered_date: date
    lead_status: str
    company_name: str
    client_name: Optional[str] = None
    client_designation: Optional[str] = None
    client_phone: Optional[str] = None
    client_email: Optional[str] = None
    remarks: Optional[str] = None
    visibility: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    tender: Optional[LinkedTenderInfo] = None

    class Config:
        from_attributes = True

class CRMRecordListResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[CRMRecordResponse]

