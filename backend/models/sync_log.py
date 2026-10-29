from sqlalchemy import Column, Integer, String, Text, DateTime, Float
from datetime import datetime, timezone
from backend.core.db import Base

class SyncLog(Base):
    __tablename__ = "sync_logs"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String(50), default="RUNNING") # RUNNING, COMPLETED, FAILED
    portal_filter = Column(String(255), default="all")
    tenders_found = Column(Integer, default=0)
    tenders_added = Column(Integer, default=0)
    tenders_updated = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    error_details = Column(Text, nullable=True) # JSON list of errors
    duration_seconds = Column(Float, default=0.0)
    
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

