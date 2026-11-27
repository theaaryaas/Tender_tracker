import csv
import json
from pathlib import Path
from backend.core.db import SessionLocal, Base, engine
from backend.models.tender import Tender
from backend.models.setting import Setting
from backend.services.scraper_service import DEFAULT_KEYWORDS

BASE_DIR = Path(__file__).resolve().parent.parent

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Seed Company Profile if missing
        existing_profile = db.query(Setting).filter(Setting.key == "company_profile").first()
        if not existing_profile:
            candidate_paths = [
                Path(__file__).resolve().parent / "data" / "company_profile.json",
                BASE_DIR / "backend" / "data" / "company_profile.json",
                Path("/app/backend/data/company_profile.json"),
                BASE_DIR / "company_profile.json",
                Path("/app/company_profile.json"),
                Path("company_profile.json")
            ]
            for p in candidate_paths:
                if p.exists() and p.is_file():
                    content = p.read_text(encoding="utf-8")
                    db.add(Setting(key="company_profile", value_json=content, description="BitVivid Company Profile"))
                    print(f"Seeded company profile from {p}")
                    break

        # 2. Seed Default Keywords if missing
        existing_kw = db.query(Setting).filter(Setting.key == "keywords").first()
        if not existing_kw:
            db.add(Setting(key="keywords", value_json=json.dumps({"keywords": DEFAULT_KEYWORDS}), description="Active search keywords"))
            print("Seeded default keywords")
        db.commit()

        # 3. Seed Default Super Admin if admin account does not exist
        from backend.models.user import User
        from backend.core.security import get_password_hash
        existing_admin = db.query(User).filter((User.username == "admin") | (User.email == "admin@bitvivid.com")).first()
        if not existing_admin:
            default_admin = User(
                username="admin",
                email="admin@bitvivid.com",
                hashed_password=get_password_hash("Admin@12345"),
                role="super_admin",
                permissions=["can_view_audit", "can_export", "can_delete_tenders", "can_bulk_delete_expired", "can_manage_users", "can_manage_scrapers"],
                is_active=True
            )
            db.add(default_admin)
            db.commit()
            print("Seeded default Super Admin (admin / Admin@12345)")

        # 3. Seed Existing Tenders from CSV if database is empty
        tender_count = db.query(Tender).count()
        if tender_count == 0:
            csv_candidates = [
                BASE_DIR / "BitVivid_Tender_Tracker_GeM.csv",
                Path("/app/BitVivid_Tender_Tracker_GeM.csv"),
                Path("BitVivid_Tender_Tracker_GeM.csv")
            ]
            csv_path = next((p for p in csv_candidates if p.exists() and p.is_file()), None)
            if csv_path:
                print(f"Importing legacy tenders from {csv_path.name}...")
                with open(csv_path, mode="r", encoding="utf-8-sig") as f:
                    reader = csv.DictReader(f)
                    added = 0
                    for row in reader:
                        code = row.get("Tender ID") or row.get("Sr No")
                        if not code:
                            continue
                        
                        # Match fit score
                        assessment = row.get("Eligibility Assessment", "")
                        score = 85 if "direct fit" in assessment.lower() else (65 if "partner" in assessment.lower() else 50)
                        
                        url = row.get("Tender Link", "")
                        doc_url = url if "/showbidDocument/" in url else ""

                        tender = Tender(
                            tender_id=code,
                            reference=code,
                            portal=row.get("Tender Website / Portal") or "GeM BidPlus",
                            site_key="gem",
                            title=row.get("Tender Full Name") or "Tender Title",
                            organisation=row.get("Organisation") or "",
                            published_date="",
                            closing_date=row.get("Bid End Date") or "",
                            url=url,
                            doc_url=doc_url,
                            emd_amount=row.get("EMD") or "Check tender PDF / ATC",
                            turnover_required=row.get("Turnover Criteria") or "Check tender PDF / ATC",
                            experience_required=row.get("Experience Criteria") or "Check tender PDF / ATC",
                            eligibility_assessment=assessment or "Potential direct fit — verify tender clauses",
                            si_partner_route=row.get("SI Partner Route") or "Assess SI / OEM partner route",
                            matched_keywords=row.get("Matched Keywords") or "cctv, surveillance",
                            assessment_notes=row.get("Assessment Notes") or "",
                            fit_score=score,
                            status="New",
                            priority="Normal"
                        )
                        db.add(tender)
                        added += 1
                    db.commit()
                    print(f"Successfully seeded {added} tenders into database.")
        else:
            print(f"Database already contains {tender_count} tenders. Skipping seed.")

        # 4. Seed / backfill active Bid Pipeline records once
        _seed_active_pipeline_records(db)

    finally:
        db.close()


