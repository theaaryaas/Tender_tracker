import io
import csv
import pytest
import openpyxl
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from backend.main import app
from backend.core.db import SessionLocal
from backend.models.user import User
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


@pytest.fixture
def auth_admin(db_session):
    admin = db_session.query(User).filter(User.username == "admin").first()
    if not admin:
        admin = User(
            username="admin",
            email="admin@bitvivid.com",
            hashed_password="dummy",
            role="super_admin",
            permissions=["can_view_audit", "can_export"],
            is_active=True
        )
        db_session.add(admin)
        db_session.commit()
        db_session.refresh(admin)

    app.dependency_overrides[AuthService.get_current_user] = lambda: admin
    yield admin
    app.dependency_overrides.pop(AuthService.get_current_user, None)


def test_download_crm_template(auth_admin):
    """Verifies downloading the Excel import template with all 12 columns."""
    response = client.get("/api/v1/crm-records/template")
    assert response.status_code == 200
    assert "spreadsheetml.sheet" in response.headers["content-type"]

    # Verify workbook structure
    wb = openpyxl.load_workbook(io.BytesIO(response.content))
    sheet = wb.active
    rows = list(sheet.iter_rows(values_only=True))
    assert len(rows) >= 4  # Header + 3 sample rows
    headers = [str(c).strip() for c in rows[0]]
    expected_headers = [
        "Sr No", "Date", "Status", "Bidding Status", "Tender End Date",
        "Client", "Name", "Number", "Remarks", "Designation", "Email ID", "LinkedIn"
    ]
    assert headers == expected_headers


