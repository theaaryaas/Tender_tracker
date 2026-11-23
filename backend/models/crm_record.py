from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, func
from datetime import datetime, timezone
from backend.core.db import Base

class CRMRecord(Base):
    __tablename__ = "crm_records"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Bidding engagement details
    entered_date = Column(Date, nullable=False, default=func.current_date, index=True)
    lead_status = Column(String(20), nullable=False, default="Warm", index=True) # 'Warm' | 'Cold'
    company_name = Column(String(255), nullable=False, index=True)
    client_name = Column(String(150), nullable=True)
    client_designation = Column(String(100), nullable=True)
    client_phone = Column(String(50), nullable=True)
    client_email = Column(String(150), nullable=True)
    remarks = Column(Text, nullable=True) # Notes on conversation
    visibility = Column(String(20), nullable=False, default="all", index=True) # 'me' | 'manager' | 'all'
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

