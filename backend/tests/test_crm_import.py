import io
import csv
import pytest
import openpyxl
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
    """Verifies downloading the Excel import template."""
    response = client.get("/api/v1/crm-records/template")
    assert response.status_code == 200
    assert "spreadsheetml.sheet" in response.headers["content-type"]

    # Verify workbook structure
    wb = openpyxl.load_workbook(io.BytesIO(response.content))
    sheet = wb.active
    rows = list(sheet.iter_rows(values_only=True))
    assert len(rows) >= 3  # Header + 2 sample rows
    headers = [str(c).strip() for c in rows[0]]
    expected_headers = ["Sr No", "Date", "Status", "Client", "Name", "Number", "Remarks", "Designation", "Email ID"]
    assert headers == expected_headers


def test_import_crm_records_excel(auth_admin, db_session):
    """
    Tests uploading an Excel sheet matching the user's exact screenshot:
    Headers: Sr No, Date, Status, Client, Name, Number, Remarks, Designation, Email ID
    Validates:
    1. Import status 201
    2. Visibility strictly 'all' by default
    3. Correct lead_status (Warm, Cold, Hot)
    4. Audit trail entry created with BULK_IMPORT
    """
    # Clean any pre-existing test records for these clients
    test_clients = [
        "Solarium Green energy (Ahmedabad)",
        "Governement Hospital Dewas",
        "Prestige Oil Refinery",
        "Mrinal Das",
        "Zeal Life Sciences Pvt Ltd",
        "Silver Finance Pvt Ltd"
    ]
    db_session.query(CRMRecord).filter(CRMRecord.company_name.in_(test_clients)).delete(synchronize_session=False)
    db_session.commit()

    # Build Excel file matching user's sheet
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Sr No", "Date", "Status", "Client", "Name", "Number", "Remarks", "Designation", "Email ID"])
    
    rows_data = [
        [50, "17 Nov", "Warm", "Solarium Green energy (Ahmedabad)", "Chintan Wachani ( Purchase department)", "9023725751", "Customer discussion ongoing", "Purchase department", "chintan@solarium.com"],
        [51, "18 Nov", "Cold", "Governement Hospital Dewas", "Dr Sarojni (CMO Dewas District)", 9425134278, "Demo conducted with CMO.", "CMO", "cmo@dewas.gov.in"],
        [52, "18 Nov", "Cold", "Prestige Oil Refinery", None, None, "They liked our proposal, demo conducted.", None, None],
        [53, "18 Nov", "Warm", "Mrinal Das", "Consultant", "97488 33282", "Received a new lead for Goa ITMS project.", "Consultant", "mrinal@das.com"],
        [54, "19 Nov", "Hot", "Zeal Life Sciences Pvt Ltd", "Sulabh ji", "87179 09999", "Customer requires video analytics for 70+ cameras.", "Director", "sulabh@zeallife.com"],
        [55, "20 Nov", "Hot", "Silver Finance Pvt Ltd", "Priyesh ji", "99775 05067", "Silver Finance is a mortgage company.", "Manager", "priyesh@silver.com"]
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
    assert data["total_imported"] == 6
    assert data["visibility"] == "all"

    # Verify records in database
    records = db_session.query(CRMRecord).filter(CRMRecord.company_name.in_(test_clients)).all()
    assert len(records) == 6

    for rec in records:
        # Visibility must be strictly 'all' by default
        assert rec.visibility == "all", f"Record {rec.company_name} visibility was {rec.visibility}"
        assert rec.user_id == auth_admin.id

    # Verify specific fields
    solarium = next(r for r in records if "Solarium" in r.company_name)
    assert solarium.lead_status == "Warm"
    assert solarium.client_phone == "9023725751"
    assert solarium.client_name == "Chintan Wachani ( Purchase department)"
    assert solarium.entered_date.day == 17
    assert solarium.entered_date.month == 11

    dewas = next(r for r in records if "Governement Hospital" in r.company_name)
    assert dewas.lead_status == "Cold"
    assert dewas.client_phone == "9425134278"

    zeal = next(r for r in records if "Zeal Life" in r.company_name)
    assert zeal.lead_status == "Hot"
    assert zeal.client_name == "Sulabh ji"

    # Verify Audit Log
    latest_audit = (
        db_session.query(AuditLog)
        .filter(AuditLog.action == "BULK_IMPORT", AuditLog.entity_type == "crm_record")
        .order_by(AuditLog.id.desc())
        .first()
    )
    assert latest_audit is not None
    assert latest_audit.user_name == "admin"
    assert latest_audit.new_values["total_imported"] == 6
    assert latest_audit.new_values["visibility"] == "all"
    assert latest_audit.new_values["filename"] == "Leads_Import_Test.xlsx"

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
    writer.writerow(["Sr No", "Date", "Status", "Client", "Name", "Number", "Remarks", "Designation", "Email ID"])
    writer.writerow([1, "2026-11-25", "Hot", "CSV Client Alpha Ltd", "Amit Roy", "9812345678", "High priority lead", "VP Tech", "amit@alpha.com"])
    writer.writerow([2, "2026-11-26", "Cold", "CSV Client Beta Corp", "Priya Sen", "9876543210", "Follow up in Q1", "Buyer", "priya@beta.com"])

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
    for rec in records:
        assert rec.visibility == "all"

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
