from typing import Tuple, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from backend.core.config import settings
from backend.core.db import get_db
from backend.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_access_token,
)
from backend.models.user import User
from backend.repositories.user_repository import UserRepository
from backend.schemas.auth import UserSignup, UserLogin

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False
)

class AuthService:
    @staticmethod
    def register_user(db: Session, signup_data: UserSignup) -> Tuple[User, str]:
        """
        Validates unique username and email, hashes the password, creates the user,
        and generates a JWT bearer token.
        """
        # Check if username already exists (case-insensitive)
        if UserRepository.get_by_username(db, signup_data.username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Username '{signup_data.username}' is already taken."
            )

        # Check if email already exists (case-insensitive)
        if UserRepository.get_by_email(db, signup_data.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{signup_data.email}' is already registered."
            )

        # Hash password and persist user
        hashed_password = get_password_hash(signup_data.password)
        user = UserRepository.create(
            db=db,
            username=signup_data.username,
            email=signup_data.email,
            hashed_password=hashed_password
        )

        # Generate JWT access token
        access_token = create_access_token(
            data={"sub": str(user.id), "username": user.username}
        )
        return user, access_token

    @staticmethod
    def authenticate_user(db: Session, login_data: UserLogin) -> Tuple[User, str]:
        """
        Authenticates a user via either username OR email and password.
        Returns the user model and JWT access token.
        """
        user = UserRepository.get_by_identifier(db, login_data.identifier)
        if not user or not verify_password(login_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username/email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        access_token = create_access_token(
            data={"sub": str(user.id), "username": user.username}
        )
        return user, access_token

    @staticmethod
    def get_current_user(
        db: Session = Depends(get_db),
        token: Optional[str] = Depends(oauth2_scheme)
    ) -> User:
        """
        FastAPI dependency to extract and validate the JWT token from the Authorization header
        and return the authenticated User.
        """
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials or token expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )

        if not token:
            raise credentials_exception

        payload = decode_access_token(token)
        if not payload or "sub" not in payload:
            raise credentials_exception

        user_id_str = payload.get("sub")
        try:
            user_id = int(user_id_str)
        except (TypeError, ValueError):
            raise credentials_exception

        user = UserRepository.get_by_id(db, user_id=user_id)
        if user is None:
            raise credentials_exception

        return user

