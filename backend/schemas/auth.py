from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Optional
from datetime import datetime

class UserSignup(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_.-]+$", description="Alphanumeric username")
    email: EmailStr = Field(..., description="Valid email address")
    password: str = Field(..., min_length=6, max_length=128, description="Password (min 6 chars)")
    confirm_password: str = Field(..., min_length=6, max_length=128, description="Password confirmation")

    @model_validator(mode="after")
    def verify_passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match. Please verify your password.")
        return self

class UserLogin(BaseModel):
    identifier: str = Field(..., min_length=1, description="Username or Email address")
    password: str = Field(..., min_length=1, description="Password")

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

