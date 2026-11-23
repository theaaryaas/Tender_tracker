from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional

from backend.core.db import get_db
from backend.core.security import get_password_hash
from backend.models.user import User
from backend.services.auth_service import AuthService
from backend.services.audit_service import AuditService
from backend.schemas.user import (
    UserCreateRequest,
    UserPermissionsUpdateRequest,
    UserStatusUpdateRequest,
    UserDetailResponse,
    UserListResponse
)

router = APIRouter(prefix="/users", tags=["User & Rights Management"])

@router.get("", response_model=UserListResponse)
def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.require_manager_or_above)
):
    """
    Lists users based on hierarchy:
    - Super Admin: lists all users across the company.
    - Manager: lists executives created by this manager.
    """
    query = db.query(User)
    if current_user.role == "super_admin":
        pass # All users
    elif current_user.role == "manager":
        query = query.filter((User.created_by_id == current_user.id) | (User.id == current_user.id))

    users = query.order_by(desc(User.created_at)).all()

    # Preload creators for display
    creator_ids = {u.created_by_id for u in users if u.created_by_id}
    creators = {c.id: c.username for c in db.query(User).filter(User.id.in_(creator_ids)).all()} if creator_ids else {}

    items = [
        UserDetailResponse(
            id=u.id,
            username=u.username,
            email=u.email,
            role=u.role,
            permissions=u.permissions or [],
            created_by_id=u.created_by_id,
            created_by_name=creators.get(u.created_by_id),
            is_active=u.is_active,
            created_at=u.created_at
        )
        for u in users
    ]

    return UserListResponse(total=len(items), items=items)

@router.post("", response_model=UserDetailResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.require_manager_or_above)
):
    """
    Creates a new user account:
    - Manager can ONLY create 'executive'.
    - Super Admin can create 'manager' or 'executive'.
    """
    # Enforce role hierarchy
    target_role = payload.role.lower()
    if current_user.role == "manager":
        if target_role != "executive":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Managers can only create Executive users."
            )
    elif current_user.role == "super_admin":
        if target_role not in ("super_admin", "manager", "executive"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role specified."
            )

    # Check unique username and email
    if db.query(User).filter(User.username.ilike(payload.username)).first():
        raise HTTPException(status_code=400, detail=f"Username '{payload.username}' is already taken.")
    if db.query(User).filter(User.email.ilike(payload.email)).first():
        raise HTTPException(status_code=400, detail=f"Email '{payload.email}' is already registered.")

    # Default permissions if not provided
    default_perms = payload.permissions
    if not default_perms:
        if target_role == "executive":
            default_perms = ["can_export"]
        elif target_role == "manager":
            default_perms = ["can_view_audit", "can_export", "can_delete_tenders"]
        elif target_role == "super_admin":
            default_perms = ["can_view_audit", "can_export", "can_delete_tenders", "can_manage_users", "can_manage_scrapers"]

    new_user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=target_role,
        created_by_id=current_user.id,
        permissions=default_perms,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    client_ip = request.client.host if request.client else None
    AuditService.log(
        db=db,
        user=current_user,
        action="ROLE_CHANGE",
        entity_type="user",
        entity_id=str(new_user.id),
        new_values={
            "created_username": new_user.username,
            "role": new_user.role,
            "permissions": new_user.permissions,
            "created_by": current_user.username
        },
        ip_address=client_ip
    )

    return UserDetailResponse(
        id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        role=new_user.role,
        permissions=new_user.permissions or [],
        created_by_id=new_user.created_by_id,
        created_by_name=current_user.username,
        is_active=new_user.is_active,
        created_at=new_user.created_at
    )

@router.patch("/{id}/permissions", response_model=UserDetailResponse)
def update_user_permissions(
    id: int,
    payload: UserPermissionsUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.require_manager_or_above)
):
    """
    Updates permissions for an executive or manager.
    Manager can only manage permissions of their own created executives.
    Super Admin can manage permissions of all users.
    """
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.role == "manager":
        if user.created_by_id != current_user.id or user.role != "executive":
            raise HTTPException(status_code=403, detail="Managers can only update permissions of their own executives.")

    old_perms = user.permissions or []
    user.permissions = payload.permissions
    db.commit()
    db.refresh(user)

    client_ip = request.client.host if request.client else None
    AuditService.log(
        db=db,
        user=current_user,
        action="PERMISSION_CHANGE",
        entity_type="user",
        entity_id=str(user.id),
        old_values={"permissions": old_perms},
        new_values={"permissions": user.permissions},
        ip_address=client_ip
    )

    creator = db.query(User).filter(User.id == user.created_by_id).first() if user.created_by_id else None

    return UserDetailResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        permissions=user.permissions or [],
        created_by_id=user.created_by_id,
        created_by_name=creator.username if creator else None,
        is_active=user.is_active,
        created_at=user.created_at
    )

@router.patch("/{id}/status", response_model=UserDetailResponse)
def update_user_status(
    id: int,
    payload: UserStatusUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.require_manager_or_above)
):
    """
    Activates or deactivates a user account.
    Cannot deactivate oneself.
    """
    if id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot alter your own active status.")

    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.role == "manager":
        if user.created_by_id != current_user.id or user.role != "executive":
            raise HTTPException(status_code=403, detail="Managers can only change status of their own executives.")

    old_status = user.is_active
    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)

    client_ip = request.client.host if request.client else None
    AuditService.log(
        db=db,
        user=current_user,
        action="STATUS_CHANGE",
        entity_type="user",
        entity_id=str(user.id),
        old_values={"is_active": old_status},
        new_values={"is_active": user.is_active},
        ip_address=client_ip
    )

    creator = db.query(User).filter(User.id == user.created_by_id).first() if user.created_by_id else None

    return UserDetailResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        permissions=user.permissions or [],
        created_by_id=user.created_by_id,
        created_by_name=creator.username if creator else None,
        is_active=user.is_active,
        created_at=user.created_at
    )

