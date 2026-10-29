import httpx
from bs4 import BeautifulSoup
import urllib.parse
from typing import List, Dict, Any
from backend.core.config import settings

class GePNICService:
    @staticmethod
    async def search_portal(
        portal_name: str,
        site_key: str,
        home_url: str,
        keyword: str,
        org_filter: tuple = ()
    ) -> List[Dict[str, Any]]:
        found = []
        try:
            async with httpx.AsyncClient(timeout=45.0, headers={"User-Agent": settings.USER_AGENT}, follow_redirects=True) as client:
                resp = await client.get(home_url)
                soup = BeautifulSoup(resp.text, "html.parser")
                form = soup.find("form", id="tenderSearch")
                if not form:
                    return []

                action = form.get("action", "")
                full_action = urllib.parse.urljoin(str(resp.url), action)

                # Collect hidden fields
                data = {}
                for inp in form.find_all("input", type="hidden"):
                    name = inp.get("name")
                    if name:
                        data[name] = inp.get("value", "")
                
                data["SearchDescription"] = keyword
                data["Go"] = "Go"

                post_resp = await client.post(full_action, data=data)
                post_soup = BeautifulSoup(post_resp.text, "html.parser")

                rows = post_soup.find_all("tr", class_=["even", "odd"])
                for r in rows:
                    cells = r.find_all("td")
                    if len(cells) < 6:
                        continue

                    title_cell = cells[4]
                    link_elem = title_cell.find("a")
                    title = link_elem.get_text(strip=True) if link_elem else title_cell.get_text(strip=True)
                    url = urllib.parse.urljoin(str(post_resp.url), link_elem["href"]) if link_elem and link_elem.get("href") else home_url

                    org = cells[5].get_text(strip=True).replace("||", " / ")
                    if org_filter and not any(f.lower() in org.lower() for f in org_filter):
                        continue

                    ref_id = title_cell.get_text(strip=True)
                    # Extract [Ref / ID]
                    import re
                    ids = re.findall(r"\[([^\]]+)\]", ref_id)
                    tender_id = ids[1] if len(ids) > 1 else (ids[0] if ids else f"{site_key}-{len(found)+1}")

                    found.append({
                        "tender_id": tender_id,
                        "reference": ids[0] if ids else tender_id,
                        "portal": portal_name,
                        "site_key": site_key,
                        "title": title or "Tender Notice",
                        "organisation": org,
                        "published_date": cells[1].get_text(strip=True),
                        "closing_date": cells[2].get_text(strip=True),
                        "opening_date": cells[3].get_text(strip=True),
                        "url": url,
                        "doc_url": url,
                        "matched_keywords": keyword
                    })
        except Exception as e:
            print(f"[GePNIC] Error searching {portal_name} for '{keyword}': {e}")
        return found

