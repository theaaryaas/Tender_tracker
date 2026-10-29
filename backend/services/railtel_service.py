import httpx
from bs4 import BeautifulSoup
import urllib.parse
from typing import List, Dict, Any
from backend.core.config import settings

class RailTelService:
    PAGES = [
        ("Active Tenders", "https://www.railtel.in/tenders/active-tenders.html"),
        ("Expression of Interest", "https://www.railtel.in/tenders/expression-of-interest.html"),
        ("Limited Tenders", "https://www.railtel.in/tenders/lt-quotation.html"),
    ]

    @staticmethod
    async def search(keyword: str) -> List[Dict[str, Any]]:
        found = []
        kw_lower = keyword.lower()
        try:
            async with httpx.AsyncClient(timeout=35.0, headers={"User-Agent": settings.USER_AGENT}, follow_redirects=True) as client:
                for cat_name, page_url in RailTelService.PAGES:
                    resp = await client.get(page_url)
                    if resp.status_code != 200:
                        continue

                    soup = BeautifulSoup(resp.text, "html.parser")
                    rows = soup.find_all("tr")
                    for row in rows:
                        cells = row.find_all("td")
                        if len(cells) < 3:
                            continue

                        row_text = row.get_text(" ", strip=True)
                        if kw_lower not in row_text.lower():
                            continue

                        link_tag = row.find("a", href=True)
                        tender_url = urllib.parse.urljoin(page_url, link_tag["href"]) if link_tag else page_url

                        # Extract details
                        ref = cells[2].get_text(strip=True) if len(cells) > 2 else f"RAILTEL-{len(found)+1}"
                        closing = cells[3].get_text(strip=True) if len(cells) > 3 else ""
                        title = cells[-1].get_text(strip=True) if len(cells) > 4 else row_text[:120]

                        found.append({
                            "tender_id": ref or f"RAILTEL-{len(found)+1}",
                            "reference": ref,
                            "portal": "RailTel Corporation",
                            "site_key": "railtel",
                            "title": title,
                            "organisation": "RailTel Corporation of India Limited",
                            "published_date": "",
                            "closing_date": closing,
                            "opening_date": "",
                            "url": tender_url,
                            "doc_url": tender_url if tender_url.endswith(".pdf") else "",
                            "matched_keywords": keyword
                        })
        except Exception as e:
            print(f"[RailTel] Error searching '{keyword}': {e}")
        return found

