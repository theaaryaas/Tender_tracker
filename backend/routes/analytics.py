from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from backend.core.db import get_db
from backend.models.tender import Tender
from backend.schemas.analytics import AnalyticsOverview
import re

router = APIRouter(prefix="/analytics", tags=["Analytics"])
IST = ZoneInfo("Asia/Kolkata")

@router.get("/overview", response_model=AnalyticsOverview)
def get_analytics_overview(db: Session = Depends(get_db)):
    all_tenders = db.query(Tender).all()
    total = len(all_tenders)

    direct_fit = sum(1 for t in all_tenders if "direct fit" in (t.eligibility_assessment or "").lower())
    partner_route = sum(1 for t in all_tenders if "partner" in (t.eligibility_assessment or "").lower())
    review_count = total - direct_fit - partner_route

    new_tenders = sum(1 for t in all_tenders if t.status == "New")
    under_review = sum(1 for t in all_tenders if t.status == "Reviewing")
    bid_ready = sum(1 for t in all_tenders if t.status == "Bid Ready")
    starred = sum(1 for t in all_tenders if t.is_starred)

    # Portal Distribution
    portals = {}
    for t in all_tenders:
        p = t.portal or "Unknown"
        portals[p] = portals.get(p, 0) + 1

    # Priority
    priority = {"High": 0, "Normal": 0, "Low": 0}
    for t in all_tenders:
        pr = t.priority or "Normal"
        priority[pr] = priority.get(pr, 0) + 1

    # Keywords Frequency
    kw_counts = {}
    for t in all_tenders:
        if t.matched_keywords:
            for kw in re.split(r",\s*", t.matched_keywords):
                cleaned = kw.strip().title()
                if cleaned:
                    kw_counts[cleaned] = kw_counts.get(cleaned, 0) + 1

    # Closing Soon Calculation (48h and 7d)
    now = datetime.now(IST)
    closing_48h = 0
    closing_7d = 0

    for t in all_tenders:
        if not t.closing_date:
            continue
        try:
            # Try parsing various date formats
            dt = None
            date_str = t.closing_date.strip()
            # E.g. "17-Nov-2026 11:30 PM" or "2026-11-17"
            for fmt in ["%d-%b-%Y %I:%M %p", "%d-%b-%Y %H:%M", "%d/%m/%Y %H:%M", "%d-%m-%Y"]:
                try:
                    dt = datetime.strptime(date_str, fmt).replace(tzinfo=IST)
                    break
                except Exception:
                    pass
            if dt:
                diff = (dt - now).total_seconds()
                if 0 < diff <= 48 * 3600:
                    closing_48h += 1
                if 0 < diff <= 7 * 86400:
                    closing_7d += 1
        except Exception:
            pass

    return {
        "total_tenders": total,
        "direct_fit_count": direct_fit,
        "partner_route_count": partner_route,
        "review_count": max(0, review_count),
        "new_tenders_count": new_tenders,
        "under_review_count": under_review,
        "bid_ready_count": bid_ready,
        "closing_soon_48h": closing_48h,
        "closing_soon_7d": closing_7d,
        "starred_count": starred,
        "portals_distribution": portals,
        "top_keywords": dict(sorted(kw_counts.items(), key=lambda x: x[1], reverse=True)[:8]),
        "priority_distribution": priority
    }

