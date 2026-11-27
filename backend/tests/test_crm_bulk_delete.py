import uuid
from datetime import date
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.core.db import SessionLocal
from backend.models.user import User
from backend.models.tender import Tender
from backend.models.crm_record import CRMRecord
from backend.models.audit_log import AuditLog
from backend.services.auth_service import AuthService

client = TestClient(app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_or_create_user(db_session, username, role, permissions):
    user = db_session.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            username=username,
            email=f"{username}@bitvivid.com",
            hashed_password="dummy",
            role=role,
            permissions=permissions,
            is_active=True,
        )
        db_session.add(user)
    else:
        user.role = role
        user.permissions = permissions
        user.is_active = True
    db_session.commit()
    db_session.refresh(user)
    return user


def _override_user(user):
    app.dependency_overrides[AuthService.get_current_user] = lambda: user


def test_bulk_delete_crm_records_as_super_admin_releases_unreferenced_tender(db_session):
    admin = _get_or_create_user(db_session, "test_bulk_admin", "super_admin", [])
    _override_user(admin)

    suffix = uuid.uuid4().hex[:8]
    t1 = Tender(
        tender_id=f"TEST-T1-{suffix}",
        portal="GeM",
        site_key="gem",
        title="Bulk Delete Tender 1",
        is_claimed=True,
        assigned_to=admin.username,
        assigned_to_id=admin.id,
        status="Under Review",
    )
    t2 = Tender(
        tender_id=f"TEST-T2-{suffix}",
        portal="GeM",
        site_key="gem",
        title="Bulk Delete Tender 2",
        is_claimed=True,
        assigned_to=admin.username,
        assigned_to_id=admin.id,
        status="Under Review",
    )
    db_session.add_all([t1, t2])
    db_session.commit()
    db_session.refresh(t1)
    db_session.refresh(t2)
    t1_id, t2_id = t1.id, t2.id

    r1 = CRMRecord(tender_id=t1_id, user_id=admin.id, company_name=f"Bulk Co 1 {suffix}", entered_date=date.today())
    r2 = CRMRecord(tender_id=t2_id, user_id=admin.id, company_name=f"Bulk Co 2 {suffix}", entered_date=date.today())
    r3_keep = CRMRecord(tender_id=t2_id, user_id=admin.id, company_name=f"Bulk Co 2 Keep {suffix}", entered_date=date.today())
    db_session.add_all([r1, r2, r3_keep])
    db_session.commit()
    db_session.refresh(r1)
    db_session.refresh(r2)
    db_session.refresh(r3_keep)
    r1_id, r2_id, r3_id = r1.id, r2.id, r3_keep.id

    try:
        res = client.post("/api/v1/crm-records/bulk-delete", json={"ids": [r1_id, r2_id]})
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["deleted_count"] == 2
        assert set(data["deleted_ids"]) == {r1_id, r2_id}
        assert data["released_tender_ids"] == [t1_id]

        db_session.expire_all()
        assert db_session.query(CRMRecord).filter(CRMRecord.id.in_([r1_id, r2_id])).count() == 0
        assert db_session.query(CRMRecord).filter(CRMRecord.id == r3_id).first() is not None

        t1_refreshed = db_session.query(Tender).filter(Tender.id == t1_id).first()
        t2_refreshed = db_session.query(Tender).filter(Tender.id == t2_id).first()
        assert t1_refreshed.is_claimed is False
        assert t1_refreshed.status == "New"
        assert t2_refreshed.is_claimed is True

        audit = (
            db_session.query(AuditLog)
            .filter(AuditLog.action == "BULK_DELETE", AuditLog.entity_type == "crm_record")
            .order_by(AuditLog.id.desc())
            .first()
        )
        assert audit is not None
        assert set(audit.old_values["deleted_ids"]) == {r1_id, r2_id}
    finally:
        app.dependency_overrides.pop(AuthService.get_current_user, None)
        db_session.query(CRMRecord).filter(CRMRecord.id.in_([r1_id, r2_id, r3_id])).delete(synchronize_session=False)
        db_session.query(Tender).filter(Tender.id.in_([t1_id, t2_id])).delete(synchronize_session=False)
        db_session.commit()


def test_bulk_delete_requires_permission_and_ownership_for_executive(db_session):
    exec_no_perm = _get_or_create_user(db_session, "test_exec_noperm", "executive", ["can_export"])
    exec_with_perm = _get_or_create_user(db_session, "test_exec_perm", "executive", ["can_export", "can_delete_tenders"])
    other_user = _get_or_create_user(db_session, "test_other_owner", "executive", [])

    suffix = uuid.uuid4().hex[:8]
    own_rec = CRMRecord(user_id=exec_with_perm.id, company_name=f"Own Co {suffix}", entered_date=date.today())
    other_rec = CRMRecord(user_id=other_user.id, company_name=f"Other Co {suffix}", entered_date=date.today())
    db_session.add_all([own_rec, other_rec])
    db_session.commit()
    db_session.refresh(own_rec)
    db_session.refresh(other_rec)
    own_id, other_id = own_rec.id, other_rec.id

    try:
        # 1. Executive without can_delete_tenders is rejected
        _override_user(exec_no_perm)
        res_forbidden = client.post("/api/v1/crm-records/bulk-delete", json={"ids": [own_id]})
        assert res_forbidden.status_code == 403

        # 2. Executive with can_delete_tenders cannot delete another user's record (atomic)
        _override_user(exec_with_perm)
        res_other = client.post("/api/v1/crm-records/bulk-delete", json={"ids": [own_id, other_id]})
        assert res_other.status_code == 403
        db_session.expire_all()
        assert db_session.query(CRMRecord).filter(CRMRecord.id == own_id).first() is not None

        # 3. Executive with can_delete_tenders can bulk delete their own record
        res_own = client.post("/api/v1/crm-records/bulk-delete", json={"ids": [own_id]})
        assert res_own.status_code == 200
        assert res_own.json()["deleted_ids"] == [own_id]
    finally:
        app.dependency_overrides.pop(AuthService.get_current_user, None)
        db_session.query(CRMRecord).filter(CRMRecord.id.in_([own_id, other_id])).delete(synchronize_session=False)
        db_session.commit()
