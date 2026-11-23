from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import Optional
from backend.models.user import User

class UserRepository:
    @staticmethod
    def get_by_id(db: Session, user_id: int) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def get_by_username(db: Session, username: str) -> Optional[User]:
        return db.query(User).filter(func.lower(User.username) == username.strip().lower()).first()

    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(func.lower(User.email) == email.strip().lower()).first()

    @staticmethod
    def get_by_identifier(db: Session, identifier: str) -> Optional[User]:
        clean_id = identifier.strip().lower()
        return db.query(User).filter(
            or_(
                func.lower(User.username) == clean_id,
                func.lower(User.email) == clean_id
            )
        ).first()

    @staticmethod
    def create(db: Session, username: str, email: str, hashed_password: str) -> User:
        user = User(
            username=username.strip(),
            email=email.strip().lower(),
            hashed_password=hashed_password
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

