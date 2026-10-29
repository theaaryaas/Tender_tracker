import httpx
import json
import re
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from backend.core.config import settings

IST = ZoneInfo("Asia/Kolkata")
GEM_BASE = "https://bidplus.gem.gov.in"
GEM_ALL_BIDS = f"{GEM_BASE}/all-bids"
GEM_DATA = f"{GEM_BASE}/all-bids-data"

class GeMService:
    def __init__(self):
        self.csrf = ""
        self.client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self.client is None or self.client.is_closed:
            self.client = httpx.AsyncClient(
                timeout=45.0,
                headers={"User-Agent": settings.USER_AGENT},
                follow_redirects=True
            )
        return self.client

    async def initialise(self) -> bool:
        client = await self._get_client()
        try:
            resp = await client.get(GEM_ALL_BIDS, headers={"Accept": "text/html"})
            match = re.search(r"csrf_bd_gem_nk.*?'([a-f0-9]{32})'", resp.text, re.I | re.S)
            if match:
                self.csrf = match.group(1)
                return True
        except Exception as e:
            print(f"[GeM] Initialization error: {e}")
        return False

    def _format_date(self, val: str) -> str:
        if not val:
            return ""
        try:
            dt = datetime.fromisoformat(str(val).replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(IST).strftime("%d-%b-%Y %I:%M %p")
        except Exception:
            return str(val)

    async def search(self, keyword: str, max_pages: int = 3) -> List[Dict[str, Any]]:
        if not self.csrf:
            success = await self.initialise()
            if not success:
                return []

        client = await self._get_client()
        found: List[Dict[str, Any]] = []

        for page in range(1, max_pages + 1):
            payload = {
                "page": page,
                "param": {"searchBid": keyword, "searchType": "fullText"},
                "filter": {
                    "bidStatusType": "ongoing_bids",
                    "byType": "all",
                    "highBidValue": "",
                    "byEndDate": {"from": "", "to": ""},
                    "sort": "Bid-End-Date-Latest",
                },
            }
            body = {
                "payload": json.dumps(payload, separators=(",", ":")),
                "csrf_bd_gem_nk": self.csrf,
            }

            try:
                resp = await client.post(
                    GEM_DATA,
                    data=body,
                    headers={
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Accept": "application/json",
                        "Referer": GEM_ALL_BIDS,
                        "Origin": GEM_BASE,
                        "X-Requested-With": "XMLHttpRequest",
                    }
                )

                if resp.status_code != 200:
                    # Token might have expired, try re-initializing once
                    if page == 1:
                        await self.initialise()
                    break

                data = resp.json()
                docs = data.get("response", {}).get("response", {}).get("docs", [])
                if not docs:
                    break

                for doc in docs:
                    bid_id = str(doc.get("b_id") or doc.get("bid_id") or "")
                    bid_number = str(doc.get("b_bid_number") or doc.get("bid_number") or bid_id)
                    title = doc.get("bbt_title") or doc.get("title") or doc.get("b_category_name") or "Tender Title"
                    category = doc.get("b_category_name") or ""
                    dept = doc.get("ba_official_details_deptName") or doc.get("ba_official_details_minName") or doc.get("organisation") or "Government Dept"
                    closing = self._format_date(doc.get("final_end_date_sort") or doc.get("end_date"))
                    published = self._format_date(doc.get("final_start_date_sort") or doc.get("start_date"))
                    
                    doc_url = f"{GEM_BASE}/showbidDocument/{bid_id}" if bid_id else ""
                    bid_url = doc_url if doc_url else GEM_ALL_BIDS

                    found.append({
                        "tender_id": bid_number,
                        "reference": bid_number,
                        "portal": "GeM BidPlus",
                        "site_key": "gem",
                        "title": title if len(title) > 5 else category,
                        "organisation": dept,
                        "published_date": published,
                        "closing_date": closing,
                        "opening_date": "",
                        "url": bid_url,
                        "doc_url": doc_url,
                        "matched_keywords": keyword,
                    })

                await asyncio.sleep(0.8) # Politely pause between pages
            except Exception as e:
                print(f"[GeM] Page {page} error for '{keyword}': {e}")
                break

        return found

    async def close(self):
        if self.client and not self.client.is_closed:
            await self.client.aclose()

