from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional

from backend.core.db import get_db
from backend.models.user import User
from backend.models.audit_log import AuditLog
from backend.services.auth_service import AuthService
from backend.schemas.audit import AuditLogListResponse, AuditLogResponse

router = APIRouter(prefix="/audit-logs", tags=["Audit Trail"])

def verify_audit_access(current_user: User = Depends(AuthService.get_current_user)) -> User:
    if current_user.role == "super_admin":
        return current_user
    if current_user.role == "manager" and "can_view_audit" in (current_user.permissions or []):
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to view the audit trail."
    )

@router.get("", response_model=AuditLogListResponse)
def get_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    user_name: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_audit_access)
):
    """
    Returns paginated audit trail logs.
    Accessible to Super Admin and Managers who have the 'can_view_audit' right.
    """
    query = db.query(AuditLog)

    if action:
        query = query.filter(AuditLog.action == action.upper())
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type.lower())
    if entity_id:
        query = query.filter(AuditLog.entity_id.ilike(f"%{entity_id}%"))
    if user_name:
        query = query.filter(AuditLog.user_name.ilike(f"%{user_name}%"))
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (AuditLog.entity_id.ilike(search_filter)) |
            (AuditLog.user_name.ilike(search_filter)) |
            (AuditLog.action.ilike(search_filter))
        )

    total = query.count()
    offset = (page - 1) * limit
    items = query.order_by(desc(AuditLog.created_at)).offset(offset).limit(limit).all()

    return AuditLogListResponse(
        total=total,
        page=page,
        limit=limit,
        items=[AuditLogResponse.model_validate(item) for item in items]
    )

