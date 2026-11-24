import re
import json
import httpx
import asyncio
from typing import List, Dict, Any, Optional, Set
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from backend.models.tender import Tender
from backend.models.crm_record import CRMRecord
from backend.models.setting import Setting
from backend.core.date_utils import parse_closing_datetime, IST
from backend.services.pdf_service import PDFService
from backend.core.config import settings

EMAIL_REGEX = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b')

IGNORED_DOMAINS = {
    'example.com', 'domain.com', 'test.com', 'sample.com', 
    'sample.gov.in', 'email.com', 'xyz.com', 'abc.com', 'tender.gov.in'
}
IGNORED_PREFIXES = {
    'noreply', 'no-reply', 'donotreply', 'helpdesk'
}

class ContactService:
    # Live background extraction state
    _current_extract_state: Dict[str, Any] = {
        "is_running": False,
        "progress": 0,
        "processed": 0,
        "target": 0,
        "discovered_emails": 0,
        "current_task": "Idle",
        "latest_email": None,
        "error": None
    }

    @classmethod
    def get_extract_state(cls) -> Dict[str, Any]:
        return dict(cls._current_extract_state)

    @staticmethod
    def extract_emails(text: Optional[str]) -> List[str]:
        """
        Dynamically extracts official buyer & officer emails from genuine tender text layers.
        Looks for official procurement label patterns first, then general email patterns.
        """
        if not text:
            return []
            
        emails = []
        # 1. Targeted labeled fields common in GeM and CPPP bid specifications
        labeled_patterns = [
            r'Buyer\s*(?:/\s*Consignee)?\s*Email\s*(?:id|ID)?\s*[:\n\-]+\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})',
            r'HOD\s*Email\s*(?:id|ID)?\s*[:\n\-]+\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})',
            r'Email\s*(?:id|ID|Address)?\s*[:\n\-]+\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})',
            r'Contact\s*Email\s*[:\n\-]+\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})',
            r'E-mail\s*[:\n\-]+\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})',
            r'Nodal\s*Officer\s*Email\s*[:\n\-]+\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})',
        ]
        for p in labeled_patterns:
            for m in re.findall(p, text, re.IGNORECASE):
                em = m.strip().lower()
                if em not in emails and '@' in em:
                    emails.append(em)

        # 2. General pattern matching across genuine tender text
        for em in EMAIL_REGEX.findall(text):
            em_clean = em.strip().lower().rstrip('.')
            domain = em_clean.split('@')[-1]
            if domain in IGNORED_DOMAINS:
                continue
            if any(em_clean.startswith(prefix) for prefix in IGNORED_PREFIXES):
                continue
            if em_clean.endswith(('.png', '.jpg', '.jpeg', '.gif', '.pdf', '.svg', '.doc', '.xlsx', '.rar', '.zip')):
                continue
            if em_clean not in emails:
                emails.append(em_clean)
                
        return emails

    @classmethod
    def get_custom_emails_map(cls, db: Session) -> Dict[str, str]:
        """Retrieves user manually entered contact emails from Settings table."""
        try:
            setting = db.query(Setting).filter(Setting.key == "company_custom_emails").first()
            if setting and setting.value_json:
                return json.loads(setting.value_json)
        except Exception:
            pass
        return {}

    @classmethod
    def set_custom_email(cls, db: Session, company_name: str, email: str) -> bool:
        """Saves a custom email override for a company name."""
        try:
            setting = db.query(Setting).filter(Setting.key == "company_custom_emails").first()
            current_map = {}
            if setting and setting.value_json:
                current_map = json.loads(setting.value_json)
            
            clean_name = company_name.strip()
            clean_email = email.strip().lower()
            current_map[clean_name] = clean_email
            current_map[clean_name.lower()] = clean_email

            if not setting:
                setting = Setting(
                    key="company_custom_emails",
                    value_json=json.dumps(current_map),
                    description="User overrides for company contact emails"
                )
                db.add(setting)
            else:
                setting.value_json = json.dumps(current_map)
                setting.updated_at = datetime.now(timezone.utc)
            
            db.commit()
            return True
        except Exception:
            db.rollback()
            return False

    @classmethod
    def get_aggregated_contacts(
        cls,
        db: Session,
        search: Optional[str] = None,
        portal: Optional[str] = None,
        has_email_only: bool = False,
        sort_by: str = "tender_count", # 'tender_count' | 'company' | 'email' | 'latest_date'
        sort_desc: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Scans all tenders and CRM records, grouping strictly BY COMPANY NAME.
        Guarantees STRICT de-duplication:
        - 1 company = 1 record.
        - NEVER splits into duplicate rows for the same company.
        - Gathers all dynamically extracted emails across all tenders for that company.
        - If not extracted yet, email is None (displayed as 'Notice Not Parsed Yet' with Extract button).
        """
        # Fetch tenders and CRM records
        tenders = db.query(Tender).all()
        try:
            crm_records = db.query(CRMRecord).all()
        except Exception:
            crm_records = []

        custom_emails_map = cls.get_custom_emails_map(db)

        # Build CRM email lookup by normalized company name
        crm_email_map: Dict[str, List[str]] = {}
        for c in crm_records:
            if c.company_name and c.client_email:
                key = c.company_name.strip().lower()
                crm_email_map.setdefault(key, [])
                em = c.client_email.strip().lower()
                if em not in crm_email_map[key]:
                    crm_email_map[key].append(em)

        # Primary company aggregation dictionary (1 company = 1 entry)
        company_map: Dict[str, Dict[str, Any]] = {}

        for t in tenders:
            org = (t.organisation or '').strip()
            if not org or org.lower() in ('na', 'n/a', 'check tender', '-', 'none', 'unknown'):
                org = "Public Procurement Buyer"

            # Apply portal filter if specified
            if portal and portal.lower() != 'all':
                if portal.lower() not in (t.portal or '').lower():
                    continue

            org_norm = org.lower()

            if org_norm not in company_map:
                company_map[org_norm] = {
                    "id": f"c_{abs(hash(org_norm)) % 100000000}",
                    "company_name": org,
                    "extracted_emails": set(),
                    "tender_count": 0,
                    "tender_ids": [],
                    "tenders_info": [],
                    "portals": set(),
                    "latest_closing_date": "",
                    "latest_dt": None,
                    "latest_tender_title": t.title,
                    "site_keys": set(),
                    "unextracted_tender_ids": [],
                    "has_tender_notice_text": False,
                    "email_sources": {}
                }

            entry = company_map[org_norm]

            # Check if this tender document has been parsed
            has_text = bool(t.extracted_pdf_text and len(t.extracted_pdf_text.strip()) > 30)
            if has_text:
                entry["has_tender_notice_text"] = True

            # Extract genuine emails embedded in this tender's text layer
            text_corpus = f"{t.extracted_pdf_text or ''}\n{t.scope_summary or ''}\n{t.user_notes or ''}\n{t.title or ''}"
            tender_emails = cls.extract_emails(text_corpus)
            for em in tender_emails:
                em_clean = em.strip().lower()
                entry["extracted_emails"].add(em_clean)
                
                # Capture credibility source context for every discovered email
                if em_clean not in entry["email_sources"] or (not entry["email_sources"][em_clean].get("doc_url") and t.doc_url):
                    role = "Procurement Notice Contact"
                    if t.extracted_pdf_text:
                        for line in t.extracted_pdf_text.split('\n'):
                            line_l = line.lower()
                            if "hod email" in line_l and em_clean in line_l:
                                role = "Head of Department (HOD)"
                                break
                            elif ("buyer email" in line_l or "buyer/consignee" in line_l or "consignee email" in line_l) and em_clean in line_l:
                                role = "Buyer / Consignee Officer"
                                break
                            elif "nodal officer" in line_l and em_clean in line_l:
                                role = "Nodal Officer"
                                break

                    domain = em_clean.split('@')[-1]
                    org_unit = t.organisation or "Procurement Authority"
                    if "dpsdae.gov.in" in domain:
                        org_unit = "Directorate of Purchase & Stores (DPS-DAE)"
                    elif "npcil.co.in" in domain:
                        org_unit = "Nuclear Power Corp of India (NPCIL - DAE PSU)"
                    elif "actrec.gov.in" in domain or "tmcactrec" in em_clean:
                        org_unit = "Tata Memorial Centre / ACTREC (DAE)"
                    elif "navy.gov.in" in domain:
                        org_unit = "Indian Navy Procurement Wing"
                    elif "railnet.gov.in" in domain:
                        org_unit = "Indian Railways"
                    elif "powergrid.in" in domain:
                        org_unit = "Power Grid Corp. of India"
                    elif "sail.in" in domain:
                        org_unit = "Steel Authority of India (SAIL)"
                    elif "bhel.in" in domain:
                        org_unit = "Bharat Heavy Electricals (BHEL)"
                    elif "coalindia.in" in domain:
                        org_unit = "Coal India Limited"
                    elif "oilindia.in" in domain:
                        org_unit = "Oil India Limited"

                    entry["email_sources"][em_clean] = {
                        "email": em_clean,
                        "role": role,
                        "org_unit": org_unit,
                        "tender_id": t.tender_id or str(t.id),
                        "tender_title": t.title,
                        "doc_url": t.doc_url or t.url
                    }

            t_code = t.tender_id or str(t.id)
            if t_code not in entry["tender_ids"]:
                entry["tender_count"] += 1
                entry["tender_ids"].append(t_code)
                entry["tenders_info"].append({
                    "id": t.id,
                    "tender_id": t_code,
                    "title": t.title,
                    "closing_date": t.closing_date or "N/A",
                    "portal": t.portal or "GeM BidPlus",
                    "has_text": has_text
                })

                if not has_text:
                    entry["unextracted_tender_ids"].append(t.id)

            if t.portal:
                entry["portals"].add(t.portal)
            if t.site_key:
                entry["site_keys"].add(t.site_key)

            # Track latest closing date
            if t.closing_date:
                dt = parse_closing_datetime(t.closing_date)
                if dt:
                    if not entry["latest_dt"] or dt > entry["latest_dt"]:
                        entry["latest_dt"] = dt
                        entry["latest_closing_date"] = t.closing_date
                        entry["latest_tender_title"] = t.title
                elif not entry["latest_closing_date"]:
                    entry["latest_closing_date"] = t.closing_date

        # Compile final consolidated records
        result = []
        for org_norm, entry in company_map.items():
            # 1. Custom user override (if user typed/saved one)
            custom_em = custom_emails_map.get(org_norm) or custom_emails_map.get(entry["company_name"])
            
            # 2. Extracted notice emails (real dynamic emails from PDF notices)
            notice_emails = sorted(list(entry["extracted_emails"]))

            # 3. CRM emails
            crm_emails = crm_email_map.get(org_norm, [])

            primary_email = None
            email_source = None

            if custom_em:
                primary_email = custom_em
                email_source = "User Custom Override"
            elif notice_emails:
                primary_email = notice_emails[0]
                email_source = "Dynamic Portal Extract"
            elif crm_emails:
                primary_email = crm_emails[0]
                email_source = "CRM Contact"

            # Combine all distinct emails for this company
            all_emails_set = set()
            if primary_email:
                all_emails_set.add(primary_email)
            for em in notice_emails:
                all_emails_set.add(em)
            for em in crm_emails:
                all_emails_set.add(em)

            all_emails = sorted(list(all_emails_set))
            officer_emails = [e for e in all_emails if e != primary_email]

            # Build rich credibility details for each officer email
            officer_details = []
            for em in officer_emails:
                if em in entry["email_sources"]:
                    officer_details.append(entry["email_sources"][em])
                else:
                    officer_details.append({
                        "email": em,
                        "role": "Officer Contact",
                        "org_unit": entry["company_name"],
                        "tender_id": entry["tender_ids"][0] if entry["tender_ids"] else None,
                        "tender_title": entry["latest_tender_title"],
                        "doc_url": None
                    })

            primary_detail = entry["email_sources"].get(primary_email) if primary_email else None

            # Primary tender ID associated with the email
            primary_tender_id = None
            if primary_detail and primary_detail.get("tender_id"):
                primary_tender_id = primary_detail["tender_id"]
            elif entry["tender_ids"]:
                primary_tender_id = entry["tender_ids"][0]

            final_entry = {
                "id": entry["id"],
                "company_name": entry["company_name"],
                "email": primary_email,
                "email_source": email_source,
                "primary_tender_id": primary_tender_id,
                "primary_detail": primary_detail,
                "all_emails": all_emails,
                "officer_emails": officer_emails,
                "officer_details": officer_details,
                "tender_count": entry["tender_count"],
                "tender_ids": entry["tender_ids"],
                "tenders_info": entry["tenders_info"],
                "unextracted_count": len(entry["unextracted_tender_ids"]),
                "portals": sorted(list(entry["portals"])),
                "site_keys": sorted(list(entry["site_keys"])),
                "latest_closing_date": entry["latest_closing_date"],
                "latest_dt": entry["latest_dt"],
                "latest_tender_title": entry["latest_tender_title"],
                "has_tender_notice_text": entry["has_tender_notice_text"],
                "is_custom": bool(custom_em)
            }

            # Optional filter: has email only
            if has_email_only and not final_entry["email"]:
                continue

            # Search filter
            if search:
                s_lower = search.strip().lower()
                matches_company = s_lower in final_entry["company_name"].lower()
                matches_email = any(s_lower in e.lower() for e in all_emails)
                matches_tenders = any(s_lower in tid.lower() for tid in final_entry["tender_ids"])
                matches_portals = any(s_lower in p.lower() for p in final_entry["portals"])
                if not (matches_company or matches_email or matches_tenders or matches_portals):
                    continue

            result.append(final_entry)

        # Sorting
        if sort_by == "company":
            result.sort(key=lambda x: x["company_name"].lower(), reverse=sort_desc)
        elif sort_by == "email":
            result.sort(key=lambda x: (bool(x["email"]), (x["email"] or "").lower()), reverse=sort_desc)
        elif sort_by == "latest_date":
            result.sort(key=lambda x: (x["latest_dt"] or datetime.min.replace(tzinfo=IST)), reverse=sort_desc)
        else: # Default: Most Bids / Tenders, then whether email is available
            result.sort(key=lambda x: (x["tender_count"], bool(x["email"])), reverse=sort_desc)

        return result

    @classmethod
    async def run_extraction_background(
        cls,
        db_factory,
        limit: int = 25,
        company_name: Optional[str] = None
    ):
        """
        Background worker that processes tenders with parallel concurrency.
        Updates cls._current_extract_state live so frontend polls without any 504 timeouts.
        """
        if cls._current_extract_state["is_running"]:
            return

        cls._current_extract_state = {
            "is_running": True,
            "progress": 0,
            "processed": 0,
            "target": limit,
            "discovered_emails": 0,
            "current_task": "Initializing notice documents list...",
            "latest_email": None,
            "error": None
        }

        db = db_factory()
        try:
            # Query unparsed tenders
            query = db.query(Tender).filter(
                (Tender.extracted_pdf_text == None) | (Tender.extracted_pdf_text == "")
            )
            if company_name:
                query = query.filter(Tender.organisation.ilike(f"%{company_name.strip()}%"))

            unparsed_tenders = query.filter(
                (Tender.doc_url != None) | (Tender.url != None)
            ).order_by(Tender.id.desc()).limit(limit).all()

            total_targets = len(unparsed_tenders)
            cls._current_extract_state["target"] = total_targets

            if total_targets == 0:
                cls._current_extract_state.update({
                    "is_running": False,
                    "progress": 100,
                    "current_task": "All target tender notices are already parsed!"
                })
                return

            cls._current_extract_state["current_task"] = f"Downloading & parsing {total_targets} live notices..."

            # Concurrency semaphore for fast parallel downloading (up to 6 concurrent requests)
            sem = asyncio.Semaphore(6)
            headers = {
                "User-Agent": settings.USER_AGENT,
                "Accept": "application/pdf,*/*"
            }

            discovered_set: Set[str] = set()
            processed_count = 0

            async with httpx.AsyncClient(timeout=45.0, follow_redirects=True, headers=headers) as client:
                async def process_single_tender(tender_id_int: int):
                    nonlocal processed_count
                    async with sem:
                        # Dedicated db session per worker for thread safety
                        t_db = db_factory()
                        try:
                            t = t_db.query(Tender).filter(Tender.id == tender_id_int).first()
                            if not t:
                                return
                            target_url = t.doc_url or t.url
                            if not target_url:
                                return

                            clauses = await PDFService.extract_clauses_from_url(
                                target_url,
                                client=client,
                                keyword=t.matched_keywords,
                                tender_id=t.tender_id,
                                tender_title=t.title
                            )

                            for k, v in clauses.items():
                                if v and hasattr(t, k):
                                    setattr(t, k, v)

                            # Extract emails
                            txt = clauses.get("extracted_pdf_text", "")
                            found = cls.extract_emails(txt)
                            for em in found:
                                em_clean = em.strip().lower()
                                if em_clean not in discovered_set:
                                    discovered_set.add(em_clean)
                                    cls._current_extract_state["latest_email"] = em_clean

                            t_db.commit()
                        except Exception as exc:
                            t_db.rollback()
                        finally:
                            t_db.close()
                            processed_count += 1
                            pct = int((processed_count / max(1, total_targets)) * 100)
                            cls._current_extract_state["processed"] = processed_count
                            cls._current_extract_state["progress"] = min(99, pct)
                            cls._current_extract_state["discovered_emails"] = len(discovered_set)
                            cls._current_extract_state["current_task"] = (
                                f"Parsed [{processed_count}/{total_targets}] notices — Found {len(discovered_set)} buyer emails"
                            )

                # Fan-out parallel processing
                tasks = [process_single_tender(t.id) for t in unparsed_tenders]
                await asyncio.gather(*tasks)

            cls._current_extract_state.update({
                "is_running": False,
                "progress": 100,
                "processed": processed_count,
                "discovered_emails": len(discovered_set),
                "current_task": f"Complete! Parsed {processed_count} notices and discovered {len(discovered_set)} genuine buyer emails."
            })

        except Exception as e:
            cls._current_extract_state.update({
                "is_running": False,
                "progress": 100,
                "error": str(e),
                "current_task": f"Extraction encountered an issue: {str(e)[:100]}"
            })
        finally:
            db.close()
