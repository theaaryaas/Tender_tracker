from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from datetime import datetime, timezone
from backend.core.db import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    user_name = Column(String(100), nullable=False)
    user_role = Column(String(20), nullable=False, index=True)
    action = Column(String(50), nullable=False, index=True) # 'CREATE', 'UPDATE', 'CLAIM', 'STATUS_CHANGE', 'DELETE', 'ROLE_CHANGE'
    entity_type = Column(String(30), nullable=False, index=True) # 'crm_record', 'tender', 'user', 'settings'
    entity_id = Column(String(50), nullable=False, index=True)
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

