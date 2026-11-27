import uuid
from fastapi.testclient import TestClient

from backend.main import app
from backend.core.db import SessionLocal
from backend.core.date_utils import parse_closing_datetime
from backend.models.tender import Tender

client = TestClient(app)


def test_parse_closing_datetime_variants():
    dt1 = parse_closing_datetime("20 Nov 2026 15:00")
    assert dt1 is not None
    assert (dt1.year, dt1.month, dt1.day, dt1.hour, dt1.minute) == (2026, 11, 20, 15, 0)

    dt2 = parse_closing_datetime("15 December 2026")
    assert dt2 is not None
    assert (dt2.year, dt2.month, dt2.day) == (2026, 12, 15)

    dt3 = parse_closing_datetime("02 December 2026, 16:00")
    assert dt3 is not None
    assert (dt3.year, dt3.month, dt3.day, dt3.hour, dt3.minute) == (2026, 12, 2, 16, 0)


def test_tender_bid_pipeline_fields_update_and_search():
    db = SessionLocal()
    suffix = uuid.uuid4().hex[:8]
    tender = Tender(
        tender_id=f"TEST-PIPE-FLD-{suffix}",
        portal="GeM BidPlus",
        site_key="gem",
        title="Pipeline Tracking Fields Test",
        organisation="Test Dept",
        status="Bid Ready",
        assigned_to="Ritwik",
        bid_progress="Docs Preparing",
        bid_date=None,
    )
    db.add(tender)
    db.commit()
    db.refresh(tender)

    try:
        res_patch = client.patch(
            f"/api/v1/tenders/{tender.id}",
            json={
                "status": "Rejected",
                "assigned_to": "Rahi",
                "bid_progress": "Bid Placed",
                "bid_date": "25/11/2026",
            },
        )
        assert res_patch.status_code == 200, res_patch.text
        updated = res_patch.json()
        assert updated["status"] == "Rejected"
        assert updated["assigned_to"] == "Rahi"
        assert updated["bid_progress"] == "Bid Placed"
        assert updated["bid_date"] == "25/11/2026"

        res_search = client.get("/api/v1/tenders/", params={"search": "Bid Placed"})
        assert res_search.status_code == 200
        ids = [item["id"] for item in res_search.json()["items"]]
        assert tender.id in ids
    finally:
        db.query(Tender).filter(Tender.id == tender.id).delete(synchronize_session=False)
        db.commit()
        db.close()

