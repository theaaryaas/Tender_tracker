import pytest
from backend.services.deep_analysis_service import TenderDeepAnalyzerService

def test_deep_analysis_bhopal_tender():
    sample_text = """
    कार्यालय, प्रधानाचार्य एवं मुख्य कार्यपालन अधिकारी
    हकीम सैयद जियाउल हसन, शासकीय (स्वशासी) यूनानी चिकित्सा महाविद्यालय, भोपाल
    (CCTV कैमरों एवं इंटरनेट व्यवस्था के मेन्टेनेन्स हेतु द्वितीय ई-निविदा के नियम एवं शर्तें)
    ई-निविदा प्रपत्र प्राप्त करने एवं जमा करने की अंतिम तिथि 10.12.2026 को सायं 05.00 बजे तक है
    ई-निविदा राशि रू. 1000/- का भुगतान कर सकते हैं।
    ई.एम.डी. राशि रूपये 2000.00 शब्दों में (दो हजार मात्र) म.प्र. के लघु उद्यम तथा स्टार्टअप को ई.एम.डी. राशि के भुगतान में छूट रहेगी।
    निविदाकर्ता फर्म भोपाल नगर निगम सीमा में स्थापित होना चाहिये जिसका गुमास्ता तकनीकी निविदा के अभिलेखों के साथ संलग्न करना आवश्यक होगा।
    निविदाकर्ता फर्म का वित्तीय वर्ष 2024-25/2025-26 का टर्न ओवर न्यूनतम 05 लाख होना आवश्यक है जिसका चार्टर्ड एकाउन्टेंट द्वारा प्रमाणित टर्नओवर सर्टिफिकेट आवश्यक है।
    ब्लैक लिस्टेड न होने का शपथ पत्र राशि रू. 100.00 के नॉन ज्यूडिशियल स्टांप पर नोटराइज संलग्न करना अनिवार्य होगा।
    """

    sample_boq = """
    1.01,DVR 16 PORT,item1,1.0,Nos
    1.02,DVR 32 PORT,item2,1.0,Nos
    1.05,CAMERA BULLET,item5,1.0,Nos
    1.07,POE Switch 4 Port,item7,1.0,Nos
    1.24,CCTV Cable per meter CAT-6,item24,1.0,Nos
    1.32,Router,item32,1.0,Nos
    """

    analysis = TenderDeepAnalyzerService.analyze(
        text=sample_text,
        tender_id="2026_GUMC_BHOPAL_1",
        title="CCTV & Internet Maintenance",
        organisation="Govt Unani Medical College Bhopal",
        boq_content=sample_boq
    )

    # 1. Check MSME Relaxation
    msme = analysis["criteria_checks"]["msme_relaxation"]
    assert msme["emd_exempt"] is True
    assert msme["is_state_restricted"] is True
    assert "Madhya Pradesh" in msme["state_name"]

    # 2. Check Software Certifications (None required)
    software = analysis["criteria_checks"]["software_certifications"]
    assert software["stqc"]["required"] is False
    assert software["onvif"]["required"] is False
    assert software["cert_in"]["required"] is False

    # 3. Check Local Office Blocker (Bhopal Gumasta)
    local = analysis["criteria_checks"]["local_office"]
    assert local["is_local_mandatory"] is True
    assert "Bhopal" in local["jurisdiction"]
    assert local["gumasta_required"] is True

    # 4. Check Hardware / BOQ
    hw = analysis["criteria_checks"]["hardware_scope"]
    assert hw["hardware_mandatory"] is True
    assert analysis["total_boq_count"] >= 6

    # 5. Check Overall Verdict
    verdict = analysis["overall_verdict"]
    assert verdict["verdict"] in ("CONDITIONAL_BID", "HIGH_RISK_BLOCKER")
    assert any("Bhopal" in alert for alert in verdict["key_alerts"])

def test_deep_analysis_open_gem_tender():
    sample_text = """
    Bid Number: GEM/2026/B/123456
    Item Category: CCTV Surveillance Camera System with VMS Software
    Bid End Date/Time: 25-12-2026 15:00:00
    Minimum Average Annual Turnover of the bidder: 50 Lakhs
    MSE Relaxation for Years of Experience and Turnover: Yes
    Startup Relaxation for Years of Experience and Turnover: Yes
    EMD Amount: 50,000
    EMD Exemption: Yes
    STQC certification required for video analytics software.
    ONVIF Profile S and G conformance mandatory.
    """

    analysis = TenderDeepAnalyzerService.analyze(
        text=sample_text,
        tender_id="GEM/2026/B/123456",
        title="CCTV Surveillance Camera System with VMS Software"
    )

    # MSME Full Exemption
    msme = analysis["criteria_checks"]["msme_relaxation"]
    assert msme["emd_exempt"] is True
    assert msme["is_state_restricted"] is False

    # Software Certifications required
    software = analysis["criteria_checks"]["software_certifications"]
    assert software["stqc"]["required"] is True
    assert software["onvif"]["required"] is True

    # No local office restriction
    local = analysis["criteria_checks"]["local_office"]
    assert local["is_local_mandatory"] is False

def test_upload_document_slashed_tender_id():
    from fastapi.testclient import TestClient
    from backend.main import app
    from backend.models.tender import Tender
    from backend.core.db import SessionLocal

    db = SessionLocal()
    slashed_code = "F4.15(30)/RISL/Tech/2026/4066 Dated- 05.11.2026"
    existing = db.query(Tender).filter(Tender.tender_id == slashed_code).first()
    if not existing:
        t = Tender(
            tender_id=slashed_code,
            title="RISL Tech Surveillance",
            portal="eProc Rajasthan",
            site_key="rajasthan",
            estimated_value="₹ 10,00,000",
            emd_amount="₹ 20,000"
        )
        db.add(t)
        db.commit()
    db.close()

    client = TestClient(app)
    encoded_code = "F4.15(30)%2FRISL%2FTech%2F2026%2F4066%20Dated-%2005.11.2026"
    res = client.post(
        f"/api/v1/tenders/{encoded_code}/upload-document",
        files={"file": ("tender_notice.txt", b"EMD Amount: 20000. MSME Relaxation: Yes. No STQC required.", "text/plain")}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["tender_id"] == slashed_code
    assert "criteria_checks" in data
