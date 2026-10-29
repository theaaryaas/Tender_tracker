from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc
from typing import Optional, List, Tuple
from datetime import datetime, timezone
from backend.models.tender import Tender
from backend.schemas.tender import TenderCreate, TenderUpdate

class TenderRepository:
    @staticmethod
    def get_all(
        db: Session,
        skip: int = 0,
        limit: int = 50,
        search: Optional[str] = None,
        portal: Optional[str] = None,
        status: Optional[str] = None,
        eligibility: Optional[str] = None,
        priority: Optional[str] = None,
        is_starred: Optional[bool] = None,
        sort_by: str = "id",
        sort_desc: bool = True
    ) -> Tuple[List[Tender], int]:
        query = db.query(Tender)

        if search:
            term = f"%{search}%"
            query = query.filter(
                or_(
                    Tender.title.ilike(term),
                    Tender.tender_id.ilike(term),
                    Tender.organisation.ilike(term),
                    Tender.matched_keywords.ilike(term),
                    Tender.user_notes.ilike(term)
                )
            )

        if portal and portal.lower() != "all":
            query = query.filter(Tender.portal.ilike(f"%{portal}%"))

        if status and status.lower() != "all":
            query = query.filter(Tender.status == status)

        if eligibility and eligibility.lower() != "all":
            query = query.filter(Tender.eligibility_assessment.ilike(f"%{eligibility}%"))

        if priority and priority.lower() != "all":
            query = query.filter(Tender.priority == priority)

        if is_starred is not None:
            query = query.filter(Tender.is_starred == is_starred)

        total = query.count()

        # Sorting
        sort_col = getattr(Tender, sort_by, Tender.id)
        if sort_desc:
            query = query.order_by(desc(sort_col))
        else:
            query = query.order_by(asc(sort_col))

        items = query.offset(skip).limit(limit).all()
        return items, total

    @staticmethod
    def get_by_id(db: Session, tender_id: int) -> Optional[Tender]:
        return db.query(Tender).filter(Tender.id == tender_id).first()

    @staticmethod
    def get_by_tender_code(db: Session, code: str) -> Optional[Tender]:
        return db.query(Tender).filter(Tender.tender_id == code).first()

    @staticmethod
    def upsert(db: Session, data: dict) -> Tuple[Tender, bool]:
        """Upsert a tender by tender_id. Returns (tender, is_new)."""
        code = str(data.get("tender_id") or data.get("reference") or "").strip()
        if not code:
            return None, False

        existing = db.query(Tender).filter(Tender.tender_id == code).first()
        if existing:
            # Update fields if new data came in, but preserve user workflow state
            for key, val in data.items():
                if key in ["status", "priority", "user_notes", "assigned_to", "is_starred"]:
                    continue # Preserve user annotations
                if hasattr(existing, key) and val is not None:
                    setattr(existing, key, val)
            existing.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(existing)
            return existing, False
        else:
            new_tender = Tender(**data)
            db.add(new_tender)
            db.commit()
            db.refresh(new_tender)
            return new_tender, True

    @staticmethod
    def update(db: Session, tender_id: int, updates: TenderUpdate) -> Optional[Tender]:
        tender = db.query(Tender).filter(Tender.id == tender_id).first()
        if not tender:
            return None
        
        update_data = updates.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(tender, key, value)
        
        tender.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(tender)
        return tender

    @staticmethod
    def delete(db: Session, tender_id: int) -> bool:
        tender = db.query(Tender).filter(Tender.id == tender_id).first()
        if not tender:
            return False
        db.delete(tender)
        db.commit()
        return True