ACTIVE_PIPELINE_RECORDS = [
    {
        "tender_id": "2026_UDSCL_1198543_1",
        "portal": "Central eProcurement",
        "site_key": "central",
        "title": "Startup empanelment for application software/web/ITeS/scanning",
        "organisation": "UDSCL",
        "closing_date": "20 Nov 2026 15:00",
        "bid_date": "18/11/2026",
        "bid_progress": "Bid Placed",
        "assigned_to": "Ritwik",
        "status": "Submitted",
        "priority": "High",
        "fit_score": 85,
        "eligibility_assessment": "Direct Technical Alignment — Software / Web / ITeS",
        "matched_keywords": "software, web, ites, scanning",
    },
    {
        "tender_id": "2026_MPP_543016_1",
        "portal": "Central eProcurement",
        "site_key": "central",
        "title": "Image and Video Enhancement Software",
        "organisation": "MPP",
        "closing_date": "30 Nov 2026 16:00",
        "bid_date": "24/11/2026",
        "bid_progress": "Bid Placed",
        "assigned_to": "Rahi",
        "status": "Submitted",
        "priority": "High",
        "fit_score": 90,
        "eligibility_assessment": "Direct Technical Alignment — Video & Image Analytics",
        "matched_keywords": "image, video enhancement, software",
    },
    {
        "tender_id": "GEM/2026/B/8196370",
        "portal": "GeM BidPlus",
        "site_key": "gem",
        "title": "Mumbai Indian Railways",
        "organisation": "Mumbai Indian Railways",
        "closing_date": "15 December 2026",
        "bid_date": "25/11/2026",
        "bid_progress": "Bid Placed",
        "assigned_to": "Ritwik",
        "status": "Submitted",
        "priority": "High",
        "fit_score": 85,
        "eligibility_assessment": "Direct Technical Alignment — CCTV & Surveillance",
        "matched_keywords": "cctv, surveillance, railways",
        "update_org_if_existing": True,
    },
    {
        "tender_id": "AI-GOV-FWK-001",
        "portal": "Gov Framework",
        "site_key": "gov",
        "title": "AI partnership with Digital India",
        "organisation": "Digital India",
        "closing_date": "",
        "bid_date": "25/11/2026",
        "bid_progress": "Bid Placed",
        "assigned_to": "Ritwik",
        "status": "Submitted",
        "priority": "High",
        "fit_score": 88,
        "eligibility_assessment": "Direct Technical Alignment — AI Partnership",
        "matched_keywords": "ai, partnership, digital india",
    },
    {
        "tender_id": "GEM/2026/B/8297786",
        "portal": "GeM BidPlus",
        "site_key": "gem",
        "title": "Kendriya Vidyalaya",
        "organisation": "Kendriya Vidyalaya Sangathan",
        "closing_date": "30 Nov 2026 16:00",
        "bid_date": None,
        "bid_progress": "Docs Preparing",
        "assigned_to": "Rahi",
        "status": "Bid Ready",
        "priority": "High",
        "fit_score": 82,
        "eligibility_assessment": "Direct Technical Alignment — Active Bid Preparation",
        "matched_keywords": "kendriya vidyalaya",
    },
    {
        "tender_id": "GEM/2026/B/8218669",
        "portal": "GeM BidPlus",
        "site_key": "gem",
        "title": "Bid for IAF",
        "organisation": "Indian Air Force (IAF)",
        "closing_date": "27 November 2026",
        "bid_date": None,
        "bid_progress": "Docs Preparing",
        "assigned_to": "Ritwik",
        "status": "Bid Ready",
        "priority": "High",
        "fit_score": 82,
        "eligibility_assessment": "Direct Technical Alignment — Active Bid Preparation",
        "matched_keywords": "iaf",
    },
    {
        "tender_id": "GEM/2026/B/8263224",
        "portal": "GeM BidPlus",
        "site_key": "gem",
        "title": "Supply, Installation, Testing and Commissioning (SITC) and Annual Maintenance Contract (AMC) of CCTV Surveillance System at FCI Staff Quarters/Guest",
        "organisation": "Department of Food and Public Distribution (FCI)",
        "closing_date": "02 December 2026, 16:00",
        "bid_date": None,
        "bid_progress": "Docs Preparing",
        "assigned_to": "Manisha",
        "status": "Bid Ready",
        "priority": "High",
        "fit_score": 85,
        "eligibility_assessment": "Direct Technical Alignment — CCTV Surveillance SITC & AMC",
        "matched_keywords": "cctv, surveillance, sitc, amc",
        "update_title_if_existing": True,
        "update_closing_if_existing": True,
    },
]


def _seed_active_pipeline_records(db):
    seed_flag_key = "seed_active_pipeline_v1"
    already_seeded = db.query(Setting).filter(Setting.key == seed_flag_key).first()
    if already_seeded:
        return

    for item in ACTIVE_PIPELINE_RECORDS:
        existing = db.query(Tender).filter(Tender.tender_id == item["tender_id"]).first()
        if existing:
            if existing.status in (None, "", "New"):
                existing.status = item["status"]
            if not existing.assigned_to:
                existing.assigned_to = item["assigned_to"]
            if not existing.bid_date and item.get("bid_date"):
                existing.bid_date = item["bid_date"]
            if not existing.bid_progress and item.get("bid_progress"):
                existing.bid_progress = item["bid_progress"]
            if item.get("update_org_if_existing") and item.get("organisation"):
                existing.organisation = item["organisation"]
            if item.get("update_title_if_existing") and item.get("title"):
                existing.title = item["title"]
            if item.get("update_closing_if_existing") and item.get("closing_date"):
                existing.closing_date = item["closing_date"]
            existing.priority = item.get("priority", existing.priority)
        else:
            tender = Tender(
                tender_id=item["tender_id"],
                reference=item["tender_id"],
                portal=item["portal"],
                site_key=item["site_key"],
                title=item["title"],
                organisation=item.get("organisation"),
                closing_date=item.get("closing_date") or "",
                bid_date=item.get("bid_date"),
                bid_progress=item.get("bid_progress"),
                assigned_to=item.get("assigned_to"),
                status=item["status"],
                priority=item.get("priority", "High"),
                fit_score=item.get("fit_score", 80),
                eligibility_assessment=item.get("eligibility_assessment"),
                matched_keywords=item.get("matched_keywords"),
            )
            db.add(tender)

    db.add(
        Setting(
            key=seed_flag_key,
            value_json=json.dumps({"seeded": True, "count": len(ACTIVE_PIPELINE_RECORDS)}),
            description="Initial active bid pipeline records seeded",
        )
    )
    db.commit()
    print(f"Seeded/updated {len(ACTIVE_PIPELINE_RECORDS)} active Bid Pipeline records.")

if __name__ == "__main__":
    seed_database()
