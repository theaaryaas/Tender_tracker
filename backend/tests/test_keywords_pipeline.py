import json
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from backend.main import app
from backend.core.db import SessionLocal
from backend.models.setting import Setting
from backend.models.tender import Tender
from backend.services.scraper_service import ScraperService, DEFAULT_KEYWORDS
from backend.services.eligibility_service import EligibilityService

client = TestClient(app)


@pytest.fixture
def db_session():
    """Provides a transactional database session for tests."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def backup_and_restore_settings(db_session):
    """
    Backs up existing 'keywords' and 'company_profile' settings
    and restores them cleanly after each test runs.
    """
    kw_setting = db_session.query(Setting).filter(Setting.key == "keywords").first()
    prof_setting = db_session.query(Setting).filter(Setting.key == "company_profile").first()

    orig_kw = kw_setting.value_json if kw_setting else None
    orig_prof = prof_setting.value_json if prof_setting else None

    yield

    # Clean up test modifications and restore original DB state
    if orig_kw is not None:
        curr_kw = db_session.query(Setting).filter(Setting.key == "keywords").first()
        if curr_kw:
            curr_kw.value_json = orig_kw
        else:
            db_session.add(Setting(key="keywords", value_json=orig_kw))
    else:
        db_session.query(Setting).filter(Setting.key == "keywords").delete()

    if orig_prof is not None:
        curr_prof = db_session.query(Setting).filter(Setting.key == "company_profile").first()
        if curr_prof:
            curr_prof.value_json = orig_prof
        else:
            db_session.add(Setting(key="company_profile", value_json=orig_prof))
    else:
        db_session.query(Setting).filter(Setting.key == "company_profile").delete()

    db_session.commit()


# ============================================================================
# 1. API Contract Tests: Settings Keywords (GET / PUT)
# ============================================================================

def test_get_default_keywords_when_none_stored(db_session):
    """When no custom keywords exist in DB, GET returns the system default keywords."""
    db_session.query(Setting).filter(Setting.key == "keywords").delete()
    db_session.commit()

    response = client.get("/api/v1/settings/keywords")
    assert response.status_code == 200
    data = response.json()
    assert "keywords" in data
    assert isinstance(data["keywords"], list)
    assert len(data["keywords"]) > 0
    assert "video analytics" in [k.lower() for k in data["keywords"]] or "ai video analytics" in [k.lower() for k in data["keywords"]]


def test_put_and_get_custom_keywords(db_session):
    """Saving custom frontend keywords persists in DB and is retrievable via GET."""
    custom_keywords = [
        "AI Video Analytics",
        "Automatic Number Plate Recognition",
        "Facial Recognition System",
        "Drone Surveillance",
        "Intelligent Traffic Management System"
    ]

    put_res = client.put("/api/v1/settings/keywords", json={"keywords": custom_keywords})
    assert put_res.status_code == 200
    assert put_res.json()["status"] == "success"
    assert put_res.json()["keywords"] == custom_keywords

    # Verify retrieval through GET endpoint
    get_res = client.get("/api/v1/settings/keywords")
    assert get_res.status_code == 200
    assert get_res.json()["keywords"] == custom_keywords

    # Direct database check
    db_session.expire_all()
    setting = db_session.query(Setting).filter(Setting.key == "keywords").first()
    assert setting is not None
    db_saved = json.loads(setting.value_json)["keywords"]
    assert db_saved == custom_keywords


# ============================================================================
# 2. Company Profile & Financial Non-Negative Validation Tests
# ============================================================================

def test_negative_turnover_and_networth_rejected():
    """Negative values for turnover and net worth must be rejected with HTTP 422."""
    # Negative turnover
    res_neg_turnover = client.put("/api/v1/settings/profile", json={"average_annual_turnover_inr": -9})
    assert res_neg_turnover.status_code == 422
    assert "greater than or equal to 0" in str(res_neg_turnover.json())

    # Negative net worth
    res_neg_nw = client.put("/api/v1/settings/profile", json={"net_worth_inr": -500000})
    assert res_neg_nw.status_code == 422
    assert "greater than or equal to 0" in str(res_neg_nw.json())

    # Valid positive values must be accepted
    res_valid = client.put("/api/v1/settings/profile", json={
        "average_annual_turnover_inr": 50000000.0,
        "net_worth_inr": 25000000.0,
        "udyam_registered": True,
        "dpiit_startup_recognised": True
    })
    assert res_valid.status_code == 200
    assert res_valid.json()["status"] == "success"
    assert res_valid.json()["profile"]["average_annual_turnover_inr"] == 50000000.0
    assert res_valid.json()["profile"]["net_worth_inr"] == 25000000.0


# ============================================================================
# 3. Scraper Service Keywords Retrieval Tests
# ============================================================================

@pytest.mark.asyncio
async def test_scraper_loads_frontend_keywords_from_db(db_session):
    """
    When ScraperService.run_sync() is invoked with keywords=None,
    it must read the active custom keywords from the PostgreSQL Setting table.
    """
    custom_keywords = [
        "AI Video Analytics",
        "ANPR Camera System",
        "Perimeter Intrusion Detection"
    ]
    # Store custom keywords in DB
    setting = db_session.query(Setting).filter(Setting.key == "keywords").first()
    if not setting:
        setting = Setting(key="keywords", value_json=json.dumps({"keywords": custom_keywords}))
        db_session.add(setting)
    else:
        setting.value_json = json.dumps({"keywords": custom_keywords})
    db_session.commit()

    captured_searched_keywords = []

    # Mock search_site to capture the keywords passed to it
    def fake_search_site(site, kw, session=None):
        captured_searched_keywords.append(kw)
        return []

    # Mock ALL_PORTALS to include a mock state portal
    mock_site = MagicMock()
    mock_site.name = "Mock Portal"
    mock_site.kind = "eproc"

    with patch("backend.services.scraper_service.ALL_PORTALS", {"mock_portal": mock_site}), \
         patch("backend.services.scraper_service.search_site", side_effect=fake_search_site):

        await ScraperService.run_sync(
            db=db_session,
            sites=["mock_portal"],
            keywords=None,  # Passed None, so it should load from DB!
            gem_pages=1,
            extract_pdfs=False
        )

    # Verify that the scraper targeted exactly the custom keywords saved in DB
    assert set(captured_searched_keywords) == set(custom_keywords)


@pytest.mark.asyncio
async def test_scraper_falls_back_to_defaults_when_no_keywords_in_db(db_session):
    """
    When no keywords exist in DB and none passed to run_sync(),
    it must fall back to DEFAULT_KEYWORDS.
    """
    db_session.query(Setting).filter(Setting.key == "keywords").delete()
    db_session.commit()

    captured_searched_keywords = []

    def fake_search_site(site, kw, session=None):
        captured_searched_keywords.append(kw)
        return []

    mock_site = MagicMock()
    mock_site.name = "Mock Portal"

    with patch("backend.services.scraper_service.ALL_PORTALS", {"mock_portal": mock_site}), \
         patch("backend.services.scraper_service.search_site", side_effect=fake_search_site):

        await ScraperService.run_sync(
            db=db_session,
            sites=["mock_portal"],
            keywords=None,
            gem_pages=1,
            extract_pdfs=False
        )

    assert len(captured_searched_keywords) == len(DEFAULT_KEYWORDS)
    assert set(captured_searched_keywords) == set(DEFAULT_KEYWORDS)


# ============================================================================
# 4. Keyword Matching & Tier Classification Scoring Tests (EligibilityService)
# ============================================================================

def test_tier_1_ai_keyword_scoring():
    """
    Tenders matching Tier 1 AI keywords (video analytics, facial recognition, ANPR, etc.)
    must achieve high technical fit score and Direct Alignment status.
    """
    profile = {
        "average_annual_turnover_inr": 50000000,
        "udyam_registered": True,
        "dpiit_startup_recognised": True
    }

    status, partner, notes, score = EligibilityService.assess(
        tender_title="Procurement of AI Video Analytics and Facial Recognition Solution for Smart City",
        scope_summary="Supply, installation and maintenance of ANPR and VMS platform",
        profile=profile,
        turnover_required="20000000",
        mse_relaxation="Yes",
        startup_relaxation="Yes",
        emd_amount="Nil"
    )

    assert "Direct Technical Alignment (Direct Fit)" in status
    assert "AI & Video Solutions" in status
    assert score >= 80, f"Expected score >= 80 for core AI, got {score}"
    assert "Direct Bidder" in partner


def test_tier_2_cctv_hardware_keyword_scoring():
    """
    Tenders matching CCTV hardware keywords (cctv, bullet camera, ptz, nvr)
    must classify as Tier 2 CCTV Direct Fit.
    """
    profile = {
        "average_annual_turnover_inr": 50000000,
        "udyam_registered": True,
        "dpiit_startup_recognised": False
    }

    status, partner, notes, score = EligibilityService.assess(
        tender_title="Supply, Installation and Testing of CCTV Surveillance System with IP Bullet Cameras and NVR",
        scope_summary="Supply of 150 IP Dome and Bullet CCTV Cameras with 32 Channel NVR",
        profile=profile,
        turnover_required="30000000",
        mse_relaxation="Yes",
        startup_relaxation="No",
        emd_amount="50000"
    )

    assert "Direct Technical Alignment (Direct Fit)" in status
    assert "CCTV" in status
    assert score >= 65, f"Expected score >= 65 for CCTV hardware, got {score}"
    assert "OEM Authorization Route" in partner or "SI Partner Route" in partner


def test_tier_3_networking_keyword_scoring():
    """
    Tenders matching networking terms (poe switch, fiber optic, cat6)
    must classify as Tier 3 Moderate Alignment.
    """
    status, partner, notes, score = EligibilityService.assess(
        tender_title="Supply of 24 Port Managed PoE Switches and Optical Fiber Cable",
        scope_summary="Laying of 6-core OFC cable and network rack accessories",
        profile={},
        turnover_required="10000000"
    )

    assert "Moderate Alignment" in status
    assert "Networking" in status
    assert "SI / Consortium Route" in partner


def test_tier_negative_unrelated_keyword_scoring():
    """
    Tenders matching negative blacklist terms (medical, cleaning, civil, catering, soap)
    must be capped at <= 22 pts and marked 'Not Aligned — Outside BitVivid Core Scope'.
    """
    status, partner, notes, score = EligibilityService.assess(
        tender_title="Supply of Medical Surgical Instruments, PPE Kits and Cleaning Chemicals",
        scope_summary="Cleaning and housekeeping services for district hospital",
        profile={"average_annual_turnover_inr": 100000000},
        turnover_required="1000000",
        mse_relaxation="Yes",
        startup_relaxation="Yes",
        emd_amount="Nil"
    )

    assert "Not Aligned" in status
    assert "Outside BitVivid Core Scope" in status
    assert score <= 22, f"Unrelated tender score must be <= 22, got {score}"
    assert "Not Recommended for Direct Bidding" in partner


# ============================================================================
# 5. Financial Evaluation vs Profile Turnover Tests
# ============================================================================

def test_turnover_evaluation_against_profile():
    """
    Tests dynamic comparison between tender required turnover and profile turnover.
    """
    profile_small = {"average_annual_turnover_inr": 20000000, "dpiit_startup_recognised": False}  # 2 Cr
    profile_large = {"average_annual_turnover_inr": 100000000, "dpiit_startup_recognised": False} # 10 Cr

    # Tender requiring 5 Cr (50,000,000 INR)
    _, _, notes_small, score_small = EligibilityService.assess(
        tender_title="AI Video Surveillance for Highways",
        scope_summary="Video analytics and incident detection",
        profile=profile_small,
        turnover_required="50000000",
        mse_relaxation="No",
        startup_relaxation="No"
    )

    _, _, notes_large, score_large = EligibilityService.assess(
        tender_title="AI Video Surveillance for Highways",
        scope_summary="Video analytics and incident detection",
        profile=profile_large,
        turnover_required="50000000",
        mse_relaxation="No",
        startup_relaxation="No"
    )

    # Larger turnover profile should score significantly higher on financial feasibility
    assert score_large > score_small
    assert "exceeds BitVivid turnover capacity" in notes_small
    assert "is fully within BitVivid's profile capacity" in notes_large


# ============================================================================
# 6. Bulk Tender Import with Matched Keywords
# ============================================================================

def test_bulk_tender_import_stores_matched_keywords_and_deduplicates(db_session):
    """
    Verifies that POST /api/v1/tenders/import-bulk accepts tenders with matched_keywords,
    evaluates their eligibility automatically, saves to DB, and deduplicates repeated tenders.
    """
    # Clean up any leftover test tender from previous runs
    db_session.query(Tender).filter(Tender.tender_id == "UNIT-TEST-GEM-001").delete()
    db_session.commit()

    tender_payload = {
        "tenders": [
            {
                "tender_id": "UNIT-TEST-GEM-001",
                "reference": "GEM/2026/B/999001",
                "title": "Comprehensive AI Video Analytics and ANPR Surveillance Project",
                "organisation": "Smart City Development Corporation",
                "portal": "GeM BidPlus",
                "site_key": "gem",
                "url": "https://bidplus.gem.gov.in/showbidDocument/999001",
                "matched_keywords": "AI Video Analytics, ANPR, VMS",
                "turnover_required": "10000000",
                "emd_amount": "Nil"
            }
        ]
    }

    # 1. First import
    res1 = client.post("/api/v1/tenders/import-bulk", json=tender_payload)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["tenders_added"] == 1
    assert data1["tenders_updated"] == 0

    # Verify stored in DB
    tender_db = db_session.query(Tender).filter(Tender.tender_id == "UNIT-TEST-GEM-001").first()
    assert tender_db is not None
    assert tender_db.matched_keywords == "AI Video Analytics, ANPR, VMS"
    assert "Direct Fit" in tender_db.eligibility_assessment
    assert tender_db.fit_score >= 80

    # 2. Second import with identical tender_id (Testing Deduplication / Upsert)
    res2 = client.post("/api/v1/tenders/import-bulk", json=tender_payload)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["tenders_added"] == 0
    assert data2["tenders_updated"] == 1  # Updated without creating duplicate!

    # Verify no duplicate was created
    all_matching = db_session.query(Tender).filter(Tender.tender_id == "UNIT-TEST-GEM-001").all()
    assert len(all_matching) == 1

    # Cleanup test tender
    db_session.query(Tender).filter(Tender.tender_id == "UNIT-TEST-GEM-001").delete()
    db_session.commit()


# ============================================================================
# 7. Automatic Purge of Expired Unactioned Tenders
# ============================================================================

def test_purge_expired_unactioned_tenders(db_session):
    """
    Verifies that TenderRepository.purge_expired_unactioned:
    - Deletes tenders past closing date ONLY IF status == 'New' and is_starred is False.
    - Preserves expired tenders that were moved to 'Reviewing', 'Bid Ready', etc.
    - Preserves expired tenders that are starred (is_starred == True).
    - Preserves future / active tenders in stage 'New'.
    """
    from backend.repositories.tender_repository import TenderRepository

    # Clean up any leftover test rows
    test_ids = ["TEST-PURGE-1", "TEST-PURGE-2", "TEST-PURGE-3", "TEST-PURGE-4"]
    db_session.query(Tender).filter(Tender.tender_id.in_(test_ids)).delete()
    db_session.commit()

    # 1. Past closing date + 'New' + not starred -> Should be purged
    t1 = Tender(
        tender_id="TEST-PURGE-1",
        title="Expired Unacted Bid",
        portal="GeM BidPlus",
        site_key="gem",
        status="New",
        is_starred=False,
        closing_date="01-Nov-2026 10:00 AM" # Expired past date
    )
    # 2. Past closing date + 'Reviewing' -> Protected (in pipeline)
    t2 = Tender(
        tender_id="TEST-PURGE-2",
        title="Expired But Reviewing Bid",
        portal="GeM BidPlus",
        site_key="gem",
        status="Reviewing",
        is_starred=False,
        closing_date="01-Nov-2026 10:00 AM"
    )
    # 3. Past closing date + 'New' + is_starred=True -> Protected (bookmarked)
    t3 = Tender(
        tender_id="TEST-PURGE-3",
        title="Expired But Starred Bid",
        portal="GeM BidPlus",
        site_key="gem",
        status="New",
        is_starred=True,
        closing_date="01-Nov-2026 10:00 AM"
    )
    # 4. Future closing date + 'New' -> Protected (active ongoing tender)
    t4 = Tender(
        tender_id="TEST-PURGE-4",
        title="Future Ongoing Bid",
        portal="GeM BidPlus",
        site_key="gem",
        status="New",
        is_starred=False,
        closing_date="31-Dec-2026 05:00 PM"
    )

    db_session.add_all([t1, t2, t3, t4])
    db_session.commit()

    # Run purge
    purged_count = TenderRepository.purge_expired_unactioned(db_session)
    assert purged_count >= 1

    # Verify t1 was purged
    r1 = db_session.query(Tender).filter(Tender.tender_id == "TEST-PURGE-1").first()
    assert r1 is None, "T1 (expired + New) should have been deleted"

    # Verify t2, t3, t4 were preserved
    r2 = db_session.query(Tender).filter(Tender.tender_id == "TEST-PURGE-2").first()
    r3 = db_session.query(Tender).filter(Tender.tender_id == "TEST-PURGE-3").first()
    r4 = db_session.query(Tender).filter(Tender.tender_id == "TEST-PURGE-4").first()

    assert r2 is not None, "T2 (Reviewing stage) must be preserved"
    assert r3 is not None, "T3 (Starred) must be preserved"
    assert r4 is not None, "T4 (Future deadline) must be preserved"

    # Cleanup
    db_session.query(Tender).filter(Tender.tender_id.in_(test_ids)).delete()
    db_session.commit()


def test_cleanup_expired_endpoint(db_session):
    """Verifies POST /api/v1/tenders/cleanup-expired API contract with authorized user."""
    from backend.services.auth_service import AuthService
    from backend.models.user import User
    admin_user = db_session.query(User).filter(User.role == "super_admin").first()
    if not admin_user:
        admin_user = User(
            username="test_super_admin",
            email="test_super_admin@bitvivid.com",
            hashed_password="hash",
            role="super_admin",
            is_active=True,
            permissions=["can_bulk_delete_expired"]
        )
        db_session.add(admin_user)
        db_session.commit()
        db_session.refresh(admin_user)

    app.dependency_overrides[AuthService.get_current_user] = lambda: admin_user
    try:
        res = client.post("/api/v1/tenders/cleanup-expired")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert "purged_count" in data
        assert isinstance(data["purged_count"], int)
    finally:
        app.dependency_overrides.pop(AuthService.get_current_user, None)


# ============================================================================
# 8. HTML Web Extractor for Portals without Direct PDFs
# ============================================================================

def test_html_web_tender_extraction():
    """
    Verifies that HTMLExtractorService accurately parses CPPP / GePNIC
    HTML web pages with structured tables (EMD, Exemption, Scope, Doc links).
    """
    from backend.services.html_extractor_service import HTMLExtractorService

    sample_gepnic_html = """
    <html>
      <body>
        <table>
          <tr><td>Tender Reference Number:</td><td>N-22/5/2025-DIC 3153771</td></tr>
          <tr><td>Tender ID:</td><td>2026_DIT_929901_1</td></tr>
          <tr><td>Work Description:</td><td>RFE Empanelment of AI-Enabled Software Development Partners</td></tr>
          <tr><td>Product Category:</td><td>Info. Tech. Services</td></tr>
          <tr><td>EMD Amount in ₹:</td><td>5,00,000</td></tr>
          <tr><td>EMD Exemption Allowed:</td><td>Yes</td></tr>
          <tr><td>Tender Value in ₹:</td><td>25,00,000</td></tr>
          <tr><td>Bid Submission End Date:</td><td>01-Dec-2026 06:00 PM</td></tr>
        </table>
        <div>
          <a href="/eprocure/app?component=docDownload&service=direct">Tendernotice_1.pdf</a>
        </div>
      </body>
    </html>
    """

    data = HTMLExtractorService.parse_html_content(sample_gepnic_html, base_url="https://eprocure.gov.in/eprocure/app")
    assert data["tender_id"] == "2026_DIT_929901_1"
    assert data["reference"] == "N-22/5/2025-DIC 3153771"
    assert data["emd_amount"] == "₹ 500,000"
    assert data["emd_exemption"] == "Yes"
    assert "EMD Exemption Allowed" in data["mse_relaxation"]
    assert "RFE Empanelment of AI-Enabled Software Development Partners" in data["scope_summary"]
    assert "Info. Tech. Services" in data["scope_summary"]
    assert "Tendernotice_1.pdf" in data["doc_url"] or "docDownload" in data["doc_url"]
    assert "PORTAL METADATA EXTRACTED FROM HTML" in data["extracted_pdf_text"]


@pytest.mark.asyncio
async def test_pdf_service_defaults_do_not_falsely_claim_nil_emd():
    """
    Verifies that when PDFService encounters an unresolvable URL,
    it defaults emd_amount to 'Check tender PDF / ATC' rather than falsely declaring 'Nil / Not Required'.
    """
    from backend.services.pdf_service import PDFService
    res = await PDFService.extract_clauses_from_url("")
    assert res["emd_amount"] == "Check tender PDF / ATC"
    assert res["emd_exemption"] == "Verify MSME / Startup rules"


def test_stqc_hard_blocker_gives_zero_score():
    """
    If a tender mandates STQC certification, it must be blocked with 0 points.
    """
    status, partner, notes, score = EligibilityService.assess(
        tender_title="Procurement of Video Management System and CCTV Cameras with mandatory STQC certification",
        scope_summary="Bidder must submit valid STQC certificate for VMS software",
        full_text="STQC certified OEM required for software deployment",
        turnover_required="10000000",
        mse_relaxation="Yes",
        emd_amount="Nil"
    )
    assert score == 0
    assert "Ineligible" in status
    assert "STQC" in status
    assert "STQC certification is mandated" in notes


def test_custom_frontend_keywords_and_full_criteria():
    """
    Tests frontend custom keywords matching + EMD <= 50k + Exp <= 7 years + MSE Relaxation + Turnover <= capacity = 100 pts.
    """
    profile = {
        "average_annual_turnover_inr": 50000000, # 5 Cr
        "udyam_registered": True,
        "dpiit_startup_recognised": True
    }
    custom_kws = ["smart city surveillance", "traffic analytics", "crowd sensing"]

    status, partner, notes, score = EligibilityService.assess(
        tender_title="Implementation of smart city surveillance and traffic analytics platform",
        scope_summary="Supply of crowd sensing sensors and central analytics dashboard",
        profile=profile,
        turnover_required="20000000", # 2 Cr <= 5 Cr (Full 20 pts)
        mse_relaxation="Yes",         # Full 20 pts
        emd_amount="45000",           # <= 50k (Full 15 pts)
        experience_years="5 years",   # <= 7 years (Full 15 pts)
        custom_keywords=custom_kws    # >= 2 matched (Full 30 pts)
    )

    # 30 (keywords) + 20 (turnover) + 20 (mse) + 15 (emd) + 15 (exp) = 100 points
    assert score == 100
    assert "Direct Technical Alignment (Direct Fit)" in status
    assert "Direct Bidder" in partner
    assert "Direct match with active company keywords" in notes


