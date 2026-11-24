import re
import urllib.parse
from typing import Dict, Any, Optional
from bs4 import BeautifulSoup
import httpx
from backend.core.config import settings

class HTMLExtractorService:
    """
    Parses structured tender detail web pages from CPPP (eprocure.gov.in)
    and State eProcurement portals (NIC GePNIC).
    Extracts EMD, turnover, scope, dates, and document attachments.
    Includes automated session recovery for stateful Tapestry/GePNIC portals.
    """

    @staticmethod
    def parse_html_content(html_text: str, base_url: str = "") -> Dict[str, Any]:
        result = {
            "estimated_value": "Check tender PDF / ATC",
            "emd_amount": "Check tender PDF / ATC",
            "emd_exemption": "Verify MSME / Startup rules",
            "epbg_required": "Check tender PDF / ATC",
            "turnover_required": "Check tender PDF / ATC",
            "bidder_turnover": None,
            "oem_turnover": None,
            "experience_required": "Relevant past project experience required",
            "experience_years": None,
            "mse_relaxation": "Verify in ATC / Standard MSME rules",
            "startup_relaxation": "Verify in ATC / DPIIT certificate required",
            "scope_summary": "",
            "extracted_pdf_text": "",
            "doc_url": "",
            "reference": "",
            "tender_id": "",
            "organisation": ""
        }

        if not html_text:
            return result

        soup = BeautifulSoup(html_text, "html.parser")
        data: Dict[str, str] = {}

        # 1. Extract all table key-value pairs
        for tr in soup.find_all("tr"):
            tds = tr.find_all(["td", "th"])
            i = 0
            while i < len(tds) - 1:
                k = tds[i].get_text(strip=True).rstrip(":")
                v = tds[i+1].get_text(strip=True)
                if k and v and len(k) < 80:
                    data[k.lower().strip()] = v
                i += 2

        # 2. Extract EMD Amount and Exemption
        emd_raw = ""
        for k, v in data.items():
            if "emd amount" in k:
                emd_raw = v.replace(",", "").strip()
                break

        if emd_raw:
            try:
                amt = float(re.sub(r"[^\d.]", "", emd_raw))
                if amt == 0:
                    result["emd_amount"] = "Nil"
                else:
                    result["emd_amount"] = f"₹ {amt:,.0f}"
            except Exception:
                result["emd_amount"] = emd_raw
        elif any(k in data for k in ("emd fee type", "emd")):
            val = data.get("emd fee type", "") or data.get("emd", "")
            if "exempt" in val.lower() or "nil" in val.lower():
                result["emd_amount"] = "Nil"

        # EMD Exemption
        for k, v in data.items():
            if "emd exemption" in k:
                ex_val = v.strip().title()
                result["emd_exemption"] = ex_val
                if ex_val.lower() == "yes":
                    result["mse_relaxation"] = "Yes (EMD Exemption Allowed by Buyer)"
                break

        # Tender Fee & Exemption
        tender_fee_raw = ""
        for k, v in data.items():
            if "tender fee in" in k or k == "tender fee":
                tender_fee_raw = v.replace(",", "").strip()
                break

        # 3. Work Description & Scope Summary
        work_desc = (
            data.get("work description")
            or data.get("title")
            or data.get("tender title")
            or data.get("item description")
            or ""
        )
        prod_cat = data.get("product category") or data.get("sub category") or ""
        scope_parts = []
        if work_desc:
            scope_parts.append(work_desc)
        if prod_cat and prod_cat != "NA":
            scope_parts.append(f"Category: {prod_cat}")

        pre_qual = data.get("pre qualification details") or ""
        if pre_qual and pre_qual != "NA" and "refer" not in pre_qual.lower():
            scope_parts.append(f"Pre-Qual: {pre_qual}")

        result["scope_summary"] = " • ".join(scope_parts)

        # 4. Tender Value / Estimated Value
        for k, v in data.items():
            if "tender value" in k or "estimated cost" in k or "contract value" in k:
                if v and v != "NA" and v != "0":
                    try:
                        amt = float(re.sub(r"[^\d.]", "", v))
                        if amt > 0:
                            result["estimated_value"] = f"₹ {amt:,.0f}"
                    except Exception:
                        result["estimated_value"] = v
                break

        # 5. Tender Reference, ID, Organisation
        for k, v in data.items():
            if "tender reference number" in k:
                result["reference"] = v
            elif "tender id" in k:
                result["tender_id"] = v
            elif "organisation chain" in k or "organization" in k:
                result["organisation"] = v

        # 6. Discover Direct PDF or Attachment Downloads
        best_doc_link = ""
        for a in soup.find_all("a", href=True):
            txt = a.get_text(strip=True)
            href = a["href"]
            lower_txt = txt.lower()
            lower_href = href.lower()

            if any(term in lower_txt or term in lower_href for term in ("tendernotice", ".pdf", "docdownload", "download as zip", "view more details")):
                if not href.startswith("javascript:") and not href.startswith("#"):
                    full_href = urllib.parse.urljoin(base_url, href) if base_url else href
                    if ".pdf" in lower_txt or ".pdf" in lower_href or "tendernotice" in lower_txt:
                        best_doc_link = full_href
                        break
                    elif not best_doc_link:
                        best_doc_link = full_href

        result["doc_url"] = best_doc_link

        # 7. Generate structured text representation for drawer display
        summary_lines = [
            "=== OFFICIAL CPPP / ePROCUREMENT TENDER DETAILS & SPECIFICATIONS ===",
            "--- [PORTAL METADATA EXTRACTED FROM HTML] ---\n"
        ]
        important_fields = [
            ("Tender Reference Number", "tender reference number"),
            ("Tender ID", "tender id"),
            ("Organisation Chain", "organisation chain"),
            ("Tender Title / Work Description", "work description"),
            ("Tender Type", "tender type"),
            ("Form of Contract", "form of contract"),
            ("Product Category", "product category"),
            ("Tender Fee", "tender fee in ₹"),
            ("Tender Fee Exemption Allowed", "tender fee exemption allowed"),
            ("EMD Amount", "emd amount in ₹"),
            ("EMD Exemption Allowed", "emd exemption allowed"),
            ("EMD Payable To", "emd payable to"),
            ("EMD Payable At", "emd payable at"),
            ("Tender Value", "tender value in ₹"),
            ("Bid End Date", "bid submission end date"),
            ("Bid Opening Date", "bid opening date"),
            ("Period Of Work", "period of work(days)"),
            ("Location", "location"),
            ("Pre-Qualification Details", "pre qualification details"),
            ("Covers / Required Submission", "covers information")
        ]

        for label, key_name in important_fields:
            for k, v in data.items():
                if key_name in k and v and v != "NA":
                    summary_lines.append(f"{label}: {v}")
                    break

        result["extracted_pdf_text"] = "\n".join(summary_lines)
        return result

    @classmethod
    async def extract_from_url(
        cls,
        url: str,
        keyword: Optional[str] = None,
        tender_id: Optional[str] = None,
        tender_title: Optional[str] = None,
        client: Optional[httpx.AsyncClient] = None
    ) -> Dict[str, Any]:
        """
        Fetches the webpage and parses its tender metadata.
        Automatically recovers from 'Stale Session' on GePNIC / CPPP portals.
        """
        if not url:
            return {}

        close_client = False
        if client is None or getattr(client, "is_closed", False):
            client = httpx.AsyncClient(timeout=35.0, follow_redirects=True)
            close_client = True

        try:
            headers = {
                "User-Agent": settings.USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
            res = await client.get(url, headers=headers)
            
            # Check for stale session on CPPP / GePNIC
            is_stale = "stale session" in res.text.lower() or len(res.text) < 2000
            is_gepnic_portal = any(dom in url for dom in ("eprocure.gov.in", "etenders.gov.in", "nicgep", "gepnic", "/eprocure", "/nicgep"))
            
            if (is_stale and is_gepnic_portal) or any(dom in url for dom in ("etenders.gov.in", "eprocure.gov.in")):
                # Perform automated session recovery
                recovered = cls._recover_gepnic_session(url, keyword=keyword, tender_id=tender_id, tender_title=tender_title)
                if recovered and (recovered.get("scope_summary") or recovered.get("extracted_pdf_text")):
                    return recovered

            if res.status_code == 200:
                parsed = cls.parse_html_content(res.text, base_url=str(res.url))
                if parsed and parsed.get("scope_summary"):
                    return parsed

            return {}
        except Exception as e:
            print(f"[HTMLExtractorService] Error extracting from {url}: {e}")
            return {}
        finally:
            if close_client:
                await client.aclose()

    @classmethod
    def _recover_gepnic_session(
        cls,
        portal_url: str,
        keyword: Optional[str] = None,
        tender_id: Optional[str] = None,
        tender_title: Optional[str] = None
    ) -> Dict[str, Any]:
        """Creates a fresh GePNIC session and searches to retrieve the live detail page."""
        try:
            from backend.legacy.bitvivid_tender_tracker import GePNICClient, parse_gepnic, Site
            u = urllib.parse.urlsplit(portal_url)
            home = f"{u.scheme}://{u.netloc}/eprocure/app" if "/eprocure" in u.path else f"{u.scheme}://{u.netloc}/nicgep/app"
            mock_site = Site("portal", "Portal", "gepnic", home)
            
            # Candidate search terms: ALWAYS PRIORITIZE tender_id first!
            terms = []
            if tender_id:
                clean_tid = tender_id.strip()
                if clean_tid:
                    terms.append(clean_tid)
            if keyword:
                for k in keyword.split(","):
                    clean_k = k.strip()
                    if clean_k and len(clean_k) >= 3 and clean_k not in terms:
                        terms.append(clean_k)
            if tender_title:
                words = re.findall(r"\b[A-Za-z]{4,}\b", tender_title)
                for w in words:
                    if w.lower() not in ("tender", "supply", "notice", "works", "department", "india", "enabled", "selection", "model") and w not in terms:
                        terms.append(w)

            for term in terms[:3]:
                client = GePNICClient(home)
                try:
                    page, surl = client.search(term)
                    rows = parse_gepnic(page, surl, mock_site, term)
                    target = None
                    for r in rows:
                        if tender_id and tender_id in str(r.get("tender_id")):
                            target = r
                            break
                        elif tender_id and tender_id in str(r.get("reference")):
                            target = r
                            break
                    if target:
                        detail_html = client.opener.open(target["url"], timeout=25).read().decode("utf-8", "replace")
                        return cls.parse_html_content(detail_html, base_url=target["url"])
                except Exception as ex:
                    print(f"[HTMLExtractorService] search term '{term}' note: {ex}")
                    continue
        except Exception as ex:
            print(f"[HTMLExtractorService] Session recovery failed: {ex}")
        return {}
