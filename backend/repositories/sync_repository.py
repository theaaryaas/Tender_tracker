from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone
import json
from backend.models.sync_log import SyncLog

class SyncRepository:
    @staticmethod
    def create(db: Session, portal_filter: str = "all") -> SyncLog:
        log = SyncLog(
            status="RUNNING",
            portal_filter=portal_filter,
            started_at=datetime.now(timezone.utc)
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def complete(
        db: Session,
        log_id: int,
        found: int,
        added: int,
        updated: int,
        errors: list,
        duration: float,
        status: str = "COMPLETED"
    ) -> Optional[SyncLog]:
        log = db.query(SyncLog).filter(SyncLog.id == log_id).first()
        if not log:
            return None
        log.status = status
        log.tenders_found = found
        log.tenders_added = added
        log.tenders_updated = updated
        log.error_count = len(errors)
        log.error_details = json.dumps(errors)
        log.duration_seconds = duration
        log.completed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def get_latest(db: Session) -> Optional[SyncLog]:
        return db.query(SyncLog).order_by(SyncLog.id.desc()).first()

    @staticmethod
    def get_history(db: Session, limit: int = 10) -> List[SyncLog]:
        return db.query(SyncLog).order_by(SyncLog.id.desc()).limit(limit).all()

