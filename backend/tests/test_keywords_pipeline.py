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
