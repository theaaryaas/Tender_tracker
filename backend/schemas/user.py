from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

class UserCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_.-]+$")
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    role: str = Field(default="executive") # 'manager' | 'executive' | 'super_admin'
    permissions: List[str] = Field(default_factory=list)

class UserUpdateRequest(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_.-]+$")
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6, max_length=128)
    role: Optional[str] = None # 'manager' | 'executive' | 'super_admin'
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None

class UserPermissionsUpdateRequest(BaseModel):
    permissions: List[str]

class UserStatusUpdateRequest(BaseModel):
    is_active: bool

class UserDetailResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    permissions: List[str]
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class UserListResponse(BaseModel):
    total: int
    items: List[UserDetailResponse]

