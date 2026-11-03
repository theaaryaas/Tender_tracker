from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from backend.core.db import get_db
from backend.models.user import User
from backend.schemas.auth import (
    UserSignup,
    UserLogin,
    UserResponse,
    TokenResponse,
)
from backend.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(
    signup_data: UserSignup,
    db: Session = Depends(get_db)
):
    """
    Registers a new user account with unique username and email.
    Verifies that password and confirm_password match.
    Returns access token and user profile.
    """
    user, access_token = AuthService.register_user(db, signup_data)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.post("/login", response_model=TokenResponse)
def login(
    login_data: UserLogin,
    db: Session = Depends(get_db)
):
    """
    Logs in a user using either username OR email and password.
    Returns access token and user profile.
    """
    user, access_token = AuthService.authenticate_user(db, login_data)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(AuthService.get_current_user)
):
    """
    Returns the profile of the currently authenticated user.
    """
    return UserResponse.model_validate(current_user)

