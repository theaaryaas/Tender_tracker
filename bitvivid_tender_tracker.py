#!/usr/bin/env python3
"""
BitVivid Tender Tracker
-----------------------
Searches public GeM bids and selected public Indian e-procurement portals,
then creates a formatted Excel workbook. It keeps every discovered tender,
including opportunities that may need an SI/OEM partner.

Important:
- Public tender listings often do NOT expose EMD, turnover or experience clauses.
  The workbook marks these as "Check tender PDF/ATC" when they cannot be verified.
- Eligibility is a screening aid, not a legal/technical bid approval.
- No GeM username, password, OTP, or browser session is requested.
- Uses standard-library networking plus openpyxl for Excel formatting.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from http.cookiejar import CookieJar
from pathlib import Path
import ssl
from typing import Any
from zoneinfo import ZoneInfo

try:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
    from openpyxl.worksheet.table import Table, TableStyleInfo
    from openpyxl.formatting.rule import FormulaRule
    from openpyxl.utils import get_column_letter
except ImportError:
    print("Missing dependency: openpyxl. Install it with: py -m pip install openpyxl", file=sys.stderr)
    raise SystemExit(2)

IST = ZoneInfo("Asia/Kolkata")
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
GEM_BASE = "https://bidplus.gem.gov.in"
GEM_ALL_BIDS = f"{GEM_BASE}/all-bids"
GEM_DATA = f"{GEM_BASE}/all-bids-data"

# Keep search terms focused on BitVivid's actual solution areas. Avoid broad terms
# such as "software development" that generate large volumes of unrelated tenders.
DEFAULT_KEYWORDS = [
    "CCTV surveillance", "video surveillance system", "AI video analytics",
    "video management system", "VMS", "automatic number plate recognition",
    "ANPR", "intelligent traffic management system", "ITMS",
    "red light violation detection", "facial recognition system", "crowd management",
    "integrated command and control centre", "fire and smoke detection",
    "video analytics", "GenAI video search",
]

COMPANY_PROFILE_DEFAULT = {
    "company_name": "BitVivid Solutions Private Limited",
    "msme_status": "Micro Enterprise - Services (verify current Udyam certificate)",
    "udyam_registered": True,
    "dpiit_startup_recognised": True,
    "gem_registered": True,
    "known_certifications": [
        "ISO 9001:2015",
        "ISO 27001:2013",
        "ISO 90003:2018",
        "CMMI Maturity Level 5 (certificate shown in company profile as valid until 08-Nov-2026; verify current status before relying on it)",
    ],
    "known_project_experience": [
        "MP Police ITMS across 8 cities",
        "Magh Mela 2026 surveillance and crowd analytics",
        "Prayagraj Smart City surveillance and analytics",
        "Ghaziabad Safe City surveillance",
        "Bhopal ITMS",
        "Land Ports Authority of India multi-language ANPR",
        "Cotton Corporation of India centralized CCTV",
        "Kumbh 2019 AI crowd surveillance",
    ],
    "average_annual_turnover_inr": None,
    "net_worth_inr": None,
    "blacklisting_status_confirmed": False,
    "current_mafs_and_oem_authorisations": "Verify case by case",
    "direct_bidder_type": "Software/product OEM and solution provider; verify exact tender's bidder definition",
    "notes": (
        "Known company facts are prefilled from previously provided company materials. "
        "Fill financial values only from current CA-certified documents. Never treat this profile "
        "as a substitute for the tender PDF, ATC, corrigenda or bid-specific legal review."
    ),
}

@dataclass
class Site:
    key: str
    name: str
    kind: str
    home: str = ""
    org_contains: tuple[str, ...] = ()
    note: str = ""

SITES: dict[str, Site] = {
    "central": Site("central", "Central eProcurement", "gepnic", "https://eprocure.gov.in/eprocure/app"),
    "psu": Site("psu", "Central PSU eProcurement", "gepnic", "https://etenders.gov.in/eprocure/app"),
    "uttarakhand": Site("uttarakhand", "Uttarakhand eProcurement", "gepnic", "https://uktenders.gov.in/nicgep/app"),
    "rajasthan": Site("rajasthan", "Rajasthan eProcurement", "gepnic", "https://eproc.rajasthan.gov.in/nicgep/app"),
    "bihar": Site("bihar", "Bihar eProc 2", "bihar", "https://eproc2.bihar.gov.in/EPSV2Web/"),
    "uttar_pradesh": Site("uttar_pradesh", "Uttar Pradesh eProcurement", "gepnic", "https://etender.up.nic.in/nicgep/app"),
    "madhya_pradesh": Site("madhya_pradesh", "Madhya Pradesh eProcurement", "gepnic", "https://mptenders.gov.in/nicgep/app"),
    "maharashtra": Site("maharashtra", "Maharashtra eProcurement", "gepnic", "https://mahatenders.gov.in/nicgep/app"),
    "cotton": Site("cotton", "Cotton Corporation of India (ePublishing)", "gepnic",
                   "https://eprocure.gov.in/epublish/app", ("cotton corporation of india",)),
    "defence": Site("defence", "Defence eProcurement", "gepnic", "https://defproc.gov.in/nicgep/app"),
    "ihmcl": Site("ihmcl", "Indian Highways Management Company Limited", "ihmcl", "https://ihmcl.co.in/tenders/"),
    "nhai": Site("nhai", "National Highways Authority of India", "gepnic",
                 "https://etenders.gov.in/eprocure/app", ("national highways authority of india",)),
    "edcil": Site("edcil", "EdCIL / Educational Consultants India Limited (ePublishing)", "gepnic",
                  "https://eprocure.gov.in/epublish/app", ("educational consultants india",)),
    # Added state portals requested for the expanded regional coverage.
    "himachal_pradesh": Site("himachal_pradesh", "Himachal Pradesh eProcurement", "gepnic",
                              "https://hptenders.gov.in/nicgep/app"),
    "jharkhand": Site("jharkhand", "Jharkhand eProcurement", "gepnic",
                      "https://jharkhandtenders.gov.in/nicgep/app"),
    # The legacy NIC portal remains available, but West Bengal has announced a newer
    # portal for fresh e-tenders. Both are represented in the tracker.
    "west_bengal": Site("west_bengal", "West Bengal eProcurement (NIC portal)", "gepnic",
                         "https://tenders.wb.gov.in/nicgep/app"),
    "west_bengal_new": Site("west_bengal_new", "West Bengal e-Tender Portal (new portal)", "htmltable",
                             "https://tenders.wb.gov.in/"),
    "odisha": Site("odisha", "Odisha eProcurement", "gepnic",
                   "https://tendersodisha.gov.in/nicgep/app"),
    "haryana": Site("haryana", "Haryana eProcurement", "gepnic",
                    "https://etenders.hry.nic.in/nicgep/app"),
    # CPWD tenders published on the Central Public Procurement Portal are searched
    # using an organisation filter; CPWD's separate portal is included in the README.
    "cpwd": Site("cpwd", "CPWD tenders (Central eProcurement Portal)", "gepnic",
                 "https://eprocure.gov.in/eprocure/app", ("central public works department", "cpwd")),
    "cpwd_direct": Site("cpwd_direct", "CPWD e-Tender Portal (direct portal; public-page scan)", "htmltable",
                        "https://etender.cpwd.gov.in/"),
    # RailTel publishes on the Government ePublishing portal and its own tender pages.
    "railtel": Site("railtel", "RailTel Corporation of India (official tender listings)", "railtel",
                    "https://www.railtel.in/tenders/active-tenders.html"),
}

OUTPUT_COLUMNS = [
    "Sr No", "Tender ID", "Bid End Date", "Tender Full Name", "Tender Website / Portal",
    "EMD", "Turnover Criteria", "Experience Criteria", "Eligibility Assessment",
    "SI Partner Route", "Tender Link", "Organisation", "Matched Keywords", "Assessment Notes",
]

def clean(fragment: str) -> str:
    fragment = re.sub(r"<br\s*/?>", " ", fragment or "", flags=re.I)
    fragment = re.sub(r"<[^>]+>", " ", fragment)
    fragment = html.unescape(fragment)
    return re.sub(r"\s+", " ", fragment).strip()

def safe_request(url: str, data: bytes | None = None, headers: dict[str, str] | None = None,
                 timeout: int = 45, opener=None) -> tuple[str, str]:
    hdrs = {"User-Agent": USER_AGENT, "Accept-Language": "en-IN,en;q=0.9"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=data, headers=hdrs)
    with (opener.open(req, timeout=timeout) if opener else urllib.request.urlopen(req, timeout=timeout)) as response:
        return response.read().decode("utf-8", "replace"), response.geturl()

def absolute(base: str, href: str) -> str:
    return urllib.parse.urljoin(base, html.unescape(href or ""))

def extract_text_from_pdf_bytes(data: bytes) -> str:
    """Extract text from raw PDF bytes using any installed PDF parser."""
    # 1. Try PyMuPDF (fitz) - fastest and most accurate
    try:
        import fitz
        with fitz.open(stream=data, filetype="pdf") as doc:
            return "\n".join(page.get_text() for page in doc)
    except Exception:
        pass

    # 2. Try pypdf or PyPDF2
    try:
        try:
            from pypdf import PdfReader
        except ImportError:
            from PyPDF2 import PdfReader
        import io
        reader = PdfReader(io.BytesIO(data))
        return "\n".join(p.extract_text() or "" for p in reader.pages)
    except Exception:
        pass

    # 3. Try pdfplumber
    try:
        import pdfplumber, io
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception:
        pass

    return ""

def parse_pdf_clauses(full_text: str) -> dict[str, str]:
    """Parse EMD, Turnover, Experience, and exemptions from extracted PDF text."""
    res = {
        "emd": "",
        "turnover": "",
        "experience": "",
        "epbg": "",
        "estimated_value": "",
    }
    if not full_text or not full_text.strip():
        return res

    # Check Startup & MSE Relaxations
    startup_rel = bool(re.search(r"Startup\s+Relaxation[^\n]*\n\s*Yes", full_text, re.I))
    mse_rel = bool(re.search(r"MSE\s+Relaxation[^\n]*\n\s*Yes", full_text, re.I))

    # 1. EMD
    emd_match = re.search(r"EMD\s+(?:Detail|Amount|Required)[^\n]*?(?:Required|आवश्यकता)?[^\n]*?(No|Yes)", full_text, re.I)
    if emd_match and emd_match.group(1).lower() == "no":
        res["emd"] = "Nil / Not Required"
    else:
        amt_match = re.search(r"EMD\s+(?:Amount|Required|Value)?\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)", full_text, re.I)
        if amt_match and amt_match.group(1).replace(",", "") not in ("0", "00"):
            val = amt_match.group(1).strip()
            res["emd"] = f"₹ {val}" + (" (MSE/Startup exemption applies)" if (mse_rel or startup_rel) else "")
        elif emd_match and emd_match.group(1).lower() == "yes":
            res["emd"] = "Required (See ATC for amount)"
        else:
            if "EMD EXEMPTION" in full_text or "exemption from EMD" in full_text:
                res["emd"] = "Nil / Exempted for MSEs & Startups"

    # 2. Turnover
    m_bidder = re.search(r"Minimum\s+Average\s+Annual\s+Turnover\s+of\s+the\s+bidder[^\n]*\n\s*([0-9.]+\s*(?:Lakh|Crore|Cr|Lakhs)?(?:\s*\(s\))?)", full_text, re.I)
    m_oem = re.search(r"OEM\s+(?:Average\s+)?Turnover[^\n]*\n\s*([0-9.]+\s*(?:Lakh|Crore|Cr|Lakhs)?(?:\s*\(s\))?)", full_text, re.I)
    if m_bidder or m_oem:
        to_parts = []
        if m_bidder:
            to_parts.append(f"Bidder: ₹ {m_bidder.group(1).strip()}")
        if m_oem:
            to_parts.append(f"OEM: ₹ {m_oem.group(1).strip()}")
        to_text = " | ".join(to_parts)
        if startup_rel or mse_rel:
            to_text += " (Exempt for DPIIT Startups / MSEs)"
        res["turnover"] = to_text
    elif startup_rel or mse_rel:
        res["turnover"] = "Exempt for DPIIT Startups & MSEs"
    elif "exemption from Experience / Turnover" in full_text:
        res["turnover"] = "As per ATC (DPIIT/MSE exemption applicable)"

    # 3. Experience
    m_exp_yrs = re.search(r"Years\s+of\s+Past\s+Experience\s+Required[^\n]*\n\s*(\d+\s*Years?(?:\s*\(s\))?)", full_text, re.I)
    if m_exp_yrs:
        res["experience"] = f"Minimum {m_exp_yrs.group(1).strip()} past experience required"
        if startup_rel:
            res["experience"] += " (Exempt for DPIIT Startups)"
    else:
        # Check 1/2/3 order threshold formula
        m1 = re.search(r"One\s+(?:same\s*/\s*similar|similar)?[^\n\r]*?valuing not less than[^\d]*?Rs\.?\s*([0-9, ]+)", full_text, re.I)
        m2 = re.search(r"Two\s+(?:same\s*/\s*similar|similar)?[^\n\r]*?valuing not less than[^\d]*?Rs\.?\s*([0-9, ]+)", full_text, re.I)
        m3 = re.search(r"Three\s+(?:same\s*/\s*similar|similar)?[^\n\r]*?valuing not less than[^\d]*?Rs\.?\s*([0-9, ]+)", full_text, re.I)
        if m1 and m2 and m3:
            res["experience"] = f"Order thresholds: 1 order of ₹{m1.group(1).strip()} | 2 of ₹{m2.group(1).strip()} | 3 of ₹{m3.group(1).strip()}"
        elif startup_rel:
            res["experience"] = "Relevant experience (Exempt for DPIIT Startups with PoC)"

    return res

def fetch_and_analyze_pdf(url: str, timeout: int = 25, insecure: bool = False) -> dict[str, str]:
    """Download a tender PDF and extract clauses using httpx or urllib."""
    data = None
    try:
        import httpx
        with httpx.Client(verify=not insecure, timeout=float(timeout), follow_redirects=True) as client:
            resp = client.get(url, headers={"User-Agent": USER_AGENT, "Accept": "application/pdf,*/*"})
            if resp.status_code == 200 and len(resp.content) >= 500:
                data = resp.content
    except Exception:
        pass

    if not data:
        try:
            ctx = ssl._create_unverified_context() if insecure else None
            req = urllib.request.Request(
                url,
                headers={"User-Agent": USER_AGENT, "Accept": "application/pdf,*/*"}
            )
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as response:
                body = response.read()
                if len(body) >= 500:
                    data = body
        except Exception:
            pass

    if not data:
        return {}

    text = extract_text_from_pdf_bytes(data)
    return parse_pdf_clauses(text)

def get_first(doc: dict[str, Any], *keys: str, default: str = "") -> str:
    for key in keys:
        value = doc.get(key)
        if isinstance(value, list):
            value = value[0] if value else ""
        if value not in (None, ""):
            return str(value)
    return default

def format_gem_date(value: str) -> str:
    if not value:
        return ""
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(IST).strftime("%d-%b-%Y %I:%M %p")
    except Exception:
        return str(value)

class GeMSession:
    """Uses GeM's public bid-listing interface; no login credentials are used."""
    def __init__(self, insecure: bool = False):
        self.jar = CookieJar()
        handlers = [urllib.request.HTTPCookieProcessor(self.jar)]
        if insecure:
            ctx = ssl._create_unverified_context()
            handlers.append(urllib.request.HTTPSHandler(context=ctx))
        self.opener = urllib.request.build_opener(*handlers)
        self.csrf = ""
        self.insecure = insecure

    def request(self, url: str, data: bytes | None = None, headers: dict[str, str] | None = None) -> str:
        hdrs = {"User-Agent": USER_AGENT}
        if headers:
            hdrs.update(headers)
        req = urllib.request.Request(url, data=data, headers=hdrs)
        try:
            with self.opener.open(req, timeout=45) as response:
                return response.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", "replace")
            if exc.code == 404 and body:
                return body
            raise RuntimeError(f"GeM HTTP {exc.code}: {body[:160]}") from exc

    def initialise(self):
        for attempt in range(3):
            try:
                page = self.request(GEM_ALL_BIDS, headers={"Accept": "text/html"})
                match = re.search(r"csrf_bd_gem_nk.*?'([a-f0-9]{32})'", page, flags=re.I | re.S)
                if match:
                    self.csrf = match.group(1)
                    return
            except Exception as e:
                if attempt == 2:
                    raise RuntimeError(f"Could not connect to GeM search after 3 attempts: {e}") from e
                time.sleep(1.5)
        raise RuntimeError("Could not read GeM public-search token; GeM may have changed its page.")

    def post_json(self, url: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.csrf:
            self.initialise()
        body = urllib.parse.urlencode({
            "payload": json.dumps(payload, separators=(",", ":")),
            "csrf_bd_gem_nk": self.csrf,
        }).encode()
        raw = self.request(url, body, {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "Referer": GEM_ALL_BIDS,
            "Origin": GEM_BASE,
            "X-Requested-With": "XMLHttpRequest",
        })
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise RuntimeError("GeM returned an unexpected response instead of JSON.") from exc

    def search(self, keyword: str, max_pages: int = 3) -> list[dict[str, Any]]:
        found: list[dict[str, Any]] = []
        for page_no in range(1, max_pages + 1):
            payload = {
                "page": page_no,
                "param": {"searchBid": keyword, "searchType": "fullText"},
                "filter": {
                    "bidStatusType": "ongoing_bids",
                    "byType": "all",
                    "highBidValue": "",
                    "byEndDate": {"from": "", "to": ""},
                    "sort": "Bid-End-Date-Latest",
                },
            }
            response = self.post_json(GEM_DATA, payload)
            if response.get("code") in (404, "404"):
                break
            if response.get("code") != 200:
                break
            docs = response.get("response", {}).get("response", {}).get("docs", [])
            if not docs:
                break
            for doc in docs:
                bid_id = get_first(doc, "b_id", "bid_id")
                bid_number = get_first(doc, "b_bid_number", "bid_number")
                title = get_first(doc, "bbt_title", "title", "b_category_name")
                category = get_first(doc, "b_category_name", "category")
                org = get_first(doc, "ba_official_details_deptName", "ba_official_details_minName", "organisation")
                end_date = format_gem_date(get_first(doc, "final_end_date_sort", "end_date"))
                start_date = format_gem_date(get_first(doc, "final_start_date_sort", "start_date"))
                link = f"{GEM_BASE}/showbidDocument/{bid_id}" if bid_id else GEM_ALL_BIDS
                found.append({
                    "site_key": "gem", "portal": "GeM BidPlus", "keyword": keyword,
                    "title": title or category or "Tender title not exposed in listing",
                    "reference": bid_number or bid_id, "tender_id": bid_number or bid_id,
                    "organisation": org, "published": start_date, "closing": end_date,
                    "opening": "", "url": link, "emd": "", "turnover": "", "experience": "",
                    "source_note": "Public GeM listing; open bid document/ATC to verify eligibility clauses.",
                })
            time.sleep(1.2)
        return found

class GePNICClient:
    def __init__(self, home: str):
        self.home = home
        self.jar = CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.opener.addheaders = [("User-Agent", USER_AGENT)]

    def search(self, keyword: str) -> tuple[str, str]:
        page, final_url = safe_request(self.home, opener=self.opener)
        match = re.search(r'<form method="post" action="([^"]*)" id="tenderSearch">(.*?)</form>', page, re.S | re.I)
        if not match:
            raise RuntimeError(f"Search form not found at {final_url}")
        action = urllib.parse.urljoin(final_url, html.unescape(match.group(1)))
        hidden = {
            name: html.unescape(value)
            for name, value in re.findall(
                r'<input type="hidden" name="([^"]+)"(?: id="[^"]+")? value="([^"]*)"',
                match.group(2), flags=re.I
            )
        }
        hidden["SearchDescription"] = keyword
        hidden["Go"] = "Go"
        body = urllib.parse.urlencode(hidden).encode()
        hdrs = {"Referer": final_url, "Origin": urllib.parse.urlsplit(final_url).scheme + "://" + urllib.parse.urlsplit(final_url).netloc}
        req = urllib.request.Request(action, data=body, headers=hdrs)
        with self.opener.open(req, timeout=60) as response:
            return response.read().decode("utf-8", "replace"), response.geturl()

def parse_gepnic(page_html: str, page_url: str, site: Site, keyword: str) -> list[dict[str, Any]]:
    rows = []
    for chunk in re.findall(r'<tr class="(?:even|odd)" id="informal_\d+">(.*?)</tr>', page_html, re.S | re.I):
        cells = re.findall(r"<td[^>]*>(.*?)</td>", chunk, re.S | re.I)
        if len(cells) < 6:
            continue
        link_match = re.search(r'href="([^"]+)"[^>]*>(.*?)</a>', cells[4], re.S | re.I)
        title = clean(link_match.group(2)).strip("[]") if link_match else clean(cells[4])
        rest = clean(re.sub(r"<a[\s\S]*?</a>", " ", cells[4], count=1, flags=re.I))
        ids = re.findall(r"\[([^\]]+)\]", rest)
        org = clean(cells[5]).replace("||", " / ")
        if site.org_contains and not any(term in org.lower() for term in site.org_contains):
            continue
        href = absolute(page_url, link_match.group(1)) if link_match else page_url
        rows.append({
            "site_key": site.key, "portal": site.name, "keyword": keyword, "title": title,
            "reference": ids[0] if ids else "", "tender_id": ids[1] if len(ids) > 1 else (ids[0] if ids else ""),
            "organisation": org, "published": clean(cells[1]), "closing": clean(cells[2]),
            "opening": clean(cells[3]), "url": href, "emd": "", "turnover": "", "experience": "",
            "source_note": "Public listing; open tender document/ATC to verify EMD, turnover and experience.",
        })
    return rows

def search_gepnic(site: Site, keyword: str) -> list[dict[str, Any]]:
    client = GePNICClient(site.home)
    page, page_url = client.search(keyword)
    return parse_gepnic(page, page_url, site, keyword)

def search_bihar(site: Site, keyword: str) -> list[dict[str, Any]]:
    # SSL certificate verification remains enabled. If the portal's certificate chain
    # is invalid on this machine, the error is recorded rather than bypassing TLS.
    listing = urllib.parse.urljoin(site.home, "openarea/tenderListingPage.action")
    page, _ = safe_request(listing)
    token_match = re.search(r'id="Authorization" value="([^"]+)"', page)
    org_match = re.search(r"var orgId = '(\d+)'", page)
    if not token_match or not org_match:
        raise RuntimeError("Bihar listing page did not expose the expected public search token.")
    api = urllib.parse.urljoin(site.home, "rest/openarea/getTenderList")
    payload = json.dumps({"orgId": org_match.group(1)}).encode()
    raw, _ = safe_request(api, data=payload, headers={
        "Content-Type": "application/json;charset=utf-8", "Accept": "application/json",
        "Authorization": token_match.group(1),
    }, timeout=90)
    tenders = json.loads(raw)
    rows = []
    needle = keyword.lower()
    for item in tenders:
        title = str(item.get("currentdescription") or item.get("itemTitle") or "")
        reference = str(item.get("currenttenderrefno") or "")
        if needle not in f"{title} {reference}".lower():
            continue
        def epoch(value):
            try:
                millis = int(value)
                if millis < 10**11:
                    return ""
                return datetime.fromtimestamp(millis / 1000, IST).strftime("%d-%b-%Y %I:%M %p")
            except (TypeError, ValueError, OSError):
                return str(value or "")
        rows.append({
            "site_key": site.key, "portal": site.name, "keyword": keyword, "title": clean(title),
            "reference": reference, "tender_id": str(item.get("currenttenderid") or reference),
            "organisation": "Bihar eProc 2", "published": epoch(item.get("currentTenderPublishDate")),
            "closing": epoch(item.get("currentbidEndDate")), "opening": epoch(item.get("currentbidOpenDate")),
            "url": listing, "emd": "", "turnover": "", "experience": "",
            "source_note": "Public listing; open tender document/ATC to verify EMD, turnover and experience.",
        })
    return rows

def search_ihmcl(site: Site, keyword: str) -> list[dict[str, Any]]:
    page, final_url = safe_request(site.home)
    rows = []
    needle = keyword.lower()
    for chunk in re.findall(r"<tr\b[^>]*>.*?</tr>", page, re.S | re.I):
        title_match = re.search(r'class="column-1">(.*?)</td>', chunk, re.S | re.I)
        if not title_match:
            continue
        title = clean(title_match.group(1))
        ref_match = re.search(r'class="column-3">(.*?)</td>', chunk, re.S | re.I)
        ref = clean(ref_match.group(1)) if ref_match else ""
        pub_match = re.search(r'class="column-2">(.*?)</td>', chunk, re.S | re.I)
        published = clean(pub_match.group(1)) if pub_match else ""
        if needle not in f"{title} {ref}".lower():
            continue
        link_match = re.search(r'href="(https?://[^"]+\.pdf)"', chunk, re.I)
        rows.append({
            "site_key": site.key, "portal": site.name, "keyword": keyword, "title": title,
            "reference": ref, "tender_id": ref, "organisation": site.name, "published": published,
            "closing": "", "opening": "", "url": link_match.group(1) if link_match else final_url,
            "emd": "", "turnover": "", "experience": "",
            "source_note": "Public tender page; manually verify deadline and eligibility from the tender PDF.",
        })
    return rows

def search_public_tables(site: Site, keyword: str) -> list[dict[str, Any]]:
    """Best-effort search of public HTML tables on portals without a known NIC form.

    This intentionally does not bypass CAPTCHA, login, JavaScript protections, or access controls.
    If a portal renders its listings only in JavaScript, the search may return no rows and needs
    a portal-specific adapter.
    """
    page, final_url = safe_request(site.home)
    rows: list[dict[str, Any]] = []
    needle = keyword.casefold()
    for chunk in re.findall(r"<tr\b[^>]*>.*?</tr>", page, re.S | re.I):
        cells = re.findall(r"<td\b[^>]*>(.*?)</td>", chunk, re.S | re.I)
        if not cells:
            continue
        cell_text = [clean(c) for c in cells]
        row_text = " ".join(cell_text)
        if needle not in row_text.casefold():
            continue
        links = re.findall(r'<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', chunk, re.S | re.I)
        href = absolute(final_url, links[-1][0]) if links else final_url
        title = cell_text[0] if cell_text else row_text
        reference = ""
        closing = ""
        # Best-effort extraction: first likely reference/date-looking cells.
        for value in cell_text:
            if not reference and re.search(r"(?:/|[-_])(?:20)?\d{2}|\b\d{4}\b", value) and len(value) > 5:
                reference = value
            if not closing and re.search(r"\b\d{1,2}[-/ ][A-Za-z0-9]{3,9}[-/ ]\d{2,4}\b|\b\d{1,2}/\d{1,2}/\d{4}\b", value):
                closing = value
        rows.append({
            "site_key": site.key, "portal": site.name, "keyword": keyword,
            "title": title, "reference": reference, "tender_id": reference,
            "organisation": site.name, "published": "", "closing": closing,
            "opening": "", "url": href, "emd": "", "turnover": "", "experience": "",
            "source_note": "Best-effort public HTML-table scan. If the portal loads tenders dynamically, verify on the official portal; no login/CAPTCHA was bypassed.",
        })
    return rows


def search_railtel(site: Site, keyword: str) -> list[dict[str, Any]]:
    """Search RailTel's public active tender, EOI and limited-tender listings."""
    pages = [
        "https://www.railtel.in/tenders/active-tenders.html",
        "https://www.railtel.in/tenders/expression-of-interest.html",
        "https://www.railtel.in/tenders/lt-quotation.html",
    ]
    needle = keyword.casefold()
    rows: list[dict[str, Any]] = []
    for page_url in pages:
        page, final_url = safe_request(page_url)
        for chunk in re.findall(r"<tr\b[^>]*>.*?</tr>", page, re.S | re.I):
            cells = re.findall(r"<td\b[^>]*>(.*?)</td>", chunk, re.S | re.I)
            if len(cells) < 3:
                continue
            cell_text = [clean(c) for c in cells]
            row_text = " ".join(cell_text)
            if needle not in row_text.casefold():
                continue
            links = re.findall(r'<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', chunk, re.S | re.I)
            href = absolute(final_url, links[-1][0]) if links else final_url
            # RailTel's main active-tender table commonly exposes region, category,
            # tender number, due date and nature of work in that order.
            ref = ""
            closing = ""
            title = row_text
            if len(cell_text) >= 6:
                ref = cell_text[3] if len(cell_text) > 3 else ""
                closing = cell_text[4] if len(cell_text) > 4 else ""
                title = cell_text[5] if len(cell_text) > 5 else row_text
            elif len(cell_text) >= 4:
                ref = cell_text[2]
                closing = cell_text[3]
                title = cell_text[-1]
            rows.append({
                "site_key": site.key, "portal": site.name, "keyword": keyword,
                "title": title, "reference": ref, "tender_id": ref,
                "organisation": "RailTel Corporation of India Limited", "published": "",
                "closing": closing, "opening": "", "url": href,
                "emd": "", "turnover": "", "experience": "",
                "source_note": "Matched on RailTel's public listing; open the official tender detail and document for full dates and eligibility.",
            })
    return rows

def search_site(site: Site, keyword: str, gem_session: GeMSession | None) -> list[dict[str, Any]]:
    if site.kind == "gepnic":
        return search_gepnic(site, keyword)
    if site.kind == "bihar":
        return search_bihar(site, keyword)
    if site.kind == "ihmcl":
        return search_ihmcl(site, keyword)
    if site.kind == "railtel":
        return search_railtel(site, keyword)
    if site.kind == "htmltable":
        return search_public_tables(site, keyword)
    if site.kind == "gem":
        assert gem_session is not None
        return gem_session.search(keyword)
    raise RuntimeError(f"Unknown portal type: {site.kind}")

def keyword_matches(text: str, keywords: list[str]) -> list[str]:
    low = (text or "").lower()
    return [k for k in keywords if k.lower() in low]

def assess_eligibility(row: dict[str, Any], profile: dict[str, Any]) -> tuple[str, str, str]:
    """
    Conservative triage. It never filters out a tender.
    It cannot confirm eligibility from a search listing alone.
    """
    text = " ".join(str(row.get(k, "")) for k in ("title", "organisation", "keyword")).lower()
    technical_terms = (
        "cctv", "camera", "video analytics", "video management", "vms", "surveillance",
        "anpr", "itms", "atms", "traffic", "crowd management", "facial recognition",
        "genai", "generative ai", "artificial intelligence", "command and control",
        "nms", "mlff", "machine learning",
    )
    adjacent_terms = (
        "software", "cyber", "network", "digitisation", "digital", "data center",
        "server", "iot", "automation", "information technology", "application",
    )
    if any(t in text for t in technical_terms):
        status = "Potential direct fit — verify tender clauses"
        partner = "Yes, if bidder/OEM/turnover/EMD clauses require it"
        why = "Tender title/keyword aligns with BitVivid's known AI, VMS, surveillance, ITMS or ANPR experience. This is not final eligibility approval."
    elif any(t in text for t in adjacent_terms):
        status = "Review / possible SI-partner route"
        partner = "Assess SI/OEM partner route; retain tender"
        why = "Adjacent technology opportunity. Review scope, bidder definition, turnover, experience, certifications and subcontracting/consortium rules."
    else:
        status = "Eligibility not determined — manual review"
        partner = "Retain for SI-partner assessment"
        why = "Search result alone does not establish technical fit. Tender is retained rather than excluded."
    if not profile.get("average_annual_turnover_inr"):
        why += " Company turnover figure is not configured, so turnover compliance cannot be confirmed automatically."
    if row.get("emd") in ("", None):
        why += " EMD not reliably exposed in public listing; check bid PDF/ATC."
    return status, partner, why

def load_or_create_profile(path: Path) -> dict[str, Any]:
    if not path.exists():
        path.write_text(json.dumps(COMPANY_PROFILE_DEFAULT, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Created editable company profile: {path}")
        return dict(COMPANY_PROFILE_DEFAULT)
    try:
        user_profile = json.loads(path.read_text(encoding="utf-8"))
        profile = dict(COMPANY_PROFILE_DEFAULT)
        profile.update(user_profile)
        return profile
    except Exception as exc:
        print(f"Could not read {path}: {exc}. Using built-in profile.", file=sys.stderr)
        return dict(COMPANY_PROFILE_DEFAULT)

def get_portal_names() -> dict[str, Site]:
    sites = dict(SITES)
    sites["gem"] = Site("gem", "GeM BidPlus (Government e-Marketplace)", "gem", GEM_ALL_BIDS)
    return sites

def collect(keywords: list[str], site_keys: list[str], delay: float, gem_pages: int,
            analyze_pdfs: bool = False, insecure: bool = False) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    all_sites = get_portal_names()
    unknown = [s for s in site_keys if s not in all_sites]
    if unknown:
        raise ValueError(f"Unknown site keys: {', '.join(unknown)}. Valid keys: {', '.join(all_sites)}")
    rows: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()
    gem_session = None
    if "gem" in site_keys:
        try:
            gem_session = GeMSession(insecure=insecure)
            gem_session.initialise()
        except Exception as exc:
            errors.append({"site": "gem", "keyword": "*", "error": str(exc)})
            print(f"[GeM] Could not initialise public search: {exc}", file=sys.stderr)
            site_keys = [s for s in site_keys if s != "gem"]
    for site_key in site_keys:
        site = all_sites[site_key]
        for keyword in keywords:
            print(f"Searching {site.name} | {keyword} ...", file=sys.stderr)
            try:
                if site.kind == "gem":
                    assert gem_session is not None
                    found = gem_session.search(keyword, max_pages=gem_pages)
                else:
                    found = search_site(site, keyword, gem_session)
            except Exception as exc:
                errors.append({"site": site.key, "keyword": keyword, "error": f"{type(exc).__name__}: {exc}"})
                print(f"  failed: {exc}", file=sys.stderr)
                found = []
            added = 0
            for row in found:
                tender_ref = re.sub(r"\s+", " ", str(row.get("tender_id") or row.get("reference") or "")).strip().lower()
                normalized_title = re.sub(r"\s+", " ", str(row.get("title", "")).lower()).strip()
                # De-duplicate across mirror portals when a stable tender reference exists.
                identity = ("ref", tender_ref) if tender_ref else (str(row.get("site_key", "")), "title", normalized_title)
                if identity in seen:
                    continue
                seen.add(identity)
                rows.append(row)
                added += 1
            print(f"  added {added} tender(s)", file=sys.stderr)
            if delay:
                time.sleep(delay)

    if analyze_pdfs and rows:
        pdf_targets = [
            r for r in rows
            if r.get("url") and ("showbidDocument" in r.get("url") or r.get("url", "").lower().endswith(".pdf"))
        ]
        if pdf_targets:
            print(f"\n[PDF Analysis] Downloading & analyzing PDFs for {len(pdf_targets)} tender(s)...", file=sys.stderr)
            for idx, r in enumerate(pdf_targets, 1):
                label = r.get("tender_id") or r.get("reference") or f"Item {idx}"
                print(f"  [{idx}/{len(pdf_targets)}] Analyzing PDF for {label} ...", file=sys.stderr, end="")
                sys.stderr.flush()
                clauses = fetch_and_analyze_pdf(r["url"], timeout=25, insecure=insecure)
                if clauses:
                    if clauses.get("emd"):
                        r["emd"] = clauses["emd"]
                    if clauses.get("turnover"):
                        r["turnover"] = clauses["turnover"]
                    if clauses.get("experience"):
                        r["experience"] = clauses["experience"]
                    if clauses.get("emd") or clauses.get("turnover") or clauses.get("experience"):
                        r["source_note"] = f"Extracted from tender PDF (EMD: {r.get('emd') or 'N/A'}; Turnover: {r.get('turnover') or 'N/A'})."
                    print(f" done (EMD: {r.get('emd') or 'N/A'}; TO: {r.get('turnover') or 'N/A'})", file=sys.stderr)
                else:
                    print(" skipped / unavailable", file=sys.stderr)
                if delay:
                    time.sleep(min(delay, 0.5))

    return rows, errors

def excel_value(row: dict[str, Any], profile: dict[str, Any]) -> dict[str, Any]:
    title = row.get("title") or ""
    text = f"{title} {row.get('organisation','')} {row.get('keyword','')}"
    tech_keywords = [
        "cctv", "camera", "video analytics", "video management system", "vms", "surveillance",
        "anpr", "itms", "atms", "crowd management", "facial recognition", "frs",
        "generative ai", "genai", "artificial intelligence", "command and control", "nms",
        "intelligent traffic", "software development", "machine learning", "mlff", "cyber security",
    ]
    matched = keyword_matches(text, tech_keywords)
    status, partner, notes = assess_eligibility(row, profile)
    return {
        "Sr No": None,
        "Tender ID": row.get("tender_id") or row.get("reference") or "Not shown",
        "Bid End Date": row.get("closing") or "Not shown in listing",
        "Tender Full Name": title or "Title not exposed in public listing",
        "Tender Website / Portal": row.get("portal") or row.get("site_key") or "",
        "EMD": row.get("emd") or "Check tender PDF / ATC",
        "Turnover Criteria": row.get("turnover") or "Check tender PDF / ATC",
        "Experience Criteria": row.get("experience") or "Check tender PDF / ATC",
        "Eligibility Assessment": status,
        "SI Partner Route": partner,
        "Tender Link": row.get("url") or "",
        "Organisation": row.get("organisation") or "",
        "Matched Keywords": ", ".join(matched or ([row.get("keyword")] if row.get("keyword") else [])),
        "Assessment Notes": notes + " " + str(row.get("source_note") or ""),
    }

def style_workbook(path: Path, rows: list[dict[str, Any]], errors: list[dict[str, str]], profile: dict[str, Any], run_info: dict[str, Any]):
    wb = Workbook()
    ws = wb.active
    ws.title = "Tender Tracker"
    ws.sheet_view.showGridLines = False
    ws.freeze_panes = "A5"

    navy = "17365D"
    blue = "1F4E78"
    teal = "0F6B78"
    light_blue = "D9EAF7"
    pale = "F4F7FB"
    white = "FFFFFF"
    green_fill = "E2F0D9"
    yellow_fill = "FFF2CC"
    orange_fill = "FCE4D6"
    red_fill = "F4CCCC"
    grey = "666666"
    thin_grey = Side(style="thin", color="D9E1F2")

    ws.merge_cells("A1:N1")
    ws["A1"] = "BITVIVID | TENDER DISCOVERY & ELIGIBILITY SCREENING"
    ws["A1"].font = Font(name="Aptos Display", size=16, bold=True, color=white)
    ws["A1"].fill = PatternFill("solid", fgColor=navy)
    ws["A1"].alignment = Alignment(vertical="center")
    ws.row_dimensions[1].height = 32

    ws.merge_cells("A2:N2")
    ws["A2"] = (
        f"Generated {run_info['generated_at']} | {len(rows)} tender record(s) | "
        "Screening aid only — verify the official bid document, ATC and corrigenda before bidding."
    )
    ws["A2"].font = Font(name="Aptos", size=10, italic=True, color=grey)
    ws["A2"].fill = PatternFill("solid", fgColor="EAF2F8")
    ws["A2"].alignment = Alignment(wrap_text=True, vertical="center")
    ws.row_dimensions[2].height = 30

    ws.merge_cells("A3:N3")
    ws["A3"] = (
        "All discovered tenders are retained, including those requiring an SI/OEM partner. "
        "Blank/unknown eligibility fields mean 'verify from tender PDF', not 'no requirement'."
    )
    ws["A3"].font = Font(name="Aptos", size=10, color=blue, bold=True)
    ws["A3"].fill = PatternFill("solid", fgColor=light_blue)
    ws["A3"].alignment = Alignment(wrap_text=True, vertical="center")
    ws.row_dimensions[3].height = 30

    header_row = 4
    for col, header in enumerate(OUTPUT_COLUMNS, 1):
        cell = ws.cell(header_row, col, header)
        cell.font = Font(name="Aptos", bold=True, color=white, size=10)
        cell.fill = PatternFill("solid", fgColor=blue)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = Border(bottom=Side(style="medium", color=teal))
    ws.row_dimensions[header_row].height = 34

    converted = [excel_value(r, profile) for r in rows]
    for idx, record in enumerate(converted, start=1):
        record["Sr No"] = idx
        excel_row = header_row + idx
        for col, header in enumerate(OUTPUT_COLUMNS, 1):
            value = record.get(header, "")
            cell = ws.cell(excel_row, col, value)
            cell.font = Font(name="Aptos", size=10, color="222222")
            cell.alignment = Alignment(vertical="top", wrap_text=True)
            cell.border = Border(bottom=thin_grey)
            if idx % 2 == 0:
                cell.fill = PatternFill("solid", fgColor=pale)
            if header == "Tender Link" and value:
                cell.hyperlink = value
                cell.style = "Hyperlink"
                cell.alignment = Alignment(vertical="top", wrap_text=True)
            if header == "Eligibility Assessment":
                if str(value).startswith("Potential direct fit"):
                    cell.fill = PatternFill("solid", fgColor=green_fill)
                    cell.font = Font(name="Aptos", size=10, bold=True, color="375623")
                elif "partner" in str(value).lower():
                    cell.fill = PatternFill("solid", fgColor=yellow_fill)
                    cell.font = Font(name="Aptos", size=10, bold=True, color="7F6000")
                else:
                    cell.fill = PatternFill("solid", fgColor=orange_fill)
                    cell.font = Font(name="Aptos", size=10, bold=True, color="843C0C")
            if header in ("EMD", "Turnover Criteria", "Experience Criteria") and str(value).startswith("Check tender"):
                cell.font = Font(name="Aptos", size=10, color="9C6500", italic=True)
        ws.row_dimensions[excel_row].height = 54

    last_row = max(header_row + 1, header_row + len(converted))
    if converted:
        tab = Table(displayName="TenderTrackerTable", ref=f"A{header_row}:N{last_row}")
        tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showFirstColumn=False, showLastColumn=False,
                                            showRowStripes=True, showColumnStripes=False)
        ws.add_table(tab)
    ws.auto_filter.ref = f"A{header_row}:N{last_row}"

    widths = {
        "A": 8, "B": 23, "C": 22, "D": 52, "E": 31, "F": 25, "G": 32,
        "H": 34, "I": 35, "J": 34, "K": 46, "L": 34, "M": 27, "N": 68,
    }
    for col, width in widths.items():
        ws.column_dimensions[col].width = width
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.page_setup.orientation = "landscape"
    ws.page_margins.left = 0.25
    ws.page_margins.right = 0.25
    ws.print_title_rows = "1:4"

    # Dashboard sheet
    dash = wb.create_sheet("Dashboard", 0)
    dash.sheet_view.showGridLines = False
    dash.merge_cells("A1:D1")
    dash["A1"] = "BITVIVID TENDER PIPELINE | SUMMARY"
    dash["A1"].font = Font(name="Aptos Display", size=16, bold=True, color=white)
    dash["A1"].fill = PatternFill("solid", fgColor=navy)
    dash["A1"].alignment = Alignment(vertical="center")
    dash.row_dimensions[1].height = 32
    summary = [
        ("Report generated", run_info["generated_at"]),
        ("Tender records found", len(converted)),
        ("Potential direct-fit opportunities", sum(1 for r in converted if str(r["Eligibility Assessment"]).startswith("Potential direct fit"))),
        ("SI-partner / adjacent opportunities", sum(1 for r in converted if "partner" in str(r["Eligibility Assessment"]).lower())),
        ("Manual eligibility review", sum(1 for r in converted if "not determined" in str(r["Eligibility Assessment"]).lower() or "review" in str(r["Eligibility Assessment"]).lower())),
        ("Portal/search errors", len(errors)),
        ("Profile turnover configured", "Yes" if profile.get("average_annual_turnover_inr") else "No — turnover eligibility cannot be confirmed automatically"),
    ]
    for r_idx, (label, value) in enumerate(summary, start=3):
        dash.cell(r_idx, 1, label)
        dash.cell(r_idx, 2, value)
        dash.cell(r_idx, 1).font = Font(name="Aptos", bold=True, color=white)
        dash.cell(r_idx, 1).fill = PatternFill("solid", fgColor=blue)
        dash.cell(r_idx, 2).font = Font(name="Aptos", size=11, color="222222")
        dash.cell(r_idx, 2).fill = PatternFill("solid", fgColor=pale if r_idx % 2 else light_blue)
        dash.cell(r_idx, 1).alignment = Alignment(wrap_text=True, vertical="top")
        dash.cell(r_idx, 2).alignment = Alignment(wrap_text=True, vertical="top")
        dash.cell(r_idx, 1).border = Border(bottom=thin_grey)
        dash.cell(r_idx, 2).border = Border(bottom=thin_grey)
        dash.row_dimensions[r_idx].height = 30

    dash["A12"] = "Important interpretation"
    dash["A12"].font = Font(bold=True, color=white)
    dash["A12"].fill = PatternFill("solid", fgColor=teal)
    dash.merge_cells("A13:D15")
    dash["A13"] = (
        "The workbook deliberately does not reject tenders. A direct-fit label means the subject appears "
        "relevant to BitVivid's known project portfolio, not that every PQ/ATC condition is satisfied. "
        "EMD, turnover and experience are marked for document review unless a public listing exposes a value. "
        "MSE/DPIIT relaxations are tender-specific and must be verified. SI partner route is only a possibility: "
        "check whether consortium, subcontracting, OEM or reseller participation is permitted."
    )
    dash["A13"].alignment = Alignment(wrap_text=True, vertical="top")
    dash["A13"].fill = PatternFill("solid", fgColor="FFF2CC")
    dash["A13"].font = Font(name="Aptos", size=10, color="7F6000")
    dash.row_dimensions[13].height = 36
    dash.row_dimensions[14].height = 28
    dash.row_dimensions[15].height = 28
    dash.column_dimensions["A"].width = 40
    dash.column_dimensions["B"].width = 72
    dash.column_dimensions["C"].width = 24
    dash.column_dimensions["D"].width = 24

    # Errors sheet
    err_ws = wb.create_sheet("Search Errors")
    err_ws.sheet_view.showGridLines = False
    err_ws.append(["Portal Key", "Keyword", "Error"])
    for c in err_ws[1]:
        c.font = Font(bold=True, color=white)
        c.fill = PatternFill("solid", fgColor=blue)
        c.alignment = Alignment(wrap_text=True, vertical="center")
    for error in errors:
        err_ws.append([error.get("site", ""), error.get("keyword", ""), error.get("error", "")])
    err_ws.freeze_panes = "A2"
    err_ws.auto_filter.ref = err_ws.dimensions
    err_ws.column_dimensions["A"].width = 22
    err_ws.column_dimensions["B"].width = 28
    err_ws.column_dimensions["C"].width = 100
    for row in err_ws.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            cell.border = Border(bottom=thin_grey)

    # Company profile sheet
    prof_ws = wb.create_sheet("Company Profile")
    prof_ws.sheet_view.showGridLines = False
    prof_ws.append(["Profile field", "Value", "How to use / caution"])
    for c in prof_ws[1]:
        c.font = Font(bold=True, color=white)
        c.fill = PatternFill("solid", fgColor=blue)
        c.alignment = Alignment(wrap_text=True)
    cautions = {
        "average_annual_turnover_inr": "Fill only from current CA-certified figures. Blank means the script cannot confirm turnover compliance.",
        "net_worth_inr": "Fill only from current audited/CA-certified records.",
        "msme_status": "Verify current Udyam certificate and the exact tender's MSE eligibility rules.",
        "known_certifications": "Confirm validity and scope before claiming compliance.",
        "known_project_experience": "Only cite projects for which documentary evidence and eligible order values/periods are available.",
        "current_mafs_and_oem_authorisations": "Tender-specific. Confirm current valid authorization and OEM documents.",
    }
    for key, value in profile.items():
        if isinstance(value, (list, dict)):
            display = json.dumps(value, ensure_ascii=False)
        else:
            display = "" if value is None else value
        prof_ws.append([key, display, cautions.get(key, "")])
    prof_ws.freeze_panes = "A2"
    prof_ws.auto_filter.ref = prof_ws.dimensions
    prof_ws.column_dimensions["A"].width = 38
    prof_ws.column_dimensions["B"].width = 90
    prof_ws.column_dimensions["C"].width = 88
    for row in prof_ws.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            cell.border = Border(bottom=thin_grey)
    wb.save(path)

def sync_to_database(
    rows: list[dict[str, Any]],
    profile: dict[str, Any],
    errors: list[dict[str, str]],
    site_keys: list[str],
    db_path: Path | None = None
) -> tuple[int, int]:
    """Sync collected tender records directly into backend SQLite database (tenders.db)."""
    import sqlite3
    from datetime import datetime, timezone

    if db_path is None:
        db_path = Path(__file__).resolve().parent / "backend" / "tenders.db"

    if not db_path.parent.exists():
        return 0, 0

    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        # Check if tenders table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tenders'")
        if not cursor.fetchone():
            try:
                from backend.core.db import Base, engine
                Base.metadata.create_all(bind=engine)
            except Exception:
                pass

        now_iso = datetime.now(timezone.utc).isoformat()
        added_count = 0
        updated_count = 0

        for row in rows:
            code = str(row.get("tender_id") or row.get("reference") or "").strip()
            if not code:
                continue

            status, partner, notes = assess_eligibility(row, profile)
            score = 85 if "potential direct fit" in status.lower() else (65 if "partner" in status.lower() else 50)
            if profile.get("udyam_registered") or profile.get("dpiit_startup_recognised"):
                score = min(100, score + 5)

            url = str(row.get("url") or "")
            doc_url = url if ("showbidDocument" in url or url.lower().endswith(".pdf")) else ""

            cursor.execute("SELECT id FROM tenders WHERE tender_id = ?", (code,))
            existing = cursor.fetchone()

            if existing:
                cursor.execute("""
                    UPDATE tenders SET
                        reference = ?,
                        portal = ?,
                        site_key = ?,
                        title = ?,
                        organisation = ?,
                        published_date = COALESCE(NULLIF(?, ''), published_date),
                        closing_date = COALESCE(NULLIF(?, ''), closing_date),
                        opening_date = COALESCE(NULLIF(?, ''), opening_date),
                        url = ?,
                        doc_url = ?,
                        estimated_value = COALESCE(NULLIF(?, ''), estimated_value),
                        emd_amount = COALESCE(NULLIF(?, ''), emd_amount),
                        turnover_required = COALESCE(NULLIF(?, ''), turnover_required),
                        experience_required = COALESCE(NULLIF(?, ''), experience_required),
                        eligibility_assessment = ?,
                        si_partner_route = ?,
                        matched_keywords = ?,
                        assessment_notes = ?,
                        fit_score = ?,
                        updated_at = ?
                    WHERE tender_id = ?
                """, (
                    str(row.get("reference") or code),
                    str(row.get("portal") or "GeM BidPlus"),
                    str(row.get("site_key") or "gem"),
                    str(row.get("title") or "Tender Notice"),
                    str(row.get("organisation") or ""),
                    str(row.get("published") or ""),
                    str(row.get("closing") or ""),
                    str(row.get("opening") or ""),
                    url,
                    doc_url,
                    str(row.get("estimated_value") or ""),
                    str(row.get("emd") or ""),
                    str(row.get("turnover") or ""),
                    str(row.get("experience") or ""),
                    status,
                    partner,
                    str(row.get("keyword") or ""),
                    notes + " " + str(row.get("source_note") or ""),
                    score,
                    now_iso,
                    code
                ))
                updated_count += 1
            else:
                cursor.execute("""
                    INSERT INTO tenders (
                        tender_id, reference, portal, site_key, title, organisation,
                        published_date, closing_date, opening_date, url, doc_url,
                        estimated_value, emd_amount, emd_exemption, epbg_required,
                        turnover_required, experience_required, scope_summary, extracted_pdf_text,
                        eligibility_assessment, si_partner_route, matched_keywords,
                        assessment_notes, fit_score, status, priority, user_notes,
                        assigned_to, is_starred, created_at, updated_at
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?,
                        ?, ?, ?, ?,
                        ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?
                    )
                """, (
                    code,
                    str(row.get("reference") or code),
                    str(row.get("portal") or "GeM BidPlus"),
                    str(row.get("site_key") or "gem"),
                    str(row.get("title") or "Tender Notice"),
                    str(row.get("organisation") or ""),
                    str(row.get("published") or ""),
                    str(row.get("closing") or ""),
                    str(row.get("opening") or ""),
                    url,
                    doc_url,
                    str(row.get("estimated_value") or "Check tender PDF / ATC"),
                    str(row.get("emd") or "Check tender PDF / ATC"),
                    "Verify MSME / Startup rules",
                    "Check tender PDF / ATC",
                    str(row.get("turnover") or "Check tender PDF / ATC"),
                    str(row.get("experience") or "Check tender PDF / ATC"),
                    "",
                    "",
                    status,
                    partner,
                    str(row.get("keyword") or ""),
                    notes + " " + str(row.get("source_note") or ""),
                    score,
                    "New",
                    "Normal",
                    "",
                    None,
                    0,
                    now_iso,
                    now_iso
                ))
                added_count += 1

        try:
            cursor.execute("""
                INSERT INTO sync_logs (
                    status, portal_filter, tenders_found, tenders_added,
                    tenders_updated, error_count, error_details, duration_seconds,
                    started_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                "COMPLETED",
                ",".join(site_keys),
                len(rows),
                added_count,
                updated_count,
                len(errors),
                json.dumps(errors),
                0.0,
                now_iso,
                now_iso
            ))
        except Exception:
            pass

        conn.commit()
        conn.close()
        return added_count, updated_count
    except Exception as e:
        print(f"[Database Sync Warning] Could not sync to database: {e}", file=sys.stderr)
        return 0, 0

def main():
    parser = argparse.ArgumentParser(description="Find public tenders and create a polished BitVivid Excel tracker.")
    parser.add_argument("--keywords", default=",".join(DEFAULT_KEYWORDS),
                        help="Comma-separated keywords. Default includes BitVivid's AI/ITMS/VMS terms.")
    parser.add_argument("--sites", default="gem," + ",".join(SITES.keys()),
                        help="Comma-separated portal keys. Use 'gem' for GeM. Available: " + ", ".join(["gem"] + list(SITES.keys())))
    parser.add_argument("--output", default="BitVivid_Tender_Tracker.xlsx", help="Excel output filename.")
    parser.add_argument("--profile", default="company_profile.json", help="Editable company profile JSON.")
    parser.add_argument("--delay", type=float, default=1.2, help="Seconds between portal searches.")
    parser.add_argument("--gem-pages", type=int, default=3, help="Maximum GeM result pages per keyword (about 10 results/page).")
    parser.add_argument("--csv", default="BitVivid_Tender_Tracker.csv", help="Optional flat CSV output.")
    parser.add_argument("--analyze-pdfs", action="store_true",
                        help="Download tender PDFs and extract actual EMD, turnover, and experience clauses.")
    parser.add_argument("--insecure", action="store_true",
                        help="Allow unverified SSL certificates (bypass CERTIFICATE_VERIFY_FAILED).")
    parser.add_argument("--no-db", action="store_true",
                        help="Skip syncing scraped results into backend/tenders.db.")
    args = parser.parse_args()

    if args.insecure:
        ssl._create_default_https_context = ssl._create_unverified_context
        try:
            import urllib3
            urllib3.disable_warnings()
        except ImportError:
            pass

    keywords = [x.strip() for x in args.keywords.split(",") if x.strip()]
    site_keys = [x.strip() for x in args.sites.split(",") if x.strip()]
    if not keywords:
        print("Please provide at least one keyword.", file=sys.stderr)
        raise SystemExit(2)
    if args.gem_pages < 1:
        print("--gem-pages must be at least 1.", file=sys.stderr)
        raise SystemExit(2)

    profile = load_or_create_profile(Path(args.profile))
    print("Starting public tender search. No account credentials are used.")
    if args.insecure:
        print("Notice: SSL certificate verification disabled (--insecure).")
    if args.analyze_pdfs:
        print("Notice: PDF clause extraction enabled (--analyze-pdfs).")

    rows, errors = collect(
        keywords, site_keys, max(0, args.delay), args.gem_pages,
        analyze_pdfs=args.analyze_pdfs, insecure=args.insecure
    )
    run_info = {"generated_at": datetime.now(IST).strftime("%d-%b-%Y %I:%M %p IST")}
    output_path = Path(args.output).resolve()
    style_workbook(output_path, rows, errors, profile, run_info)
    print(f"\nExcel workbook created: {output_path}")
    if args.csv:
        csv_path = Path(args.csv).resolve()
        records = [excel_value(row, profile) for row in rows]
        for i, rec in enumerate(records, 1):
            rec["Sr No"] = i
        with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS)
            writer.writeheader()
            writer.writerows(records)
        print(f"CSV created: {csv_path}")

    if not args.no_db:
        db_path = Path(__file__).resolve().parent / "backend" / "tenders.db"
        added_cnt, updated_cnt = sync_to_database(rows, profile, errors, site_keys, db_path=db_path)
        if added_cnt or updated_cnt:
            print(f"Backend Database synced: {added_cnt} new tender(s) added, {updated_cnt} updated in {db_path.name}")
            print("All records are immediately visible in the Web Dashboard (http://localhost:5173).")

    print(f"Tender records: {len(rows)} | Search errors: {len(errors)}")
    print("Important: verify every bid on the official portal and read its full bid document, ATC and corrigenda.")
    if errors:
        print("Some portal/keyword searches failed. Open the 'Search Errors' worksheet.")
    print("If GeM changes its public page/API, GeM search may need an update; the script will log the error rather than ask for your login.")

if __name__ == "__main__":
    main()
