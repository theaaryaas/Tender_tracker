import uuid
from datetime import date
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.core.db import SessionLocal
from backend.models.user import User
from backend.models.tender import Tender
from backend.models.crm_record import CRMRecord
from backend.services.auth_service import AuthService

client = TestClient(app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_admin(db_session):
    admin = db_session.query(User).filter(User.username == "test_crm_pipeline_admin").first()
    if not admin:
        admin = User(
            username="test_crm_pipeline_admin",
            email="crm_pipeline_admin@bitvivid.com",
            hashed_password="dummy",
            role="super_admin",
            permissions=["can_delete_tenders"],
            is_active=True,
        )
        db_session.add(admin)
        db_session.commit()
        db_session.refresh(admin)
    return admin


def test_crm_approval_and_pipeline_create_update_filter(db_session):
    admin = _get_admin(db_session)
    app.dependency_overrides[AuthService.get_current_user] = lambda: admin

    suffix = uuid.uuid4().hex[:8]
    tender = Tender(
        tender_id=f"TEST-PIPE-{suffix}",
        portal="GeM",
        site_key="gem",
        title="Pipeline Sync Test Tender",
        status="New",
        is_claimed=True,
        assigned_to=admin.username,
        assigned_to_id=admin.id,
    )
    db_session.add(tender)
    db_session.commit()
    db_session.refresh(tender)

    created_ids = []
    try:
        # 1. Create manual off-portal record with Accepted & Bid Ready
        res_manual = client.post(
            "/api/v1/crm-records/manual",
            json={
                "company_name": f"Manual Co {suffix}",
                "lead_status": "Hot",
                "approval_status": "Accepted",
                "pipeline_stage": "Bid Ready",
                "visibility": "all",
            },
        )
        assert res_manual.status_code == 201, res_manual.text
        manual_data = res_manual.json()
        created_ids.append(manual_data["id"])
        assert manual_data["approval_status"] == "Accepted"
        assert manual_data["pipeline_stage"] == "Bid Ready"

        # 2. Create linked record defaulting to Pending / New, then update via PATCH
        res_linked = client.post(
            "/api/v1/crm-records/manual",
            json={
                "tender_id": tender.id,
                "company_name": f"Linked Co {suffix}",
                "lead_status": "Warm",
                "visibility": "all",
            },
        )
        assert res_linked.status_code == 201, res_linked.text
        linked_data = res_linked.json()
        created_ids.append(linked_data["id"])
        assert linked_data["approval_status"] == "Pending"
        assert linked_data["pipeline_stage"] == "New"

        # Patch approval_status to Rejected and pipeline_stage to Rejected
        res_patch = client.patch(
            f"/api/v1/crm-records/{linked_data['id']}",
            json={"approval_status": "Rejected", "pipeline_stage": "Rejected"},
        )
        assert res_patch.status_code == 200, res_patch.text
        patched = res_patch.json()
        assert patched["approval_status"] == "Rejected"
        assert patched["pipeline_stage"] == "Rejected"
        assert patched["tender"]["status"] == "Rejected"
        assert patched["updated_by_id"] == admin.id
        assert patched["updated_by_name"] == admin.username
        assert patched["updated_at"] is not None

        db_session.expire_all()
        refreshed_tender = db_session.query(Tender).filter(Tender.id == tender.id).first()
        assert refreshed_tender.status == "Rejected"

        # 3. Filter by approval_status and pipeline_stage
        res_filter_acc = client.get(
            "/api/v1/crm-records",
            params={"search": suffix, "approval_status": "Accepted"},
        )
        assert res_filter_acc.status_code == 200
        assert [item["id"] for item in res_filter_acc.json()["items"]] == [manual_data["id"]]

        res_filter_pipe = client.get(
            "/api/v1/crm-records",
            params={"search": suffix, "pipeline_stage": "Rejected"},
        )
        assert res_filter_pipe.status_code == 200
        assert [item["id"] for item in res_filter_pipe.json()["items"]] == [linked_data["id"]]

        # 4. Reject invalid values cleanly
        res_invalid = client.patch(
            f"/api/v1/crm-records/{manual_data['id']}",
            json={"approval_status": "Maybe"},
        )
        assert res_invalid.status_code == 400
    finally:
        app.dependency_overrides.pop(AuthService.get_current_user, None)
        if created_ids:
            db_session.query(CRMRecord).filter(CRMRecord.id.in_(created_ids)).delete(synchronize_session=False)
        db_session.query(Tender).filter(Tender.id == tender.id).delete(synchronize_session=False)
        db_session.commit()
