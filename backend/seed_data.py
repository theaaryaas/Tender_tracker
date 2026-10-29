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
                BASE_DIR / "company_profile.json",
                Path("/app/company_profile.json"),
                Path("company_profile.json")
            ]
            for p in candidate_paths:
                if p.exists():
                    content = p.read_text(encoding="utf-8")
                    db.add(Setting(key="company_profile", value_json=content, description="BitVivid Company Profile"))
                    print(f"Seeded company profile from {p}")
                    break

        # 2. Seed Default Keywords if missing
        existing_kw = db.query(Setting).filter(Setting.key == "keywords").first()
        if not existing_kw:
            db.add(Setting(key="keywords", value_json=json.dumps({"keywords": DEFAULT_KEYWORDS}), description="Active search keywords"))
            print("Seeded default keywords")

        # 3. Seed Existing Tenders from CSV if database is empty
        tender_count = db.query(Tender).count()
        if tender_count == 0:
            csv_candidates = [
                BASE_DIR / "BitVivid_Tender_Tracker_GeM.csv",
                Path("/app/BitVivid_Tender_Tracker_GeM.csv"),
                Path("BitVivid_Tender_Tracker_GeM.csv")
            ]
            csv_path = next((p for p in csv_candidates if p.exists()), None)
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

    finally:
        db.close()

if __name__ == "__main__":
    seed_database()