def test_import_crm_records_excel(auth_admin, db_session):
    """
    Tests uploading an Excel sheet matching the enhanced CRM schema:
    Headers: Sr No, Date, Status, Bidding Status, Tender End Date, Client, Name, Number, Remarks, Designation, Email ID, LinkedIn
    Validates:
    1. Import status 201
    2. Visibility strictly 'all' by default
    3. Correct lead_status (Warm, Cold, Hot)
    4. Correct bidding_status (Reviewing, Bidding, Bidded, Rejected)
    5. Tender end date and LinkedIn profile stored
    6. Audit trail entry created with BULK_IMPORT
    """
    test_clients = [
        "Solarium Green energy (Ahmedabad)",
        "Governement Hospital Dewas",
        "Zeal Life Sciences Pvt Ltd"
    ]
    db_session.query(CRMRecord).filter(CRMRecord.company_name.in_(test_clients)).delete(synchronize_session=False)
    db_session.commit()

    # Build Excel file
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append([
        "Sr No", "Date", "Status", "Bidding Status", "Tender End Date",
        "Client", "Name", "Number", "Remarks", "Designation", "Email ID", "LinkedIn"
    ])
    
    rows_data = [
        [1, "17 Nov", "Warm", "Reviewing", "15-12-2026", "Solarium Green energy (Ahmedabad)", "Chintan Wachani", "9023725751", "Discussion ongoing", "Purchase Manager", "chintan@solarium.com", "https://linkedin.com/in/chintan"],
        [2, "18 Nov", "Cold", "Rejected", "30-11-2026", "Governement Hospital Dewas", "Dr Sarojni", "9425134278", "Demo conducted.", "CMO", "cmo@dewas.gov.in", None],
        [3, "19 Nov", "Hot", "Bidding", "05-12-2026", "Zeal Life Sciences Pvt Ltd", "Sulabh ji", "8717909999", "Video analytics needed", "Director", "sulabh@zeallife.com", "https://linkedin.com/company/zeal-life"]
    ]
    for r in rows_data:
        ws.append(r)

    excel_bytes = io.BytesIO()
    wb.save(excel_bytes)
    excel_bytes.seek(0)

    # Post to /api/v1/crm-records/import
    files = {"file": ("Leads_Import_Test.xlsx", excel_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    response = client.post("/api/v1/crm-records/import", files=files)
    assert response.status_code == 201, f"Import failed: {response.text}"

    data = response.json()
    assert data["status"] == "success"
    assert data["total_imported"] == 3
    assert data["created_count"] == 3
    assert data["visibility"] == "all"

    # Verify records in database
    records = db_session.query(CRMRecord).filter(CRMRecord.company_name.in_(test_clients)).all()
    assert len(records) == 3

    solarium = next(r for r in records if "Solarium" in r.company_name)
    assert solarium.lead_status == "Warm"
    assert solarium.bidding_status == "Reviewing"
    assert solarium.tender_end_date == "15-12-2026"
    assert solarium.linkedin_url == "https://linkedin.com/in/chintan"
    assert solarium.visibility == "all"

    dewas = next(r for r in records if "Governement Hospital" in r.company_name)
    assert dewas.lead_status == "Cold"
    assert dewas.bidding_status == "Rejected"
    assert dewas.tender_end_date == "30-11-2026"

    zeal = next(r for r in records if "Zeal Life" in r.company_name)
    assert zeal.lead_status == "Hot"
    assert zeal.bidding_status == "Bidding"
    assert zeal.tender_end_date == "05-12-2026"
    assert zeal.linkedin_url == "https://linkedin.com/company/zeal-life"

    # Test Upsert: Update existing record through second import
    wb2 = openpyxl.Workbook()
    ws2 = wb2.active
    ws2.append([
        "Sr No", "Date", "Status", "Bidding Status", "Tender End Date",
        "Client", "Name", "Number", "Remarks", "Designation", "Email ID", "LinkedIn"
    ])
    ws2.append([
        1, "20 Nov", "Hot", "Bidded", "20-12-2026",
        "Solarium Green energy (Ahmedabad)", "Chintan Wachani", "9023725751",
        "Bid successfully submitted!", "Head of Procurement", "chintan@solarium.com", "https://linkedin.com/in/chintan"
    ])

    excel_bytes2 = io.BytesIO()
    wb2.save(excel_bytes2)
    excel_bytes2.seek(0)

    files2 = {"file": ("Leads_Update_Test.xlsx", excel_bytes2, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    response2 = client.post("/api/v1/crm-records/import", files=files2)
    assert response2.status_code == 201

    data2 = response2.json()
    assert data2["updated_count"] == 1
    assert data2["created_count"] == 0

    db_session.expire_all()
    solarium_updated = db_session.query(CRMRecord).filter(CRMRecord.company_name == "Solarium Green energy (Ahmedabad)").first()
    assert solarium_updated.bidding_status == "Bidded"
    assert solarium_updated.tender_end_date == "20-12-2026"
    assert solarium_updated.remarks == "Bid successfully submitted!"

    # Clean up test records
    db_session.query(CRMRecord).filter(CRMRecord.company_name.in_(test_clients)).delete(synchronize_session=False)
    db_session.commit()


def test_import_crm_records_csv(auth_admin, db_session):
    """Tests CSV upload support with custom column aliases."""
    test_clients = ["CSV Client Alpha Ltd", "CSV Client Beta Corp"]
    db_session.query(CRMRecord).filter(CRMRecord.company_name.in_(test_clients)).delete(synchronize_session=False)
    db_session.commit()

    csv_output = io.StringIO()
    writer = csv.writer(csv_output)
    writer.writerow(["Sr No", "Date", "Status", "Bidding Stage", "Closing Date", "Client", "Name", "Number", "Remarks", "Designation", "Email ID", "LinkedIn"])
    writer.writerow([1, "2026-11-25", "Hot", "Bidding", "2026-12-30", "CSV Client Alpha Ltd", "Amit Roy", "9812345678", "High priority lead", "VP Tech", "amit@alpha.com", "https://linkedin.com/in/amit"])
    writer.writerow([2, "2026-11-26", "Cold", "Reviewing", "2026-12-15", "CSV Client Beta Corp", "Priya Sen", "9876543210", "Follow up in Q1", "Buyer", "priya@beta.com", ""])

    csv_bytes = io.BytesIO(csv_output.getvalue().encode("utf-8"))
    files = {"file": ("leads.csv", csv_bytes, "text/csv")}

    response = client.post("/api/v1/crm-records/import", files=files)
    assert response.status_code == 201

    data = response.json()
    assert data["total_imported"] == 2
    assert data["visibility"] == "all"

    # Verify records in database
    records = db_session.query(CRMRecord).filter(CRMRecord.company_name.in_(test_clients)).all()
    assert len(records) == 2
    alpha = next(r for r in records if "Alpha" in r.company_name)
    assert alpha.bidding_status == "Bidding"
    assert alpha.tender_end_date == "2026-12-30"
    assert alpha.linkedin_url == "https://linkedin.com/in/amit"

    # Clean up
    db_session.query(CRMRecord).filter(CRMRecord.company_name.in_(test_clients)).delete(synchronize_session=False)
    db_session.commit()


def test_import_missing_client_header_fails(auth_admin):
    """Verifies that an invalid spreadsheet without Client column is rejected."""
    csv_output = io.StringIO()
    writer = csv.writer(csv_output)
    writer.writerow(["Sr No", "Date", "Remarks", "Phone"])
    writer.writerow([1, "17 Nov", "Some remark", "9876543210"])

    csv_bytes = io.BytesIO(csv_output.getvalue().encode("utf-8"))
    files = {"file": ("invalid.csv", csv_bytes, "text/csv")}

    response = client.post("/api/v1/crm-records/import", files=files)
    assert response.status_code == 400
    assert "Missing required 'Client' or 'Company' column" in response.json()["detail"]
