from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from backend.models.audit_log import AuditLog
from backend.models.user import User

class AuditService:
    @staticmethod
    def log(
        db: Session,
        user: User,
        action: str,
        entity_type: str,
        entity_id: str,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ) -> AuditLog:
        """
        Records an immutable audit trail entry for any system change.
        """
        entry = AuditLog(
            user_id=user.id if user else None,
            user_name=user.username if user else "System",
            user_role=user.role if user else "system",
            action=action.upper(),
            entity_type=entity_type.lower(),
            entity_id=str(entity_id),
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry

