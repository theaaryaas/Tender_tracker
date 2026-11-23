from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime

class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_name: str
    user_role: str
    action: str
    entity_type: str
    entity_id: str
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AuditLogListResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[AuditLogResponse]

