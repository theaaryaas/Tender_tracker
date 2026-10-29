import sys
from pathlib import Path

# Ensure root directory is in sys.path to access bitvivid_tender_tracker
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import asyncio
import time
import json
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.repositories.tender_repository import TenderRepository
from backend.repositories.sync_repository import SyncRepository
from backend.models.setting import Setting
from backend.services.eligibility_service import EligibilityService

try:
    from bitvivid_tender_tracker import (
        get_portal_names,
        search_site,
        GeMSession,
        DEFAULT_KEYWORDS as TRACKER_KEYWORDS,
        COMPANY_PROFILE_DEFAULT,
        fetch_and_analyze_pdf,
        assess_eligibility as tracker_assess
    )
    ALL_PORTALS = get_portal_names()
    DEFAULT_KEYWORDS = TRACKER_KEYWORDS
except ImportError:
    ALL_PORTALS = {}
    DEFAULT_KEYWORDS = [
        "CCTV surveillance", "video surveillance system", "AI video analytics",
        "video management system", "VMS", "automatic number plate recognition",
        "ANPR", "intelligent traffic management system", "ITMS",
        "red light violation detection", "facial recognition system", "crowd management",
        "integrated command and control centre", "fire and smoke detection",
        "video analytics", "GenAI video search",
    ]

# Construct PORTALS_DEF for API settings and UI selection (all 23+ portals)
PORTALS_DEF = {
    key: {
        "name": site.name,
        "kind": site.kind,
        "url": site.home,
        "org_contains": getattr(site, "org_contains", ()),
    }
    for key, site in ALL_PORTALS.items()
}
# Backward compatibility aliases
if "uttar_pradesh" in PORTALS_DEF:
    PORTALS_DEF["up"] = PORTALS_DEF["uttar_pradesh"]
if "madhya_pradesh" in PORTALS_DEF:
    PORTALS_DEF["mp"] = PORTALS_DEF["madhya_pradesh"]


