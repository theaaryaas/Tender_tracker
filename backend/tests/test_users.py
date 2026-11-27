import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.core.db import SessionLocal
from backend.models.user import User
from backend.models.tender import Tender
from backend.models.crm_record import CRMRecord
from backend.models.audit_log import AuditLog
from backend.services.auth_service import AuthService
from backend.core.security import create_access_token

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def super_admin_token(db_session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    if not admin:
        admin = User(
            username="admin",
            email="admin@bitvivid.com",
            hashed_password="dummy",
            role="super_admin",
            permissions=["can_view_audit", "can_export", "can_delete_tenders", "can_bulk_delete_expired", "can_manage_users", "can_manage_scrapers"],
            is_active=True
        )
        db_session.add(admin)
        db_session.commit()
        db_session.refresh(admin)

    return create_access_token(
        data={"sub": str(admin.id), "username": admin.username, "role": admin.role, "permissions": admin.permissions}
    )

@pytest.fixture
def manager_token(db_session):
    manager = db_session.query(User).filter(User.username == "test_manager").first()
    if not manager:
        manager = User(
            username="test_manager",
            email="test_manager@bitvivid.com",
            hashed_password="dummy",
            role="manager",
            permissions=["can_view_audit", "can_export"],
            is_active=True
        )
        db_session.add(manager)
        db_session.commit()
        db_session.refresh(manager)

    return create_access_token(
        data={"sub": str(manager.id), "username": manager.username, "role": manager.role, "permissions": manager.permissions}
    )

def test_delete_user_forbidden_for_manager(manager_token, db_session):
    # Manager attempts to delete an executive
    user_to_delete = db_session.query(User).filter(User.username == "exec_to_test").first()
    if not user_to_delete:
        user_to_delete = User(
            username="exec_to_test",
            email="exec_to_test@example.com",
            hashed_password="dummy",
            role="executive",
            is_active=True
        )
        db_session.add(user_to_delete)
        db_session.commit()
        db_session.refresh(user_to_delete)

    resp = client.delete(
        f"/api/v1/users/{user_to_delete.id}",
        headers={"Authorization": f"Bearer {manager_token}"}
    )
    assert resp.status_code == 403
    assert "Super Admin role required" in resp.json().get("detail", "")

def test_super_admin_cannot_delete_self(super_admin_token, db_session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    resp = client.delete(
        f"/api/v1/users/{admin.id}",
        headers={"Authorization": f"Bearer {super_admin_token}"}
    )
    assert resp.status_code == 400
    assert "Cannot delete your own" in resp.json().get("detail", "")

def test_super_admin_delete_user_success(super_admin_token, db_session):
    # Create a dummy user with a claimed tender
    test_user = User(
        username="temp_user_for_delete",
        email="temp_delete@example.com",
        hashed_password="dummy",
        role="executive",
        is_active=True
    )
    db_session.add(test_user)
    db_session.commit()
    db_session.refresh(test_user)

    # Attach tender claim
    tender = db_session.query(Tender).first()
    if tender:
        tender.assigned_to_id = test_user.id
        tender.assigned_to = test_user.username
        tender.is_claimed = True
        db_session.commit()

    # Delete via super_admin
    resp = client.delete(
        f"/api/v1/users/{test_user.id}",
        headers={"Authorization": f"Bearer {super_admin_token}"}
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"

    # Verify user is gone from db
    deleted = db_session.query(User).filter(User.id == test_user.id).first()
    assert deleted is None

    # Verify tender was unassigned
    if tender:
        db_session.refresh(tender)
        assert tender.assigned_to_id is None
        assert tender.is_claimed is False

    # Verify audit log was recorded
    audit_entry = db_session.query(AuditLog).filter(
        AuditLog.action == "DELETE",
        AuditLog.entity_type == "user",
        AuditLog.entity_id == str(test_user.id)
    ).first()
    assert audit_entry is not None

def test_super_admin_update_user_role_and_details(super_admin_token, manager_token, db_session):
    """Verifies Super Admin can update role, username, email, permissions, and password; Manager is forbidden; Super Admin cannot demote self."""
    target = User(
        username="editable_exec",
        email="editable_exec@example.com",
        hashed_password="dummy",
        role="executive",
        permissions=["can_export"],
        is_active=True
    )
    db_session.add(target)
    db_session.commit()
    db_session.refresh(target)

    try:
        # 1. Manager cannot edit user role/details
        mgr_resp = client.patch(
            f"/api/v1/users/{target.id}",
            json={"role": "manager"},
            headers={"Authorization": f"Bearer {manager_token}"}
        )
        assert mgr_resp.status_code == 403

        # 2. Super Admin cannot demote self
        admin = db_session.query(User).filter(User.username == "admin").first()
        self_resp = client.patch(
            f"/api/v1/users/{admin.id}",
            json={"role": "executive"},
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert self_resp.status_code == 400

        # 3. Super Admin promotes executive to manager and updates details
        ok_resp = client.patch(
            f"/api/v1/users/{target.id}",
            json={
                "username": "promoted_mgr",
                "email": "promoted_mgr@example.com",
                "role": "manager",
                "permissions": ["can_export", "can_view_audit", "can_delete_tenders"],
                "password": "NewPassword123!"
            },
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert ok_resp.status_code == 200
        data = ok_resp.json()
        assert data["username"] == "promoted_mgr"
        assert data["email"] == "promoted_mgr@example.com"
        assert data["role"] == "manager"
        assert "can_delete_tenders" in data["permissions"]

        db_session.expire_all()
        updated = db_session.query(User).filter(User.id == target.id).first()
        assert updated.hashed_password != "dummy"
    finally:
        db_session.query(User).filter(User.id == target.id).delete(synchronize_session=False)
        db_session.commit()
