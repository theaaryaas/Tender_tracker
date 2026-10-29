from pydantic import BaseModel
from typing import Dict, List, Any

class AnalyticsOverview(BaseModel):
    total_tenders: int
    direct_fit_count: int
    partner_route_count: int
    review_count: int
    new_tenders_count: int
    under_review_count: int
    bid_ready_count: int
    closing_soon_48h: int
    closing_soon_7d: int
    starred_count: int
    portals_distribution: Dict[str, int]
    top_keywords: Dict[str, int]
    priority_distribution: Dict[str, int]