class ScraperService:
    _current_sync_state = {
        "is_running": False,
        "progress": 0,
        "current_task": "Idle",
        "found": 0,
        "added": 0,
        "updated": 0,
        "errors": []
    }

    @classmethod
    def get_sync_state(cls) -> Dict[str, Any]:
        return cls._current_sync_state

    @classmethod
    async def run_sync(
        cls,
        db: Session,
        sites: Optional[List[str]] = None,
        keywords: Optional[List[str]] = None,
        gem_pages: int = 3,
        extract_pdfs: bool = False
    ):
        if cls._current_sync_state["is_running"]:
            return

        cls._current_sync_state = {
            "is_running": True,
            "progress": 5,
            "current_task": "Initializing search parameters...",
            "found": 0,
            "added": 0,
            "updated": 0,
            "errors": []
        }

        start_time = time.time()
        sync_log = SyncRepository.create(db, portal_filter=",".join(sites) if sites else "all")

        try:
            # Load company profile for eligibility
            profile_setting = db.query(Setting).filter(Setting.key == "company_profile").first()
            profile = json.loads(profile_setting.value_json) if profile_setting else COMPANY_PROFILE_DEFAULT

            # Map aliases like "up" -> "uttar_pradesh", "mp" -> "madhya_pradesh"
            raw_sites = sites or ["gem"]
            target_sites = []
            for s in raw_sites:
                if s == "up" and "uttar_pradesh" in ALL_PORTALS:
                    target_sites.append("uttar_pradesh")
                elif s == "mp" and "madhya_pradesh" in ALL_PORTALS:
                    target_sites.append("madhya_pradesh")
                elif s in ALL_PORTALS:
                    target_sites.append(s)
                elif s in PORTALS_DEF:
                    target_sites.append(s)

            if not target_sites:
                target_sites = ["gem"]

            target_keywords = keywords or DEFAULT_KEYWORDS

            gem_session = None
            if "gem" in target_sites:
                cls._current_sync_state["current_task"] = "Connecting to GeM BidPlus session..."
                try:
                    gem_session = await asyncio.to_thread(GeMSession, True)
                    await asyncio.to_thread(gem_session.initialise)
                except Exception as exc:
                    err_msg = f"GeM initialization: {exc}"
                    cls._current_sync_state["errors"].append(err_msg)
                    target_sites = [s for s in target_sites if s != "gem"]

            total_operations = len(target_sites) * len(target_keywords)
            completed_ops = 0

            found_items: List[Dict[str, Any]] = []
            errors: List[Dict[str, Any]] = []

            for site_key in target_sites:
                site = ALL_PORTALS.get(site_key)
                portal_name = site.name if site else site_key

                for kw in target_keywords:
                    cls._current_sync_state["current_task"] = f"Searching {portal_name} for '{kw}'..."
                    try:
                        if site_key == "gem" and gem_session:
                            batch = await asyncio.to_thread(gem_session.search, kw, gem_pages)
                        elif site:
                            batch = await asyncio.to_thread(search_site, site, kw, gem_session)
                        else:
                            batch = []
                        found_items.extend(batch)
                    except Exception as exc:
                        err_msg = f"{portal_name} | {kw}: {str(exc)[:100]}"
                        errors.append({"site": site_key, "keyword": kw, "error": str(exc)})
                        cls._current_sync_state["errors"].append(err_msg)

                    completed_ops += 1
                    cls._current_sync_state["progress"] = min(75, int(5 + (completed_ops / max(1, total_operations)) * 70))
                    await asyncio.sleep(0.1)

            # Deduplicate items by tender_id
            deduped: List[Dict[str, Any]] = []
            seen_refs = set()
            for row in found_items:
                code = str(row.get("tender_id") or row.get("reference") or "").strip()
                norm_title = str(row.get("title") or "").strip().lower()
                identity = ("id", code) if code else (str(row.get("site_key", "")), "t", norm_title)
                if identity in seen_refs:
                    continue
                seen_refs.add(identity)
                deduped.append(row)

            # Optional PDF clause extraction
            if extract_pdfs and deduped:
                pdf_targets = [
                    r for r in deduped
                    if r.get("url") and ("showbidDocument" in r.get("url") or r.get("url", "").lower().endswith(".pdf"))
                ]
                total_pdfs = len(pdf_targets)
                for idx, r in enumerate(pdf_targets, 1):
                    code = str(r.get("tender_id") or r.get("reference") or f"Item {idx}")
                    cls._current_sync_state["current_task"] = f"[{idx}/{total_pdfs}] Extracting clauses from PDF for {code}..."
                    cls._current_sync_state["progress"] = min(92, 75 + int((idx / max(1, total_pdfs)) * 17))
                    try:
                        clauses = await asyncio.to_thread(fetch_and_analyze_pdf, r["url"], 25, True)
                        if clauses:
                            if clauses.get("emd"):
                                r["emd"] = clauses["emd"]
                            if clauses.get("turnover"):
                                r["turnover"] = clauses["turnover"]
                            if clauses.get("experience"):
                                r["experience"] = clauses["experience"]
                            if clauses.get("emd") or clauses.get("turnover") or clauses.get("experience"):
                                r["source_note"] = f"Extracted from tender PDF (EMD: {r.get('emd') or 'N/A'}; TO: {r.get('turnover') or 'N/A'})."
                    except Exception as e:
                        pass
                    await asyncio.sleep(0.1)

            # Scoring & Ingestion into Database
            cls._current_sync_state["current_task"] = f"Saving {len(deduped)} tenders into database..."
            cls._current_sync_state["progress"] = 95

            added_count = 0
            updated_count = 0

            for item in deduped:
                code = str(item.get("tender_id") or item.get("reference") or "").strip()
                if not code:
                    continue

                status, partner, notes, score = EligibilityService.assess(
                    item.get("title", ""),
                    item.get("organisation", ""),
                    item.get("matched_keywords", "") or item.get("keyword", ""),
                    profile
                )

                url = str(item.get("url") or "")
                doc_url = url if ("showbidDocument" in url or url.lower().endswith(".pdf")) else ""

                data_to_save = {
                    "tender_id": code,
                    "reference": str(item.get("reference") or code),
                    "portal": str(item.get("portal") or "Public Portal"),
                    "site_key": str(item.get("site_key") or "portal"),
                    "title": str(item.get("title") or "Tender Notice"),
                    "organisation": str(item.get("organisation") or ""),
                    "published_date": str(item.get("published") or item.get("published_date") or ""),
                    "closing_date": str(item.get("closing") or item.get("closing_date") or ""),
                    "opening_date": str(item.get("opening") or item.get("opening_date") or ""),
                    "url": url,
                    "doc_url": doc_url,
                    "estimated_value": str(item.get("estimated_value") or "Check tender PDF / ATC"),
                    "emd_amount": str(item.get("emd") or item.get("emd_amount") or "Check tender PDF / ATC"),
                    "emd_exemption": "Verify MSME / Startup rules",
                    "epbg_required": "Check tender PDF / ATC",
                    "turnover_required": str(item.get("turnover") or item.get("turnover_required") or "Check tender PDF / ATC"),
                    "experience_required": str(item.get("experience") or item.get("experience_required") or "Check tender PDF / ATC"),
                    "scope_summary": "",
                    "extracted_pdf_text": "",
                    "eligibility_assessment": status,
                    "si_partner_route": partner,
                    "matched_keywords": str(item.get("matched_keywords") or item.get("keyword") or ""),
                    "assessment_notes": notes + " " + str(item.get("source_note") or ""),
                    "fit_score": score,
                    "status": "New",
                    "priority": "Normal",
                }

                _, is_new = TenderRepository.upsert(db, data_to_save)
                if is_new:
                    added_count += 1
                else:
                    updated_count += 1

            duration = round(time.time() - start_time, 2)
            SyncRepository.complete(
                db,
                sync_log.id,
                found=len(deduped),
                added=added_count,
                updated=updated_count,
                errors=errors,
                duration=duration,
                status="COMPLETED"
            )

            cls._current_sync_state.update({
                "is_running": False,
                "progress": 100,
                "current_task": f"Sync complete! Found {len(deduped)} ({added_count} new, {updated_count} updated) in {duration}s",
                "found": len(deduped),
                "added": added_count,
                "updated": updated_count
            })

        except Exception as e:
            duration = round(time.time() - start_time, 2)
            SyncRepository.complete(
                db,
                sync_log.id,
                found=0,
                added=0,
                updated=0,
                errors=[{"error": str(e)}],
                duration=duration,
                status="FAILED"
            )
            cls._current_sync_state.update({
                "is_running": False,
                "progress": 100,
                "current_task": f"Sync failed: {str(e)[:100]}"
            })
