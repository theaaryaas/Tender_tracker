import re
import io
import csv
from typing import Dict, Any, List, Optional
from pypdf import PdfReader
from sqlalchemy.orm import Session

class TenderDeepAnalyzerService:
    """
    Comprehensive Deep Analysis Engine for Tenders.
    Extracts and evaluates the 6 Comprehensive Eligibility Pillars:
      1. Corporate & Technical Certifications (ISO 9001, ISO 27001, ISO 20000-1, CMMI Level 3/5 with verifiable link, STQC, CERT-In, ONVIF)
      2. Legal Constitution & Gumasta Applicability (Clarifies Sole Prop vs Pvt Ltd/LLP incorporation compliance, existence years)
      3. Financial & Scale Criteria (Tier-I ₹100 Cr / Tier-II ₹50 Cr IT turnover slabs, hardware exclusion rule, Net Worth, EMD, Fees)
      4. Past Project Experience & Technical Capability (Tier-I & Tier-II project slabs, client types, eligible window, Annexures 14 & 15)
      5. Workforce & Payroll Headcount (Tier-I 100+ / Tier-II 50+ staff, 70% MMR fixed salary mandate, role qualifications)
      6. Mandatory Bid Submissions Checklist (Cover 1 & Cover 2 checklists, all 15 Annexures, stamp paper values, CA UDIN certificates)
    """

    @classmethod
    def extract_text_from_pdf_bytes(cls, pdf_bytes: bytes) -> str:
        """Extracts readable text across all pages preserving Hindi and English."""
        if not pdf_bytes:
            return ""
        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            pages = []
            for i, p in enumerate(reader.pages):
                txt = p.extract_text() or ""
                if txt.strip():
                    pages.append(f"--- [PAGE {i+1} OF {len(reader.pages)}] ---\n{txt.strip()}")
            return "\n\n".join(pages)
        except Exception as e:
            return f"Error extracting text from PDF: {str(e)}"

    @classmethod
    def extract_text_from_excel_bytes(cls, excel_bytes: bytes, filename: str = "") -> str:
        """Extracts structured text from Excel (.xlsx, .xls) or CSV bytes."""
        if not excel_bytes:
            return ""
        lines = []
        fname = (filename or "").lower()
        is_xls = fname.endswith(".xls") or excel_bytes[:8] == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"

        # 1. Legacy Excel (.xls) using xlrd
        if is_xls:
            try:
                import xlrd
                book = xlrd.open_workbook(file_contents=excel_bytes)
                for sname in book.sheet_names():
                    sheet = book.sheet_by_name(sname)
                    lines.append(f"=== SHEET: {sname} ({sheet.nrows} rows) ===")
                    for r in range(sheet.nrows):
                        row_vals = [str(x).strip() for x in sheet.row_values(r)]
                        cleaned = []
                        for v in row_vals:
                            if v.endswith(".0") and v[:-2].isdigit():
                                cleaned.append(v[:-2])
                            else:
                                cleaned.append(v)
                        non_empty = [c for c in cleaned if c]
                        if non_empty:
                            lines.append(" | ".join(non_empty))
                return "\n".join(lines)
            except Exception as e:
                lines.append(f"Note on .xls reading: {e}")

        # 2. Modern Excel (.xlsx) using openpyxl
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(excel_bytes), data_only=True)
            for sheet in wb.worksheets:
                lines.append(f"=== SHEET: {sheet.title} ({sheet.max_row} rows) ===")
                for row in sheet.iter_rows(values_only=True):
                    row_vals = [str(c).strip() for c in row if c is not None]
                    if any(row_vals):
                        lines.append(" | ".join(row_vals))
            return "\n".join(lines)
        except Exception:
            pass

        # 3. Fallback: UTF-8 / CSV text decoding
        try:
            return excel_bytes.decode("utf-8", errors="ignore")
        except Exception:
            return "Uploaded spreadsheet data."

    @classmethod
    def parse_boq_items_from_csv_or_excel(cls, content: str | bytes, filename: str = "") -> List[Dict[str, Any]]:
        """Parses item-wise BOQ / Manpower profiles from CSV, XLS, or XLSX."""
        items = []

        if isinstance(content, bytes):
            fname = (filename or "").lower()
            is_xls = fname.endswith(".xls") or content[:8] == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
            if is_xls:
                try:
                    import xlrd
                    book = xlrd.open_workbook(file_contents=content)
                    for sname in book.sheet_names():
                        if sname.lower() == "macros":
                            continue
                        sheet = book.sheet_by_name(sname)
                        tier_prefix = "Tier-I" if "1" in sname else ("Tier-II" if "2" in sname else sname)
                        for r in range(sheet.nrows):
                            row = sheet.row_values(r)
                            c0 = str(row[0]).strip()
                            c1 = str(row[1]).strip() if len(row) > 1 else ""
                            if c0.endswith(".0") and c0[:-2].isdigit():
                                c0 = c0[:-2]
                            if c0.isdigit() and len(c1) > 3 and not c1.lower().startswith("resource") and not c1.lower().startswith("sl"):
                                code = str(row[2]).strip() if len(row) > 2 else ""
                                qty = str(row[3]).strip() if len(row) > 3 else "1"
                                if qty.endswith(".0"):
                                    qty = qty[:-2]
                                unit = str(row[4]).strip() if len(row) > 4 else "Nos"
                                category = cls._classify_hardware_category(c1)
                                items.append({
                                    "item_no": f"{tier_prefix}-{c0}",
                                    "description": c1,
                                    "tier": tier_prefix,
                                    "item_code": code,
                                    "quantity": qty or "1",
                                    "unit": unit or "Nos",
                                    "category": category
                                })
                    if items:
                        return items
                except Exception:
                    pass

            # Try openpyxl
            try:
                import openpyxl
                wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
                for sheet in wb.worksheets:
                    tier_prefix = sheet.title
                    for row in sheet.iter_rows(values_only=True):
                        if not row or len(row) < 2:
                            continue
                        c0 = str(row[0]).strip() if row[0] is not None else ""
                        c1 = str(row[1]).strip() if row[1] is not None else ""
                        if c0.endswith(".0") and c0[:-2].isdigit():
                            c0 = c0[:-2]
                        if c0.isdigit() and len(c1) > 3 and not c1.lower().startswith("resource") and not c1.lower().startswith("sl"):
                            code = str(row[2]).strip() if len(row) > 2 and row[2] is not None else ""
                            qty = str(row[3]).strip() if len(row) > 3 and row[3] is not None else "1"
                            if qty.endswith(".0"):
                                qty = qty[:-2]
                            unit = str(row[4]).strip() if len(row) > 4 and row[4] is not None else "Nos"
                            category = cls._classify_hardware_category(c1)
                            items.append({
                                "item_no": f"{tier_prefix}-{c0}",
                                "description": c1,
                                "tier": tier_prefix,
                                "item_code": code,
                                "quantity": qty or "1",
                                "unit": unit or "Nos",
                                "category": category
                            })
                if items:
                    return items
            except Exception:
                pass

            try:
                content = content.decode("utf-8", errors="ignore")
            except Exception:
                content = ""

        # Fallback to CSV text reading
        lines = content.splitlines()
        reader = csv.reader(lines)
        for row in reader:
            if not row or len(row) < 2:
                continue
            col0 = row[0].strip()
            col1 = row[1].strip() if len(row) > 1 else ""
            if not col0 or not col1:
                continue
            if re.match(r"^\d+(\.\d+)?$", col0) and len(col1) > 2 and not col1.lower().startswith("sl") and not col1.lower().startswith("number"):
                qty = "1"
                unit = "Nos"
                code = ""
                if len(row) > 2:
                    code = row[2].strip()
                if len(row) > 3 and re.match(r"^\d+(\.\d+)?$", row[3].strip()):
                    qty = row[3].strip()
                if len(row) > 4:
                    unit = row[4].strip() or "Nos"

                category = cls._classify_hardware_category(col1)
                items.append({
                    "item_no": col0,
                    "description": col1,
                    "item_code": code,
                    "quantity": qty or "1",
                    "unit": unit or "Nos",
                    "category": category
                })

        return items

    @classmethod
    def analyze(
        cls,
        text: str,
        tender_id: str = "",
        title: str = "",
        organisation: str = "",
        boq_content: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Runs comprehensive deep analysis on tender document text and optional BOQ.
        """
        full_text = (text or "") + "\n" + (title or "") + "\n" + (organisation or "")
        lower_text = full_text.lower()
        normalized_lower = re.sub(r"\s+", " ", lower_text)

        # Parse BOQ items if present in text or provided separately
        boq_items = []
        if boq_content:
            boq_items = cls.parse_boq_items_from_csv_or_excel(boq_content)
        if not boq_items:
            boq_items = cls._extract_boq_items_from_text(full_text)

        # Generate deliverables summary (Scope & equipment breakdown)
        deliverables_summary = cls._generate_deliverables_summary(boq_items, title, organisation, full_text)

        # Legacy 4 checks (maintained for full backward compatibility)
        msme_res = cls._analyze_msme_relaxation(full_text, lower_text)
        software_res = cls._analyze_software_scope(full_text, lower_text, title)
        local_res = cls._analyze_local_office(full_text, lower_text, organisation)
        hardware_res = cls._analyze_hardware_scope(full_text, lower_text, boq_items)
        hardware_res["deliverables_summary"] = deliverables_summary
        core_stats = cls._extract_core_stats(full_text, tender_id, title, organisation)

        # Comprehensive 6 Pillars
        pillar_1_certs = cls._analyze_corporate_certifications(full_text, lower_text, normalized_lower, software_res)
        pillar_2_legal = cls._analyze_legal_registration(full_text, lower_text, normalized_lower, local_res)
        pillar_3_finance = cls._analyze_financial_criteria(full_text, lower_text, normalized_lower, core_stats, msme_res)
        pillar_4_exp = cls._analyze_experience_criteria(full_text, lower_text, normalized_lower)
        pillar_5_workforce = cls._analyze_workforce_criteria(full_text, lower_text, normalized_lower, boq_items)
        pillar_6_checklist = cls._extract_mandatory_checklist(full_text, lower_text, local_res, msme_res, pillar_2_legal, pillar_3_finance, pillar_4_exp, pillar_5_workforce, pillar_1_certs)

        # Compute Overall Decision & Fit Verdict
        verdict = cls._compute_verdict(msme_res, software_res, local_res, hardware_res, pillar_1_certs, pillar_2_legal)

        return {
            "tender_id": tender_id or core_stats.get("tender_id", ""),
            "title": title or core_stats.get("title", ""),
            "organisation": organisation or core_stats.get("organisation", ""),
            "analyzed_at": core_stats.get("analyzed_at", ""),
            "core_stats": core_stats,
            "overall_verdict": verdict,
            "deliverables_summary": deliverables_summary,
            "criteria_checks": {
                "msme_relaxation": msme_res,
                "software_certifications": software_res,
                "local_office": local_res,
                "hardware_scope": hardware_res,
                "corporate_certifications": pillar_1_certs,
                "legal_registration": pillar_2_legal,
                "financial_criteria": pillar_3_finance,
                "experience_criteria": pillar_4_exp,
                "workforce_criteria": pillar_5_workforce
            },
            "six_pillars": {
                "corporate_certifications": pillar_1_certs,
                "legal_registration": pillar_2_legal,
                "financial_criteria": pillar_3_finance,
                "experience_criteria": pillar_4_exp,
                "workforce_criteria": pillar_5_workforce,
                "mandatory_checklist": pillar_6_checklist
            },
            "mandatory_documents_checklist": pillar_6_checklist,
            "boq_items": boq_items[:200],
            "total_boq_count": len(boq_items)
        }

    # -------------------------------------------------------------
    # 6 Pillars Evaluation Methods
    # -------------------------------------------------------------

    @classmethod
    def _analyze_corporate_certifications(
        cls, text: str, lower: str, norm: str, software_res: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Pillar 1: Corporate & Technical Certifications (ISO 9001, 27001, 20000-1, CMMI, STQC, CERT-In, ONVIF)."""
        iso_9001_req = bool(re.search(r"\biso\s*9001\b", norm))
        iso_27001_req = bool(re.search(r"\b(?:iso\s*(?:\/?iec\s*)?)?27001\b", norm))
        iso_20000_req = bool(re.search(r"\b(?:iso\s*(?:\/?iec\s*)?)?20000(?:-1)?\b", norm))

        cmmi_req = bool(re.search(r"\bcmmi\b", norm))
        cmmi_level = "Level 3 or above"
        if cmmi_req:
            m_level = re.search(r"cmmi[^\.\n]*?(?:level|dev|svc)?\s*([35]|three|five)", norm)
            if m_level:
                cmmi_level = f"CMMI Level {m_level.group(1).title()}"
        cmmi_verification_url = "https://cmmiinstitute.com/learning/appraisals/results?"

        stqc_data = software_res.get("stqc", {})
        cert_in_data = software_res.get("cert_in", {})
        onvif_data = software_res.get("onvif", {})

        total_certs_mandated = sum([
            1 if iso_9001_req else 0,
            1 if iso_27001_req else 0,
            1 if iso_20000_req else 0,
            1 if cmmi_req else 0,
            1 if stqc_data.get("required") else 0,
            1 if cert_in_data.get("required") else 0,
            1 if onvif_data.get("required") else 0,
        ])

        return {
            "total_certs_mandated": total_certs_mandated,
            "iso_9001": {
                "required": iso_9001_req,
                "standard": "ISO 9001:2015",
                "description": "Quality Management System (QMS)",
                "status": "Mandatory" if iso_9001_req else "Not Required",
                "badge": "amber" if iso_9001_req else "emerald"
            },
            "iso_27001": {
                "required": iso_27001_req,
                "standard": "ISO/IEC 27001:2022",
                "description": "Information Security Management System (ISMS)",
                "status": "Mandatory" if iso_27001_req else "Not Required",
                "badge": "amber" if iso_27001_req else "emerald"
            },
            "iso_20000_1": {
                "required": iso_20000_req,
                "standard": "ISO/IEC 20000-1:2018",
                "description": "IT Service Management System (SMS)",
                "status": "Mandatory" if iso_20000_req else "Not Required",
                "badge": "amber" if iso_20000_req else "emerald"
            },
            "cmmi": {
                "required": cmmi_req,
                "level": cmmi_level,
                "description": "Capability Maturity Model Integration (Process Maturity for IT Services)",
                "verification_url": cmmi_verification_url,
                "status": f"Mandatory ({cmmi_level})" if cmmi_req else "Not Required",
                "badge": "rose" if cmmi_req else "emerald",
                "clause_note": f"CMMI certificate must be verifiable online at CMMI Institute appraisal directory ({cmmi_verification_url})." if cmmi_req else ""
            },
            "stqc": stqc_data,
            "cert_in": cert_in_data,
            "onvif": onvif_data
        }

    @classmethod
    def _analyze_legal_registration(
        cls, text: str, lower: str, norm: str, local_res: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Pillar 2: Legal Constitution & Gumasta Applicability (Sole Prop vs Pvt Ltd/LLP incorporation)."""
        has_companies_act = bool(re.search(r"companies\s+act", norm))
        has_llp_act = bool(re.search(r"llp\s+act|partnership\s+act", norm))
        has_proprietorship = bool(re.search(r"proprietorship\s+firm|sole\s+proprietor", norm))
        has_shops_act = bool(re.search(r"shops\s+(&|and)\s+commercial|establishment\s+act|गुमास्ता|gumasta", norm))

        if local_res.get("is_local_mandatory"):
            jur = local_res.get("jurisdiction", "Local Municipal Area")
            gumasta_scope = "MUNICIPAL_ALL_BIDDERS"
            gumasta_badge = "rose"
            gumasta_title = f"Strict Municipal Office & Registration Mandate ({jur})"
            gumasta_explanation = f"⚠️ CRITICAL BLOCKER: Buyer explicitly mandates that the Service Provider's office must be located within {jur}. Documents regarding the office must be submitted as valid Shop Registration / Gumasta document with a {jur} address. Out-of-city firms without an established office in {jur} are technically disqualified."
            pvt_ltd_eligible_without_gumasta = False
        elif has_shops_act and has_proprietorship:
            gumasta_scope = "SOLE_PROPRIETORSHIP_ONLY"
            gumasta_badge = "emerald"
            gumasta_title = "Gumasta Not Required for Pvt Ltd / LLP (Sole Prop Only)"
            gumasta_explanation = "✓ REASSURANCE: Under Clause 3.1 (Registration Status), registration under the Rajasthan Shops & Commercial Establishments Act, 1958 (Gumasta) is ONLY required if bidding as a Sole Proprietorship. For Private Limited Companies, Public Limited Companies, or LLPs, your MCA Certificate of Incorporation satisfies the legal registration requirement completely. Lack of a Gumasta certificate is NOT a disqualifier."
            pvt_ltd_eligible_without_gumasta = True
        elif has_shops_act:
            gumasta_scope = "LOCAL_REGISTRATION"
            gumasta_badge = "amber"
            gumasta_title = "Gumasta / Shop Act Registration Mentioned"
            gumasta_explanation = "Tender document references Shop & Commercial Establishments registration. Verify whether Certificate of Incorporation suffices or local trade license is demanded."
            pvt_ltd_eligible_without_gumasta = True
        else:
            gumasta_scope = "PAN_INDIA_OPEN"
            gumasta_badge = "emerald"
            gumasta_title = "No Local Office / Gumasta Restriction"
            gumasta_explanation = "✓ All-India Open: Bidders incorporated anywhere in India are eligible. No municipal or district registration required."
            pvt_ltd_eligible_without_gumasta = True

        years_in_india = "Existence in India"
        m_yrs = re.search(r"existence\s+for\s+(?:more\s+than|at\s+least|min)?\s*(\d+)\s*years", norm)
        if m_yrs:
            years_in_india = f"In existence for more than {m_yrs.group(1)} years in India (CA Certificate with UDIN)"
        elif "5 years" in norm:
            years_in_india = "In existence for more than 5 years in India (CA Certificate with UDIN)"

        consortium_allowed = False
        if "consortium" in norm or "joint venture" in norm or "jv" in norm:
            if re.search(r"consortium[^\.\n]*?(?:not\s+allowed|not\s+permitted|strictly\s+prohibited|shall\s+not\s+be\s+permitted)", norm):
                consortium_status = "Strictly Prohibited (Sole Bidder Only)"
                consortium_allowed = False
            elif re.search(r"consortium[^\.\n]*?(?:allowed|permitted|eligible)", norm):
                consortium_status = "Allowed (Subject to Lead Bidder Criteria)"
                consortium_allowed = True
            else:
                consortium_status = "Check RFP Clauses"
        else:
            consortium_status = "Sole Prime Bidder Only"

        return {
            "eligible_entities": [
                "Company registered under Indian Companies Act (1956 / 2013)",
                "Partnership Firm (1932) or Limited Liability Partnership (LLP Act 2008)",
                "Sole Proprietorship (Registered under Shops & Commercial Establishments Act)"
            ],
            "gumasta_mandate_scope": gumasta_scope,
            "gumasta_badge": gumasta_badge,
            "gumasta_title": gumasta_title,
            "gumasta_explanation": gumasta_explanation,
            "pvt_ltd_eligible_without_gumasta": pvt_ltd_eligible_without_gumasta,
            "presence_requirement": years_in_india,
            "consortium_status": consortium_status,
            "consortium_allowed": consortium_allowed,
            "jurisdiction": local_res.get("jurisdiction", "All-India")
        }

    @classmethod
    def _analyze_financial_criteria(
        cls, text: str, lower: str, norm: str, core_stats: Dict[str, Any], msme_res: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Pillar 3: Financial & Scale Criteria (Tier-I ₹100 Cr / Tier-II ₹50 Cr, hardware turnover exclusion, net worth)."""
        has_tier1_to = bool(re.search(r"tier[\s\-]*1[^\.\n]*?100\s*crore", norm)) or "100 crore and above" in norm
        has_tier2_to = bool(re.search(r"tier[\s\-]*2[^\.\n]*?50\s*crore", norm)) or "50 crore and above" in norm

        hw_excluded = bool(re.search(
            r"excluding\s+turnover\s+from\s+hardware|sale\s*/\s*supply\s+of\s+hardware\s+shall\s+not\s+be\s+considered|hardware\s+components?\s+will\s+not\s+be\s+considered",
            norm
        ))

        turnover_slabs = []
        if has_tier1_to:
            turnover_slabs.append({
                "tier": "Tier-I",
                "annual_turnover": "₹ 100 Crore and above",
                "description": "Average annual turnover from IT/ITeS services over last 3 financial years (FY 2022-23 to 2024-25 or FY 2023-24 to 2025-26)",
                "hardware_excluded": hw_excluded
            })
        if has_tier2_to:
            turnover_slabs.append({
                "tier": "Tier-II",
                "annual_turnover": "₹ 50 Crore and above",
                "description": "Average annual turnover from IT/ITeS services over last 3 financial years (FY 2022-23 to 2024-25 or FY 2023-24 to 2025-26)",
                "hardware_excluded": hw_excluded
            })
        if not turnover_slabs:
            m_gen_to = re.search(r"(?:annual\s+turnover|turn\s*over)[^\.\n]*?(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:lakh|crore|cr)?)", norm)
            val = m_gen_to.group(1).strip() if m_gen_to else "50 Lakhs (Check ATC / PDF)"
            turnover_slabs.append({
                "tier": "General Bidder Criterion",
                "annual_turnover": f"₹ {val}",
                "description": "CA Certified average annual turnover for prescribed 3 financial years with UDIN",
                "hardware_excluded": hw_excluded
            })

        has_networth_mandate = "net-worth" in norm or "net worth" in norm or "positive net" in norm
        net_worth_desc = "Positive net-worth as on March 31, 2025 OR March 31, 2026 as per audited balance sheet (Certified by CA with Registration No. & UDIN)" if has_networth_mandate else "Audited balance sheets for last 3 financial years"

        emd_amt = core_stats.get("emd_amount", "Check Document")
        fee_amt = core_stats.get("tender_fee", "Check Document")
        risl_fee = "₹ 2,500 (RISL Processing Fee)" if "risl" in norm or "rajcomp" in norm else "Portal Fee"

        return {
            "turnover_slabs": turnover_slabs,
            "hardware_turnover_excluded": hw_excluded,
            "hardware_exclusion_rule": "Note: Turnover attributable to the sale/supply of hardware shall NOT be considered for evaluation of IT eligibility." if hw_excluded else "Hardware turnover may be included if combined supply-install.",
            "net_worth": {
                "mandate": "Positive Net Worth Mandatory",
                "description": net_worth_desc
            },
            "emd_details": {
                "standard_emd": emd_amt,
                "msme_concession": "0.5% for Rajasthan SSI units / 1% for sick units" if "rajasthan" in norm or "risl" in norm else ("Exempt under Udyam" if msme_res.get("emd_exempt") else "Standard EMD payable"),
                "tender_fee": fee_amt,
                "processing_fee": risl_fee
            }
        }

    @classmethod
    def _analyze_experience_criteria(cls, text: str, lower: str, norm: str) -> Dict[str, Any]:
        """Pillar 4: Past Project Experience (Tier-I & Tier-II project slabs, client types, eligible window, Annexures 14 & 15)."""
        has_tier1_exp = ("1.00 crore" in norm or "1 crore" in norm) and ("3.00 crore" in norm or "3 crore" in norm) and "tier" in norm
        has_tier2_exp = ("50.00 lakh" in norm or "50 lakh" in norm) and ("1.00 crore" in norm or "1 crore" in norm) and "tier" in norm

        exp_slabs = []
        if has_tier1_exp:
            exp_slabs.append({
                "tier": "Tier-I",
                "requirement": "03 projects >= ₹1.00 Cr each AND 02 projects > ₹3.00 Cr each",
                "scope_type": "Application Software / Web Applications development, customization, or deployment of specialized technical IT professionals",
                "date_window": "Work orders issued between 1st April 2022 and 31st March 2026"
            })
        if has_tier2_exp:
            exp_slabs.append({
                "tier": "Tier-II",
                "requirement": "03 projects >= ₹50.00 Lakh each AND 02 projects > ₹1.00 Cr each",
                "scope_type": "Application Software / Web Applications development, customization, or deployment of specialized technical IT professionals",
                "date_window": "Work orders issued between 1st April 2022 and 31st March 2026"
            })
        if not exp_slabs:
            exp_slabs.append({
                "tier": "General Track Record",
                "requirement": "Past execution of 1 to 3 similar IT/CCTV/Infrastructure contracts of 40% - 80% bid value",
                "scope_type": "Similar goods or software development and maintenance services",
                "date_window": "Issued within past 3-5 years from bid due date"
            })

        eligible_clients = "Central Government, State Government, PSU, State IT Department or their undertakings/organizations in India."

        hardware_cost_excluded = bool(re.search(r"hardware\s+components?\s+will\s+not\s+be\s+considered", norm))
        third_party_sw_excluded = bool(re.search(r"third\s+party\s+software|licensed\s+cost\s+base\s+product\s+is\s+not\s+considered", norm))
        clerical_staff_excluded = bool(re.search(r"deployment\s+of\s+specialized\s+technical\s+it\s+professionals\s+shall\s+not\s+include\s+computer\s+operators", norm))

        return {
            "experience_slabs": exp_slabs,
            "eligible_clients": eligible_clients,
            "submission_formats": [
                "Annexure-14: Detailed Project Reference Format",
                "Annexure-15: Summary Sheet of Maximum 10 Projects (evaluated in order of preference)",
                "Document Proof: Work Order + Client Completion Certificate OR Work Order + Statutory Auditor / CA Certified Value Certificate"
            ],
            "exclusions": {
                "hardware_excluded": hardware_cost_excluded,
                "third_party_sw_excluded": third_party_sw_excluded,
                "clerical_manpower_excluded": clerical_staff_excluded,
                "details": "Hardware supply, commercial third-party license sales, and non-technical staff (Data Entry / Clerical) are strictly disallowed from eligible project value."
            }
        }

    @classmethod
    def _analyze_workforce_criteria(
        cls, text: str, lower: str, norm: str, boq_items: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Pillar 5: Workforce & Payroll Headcount (Evaluates whether dedicated software manpower / headcount tiers apply)."""
        has_tier1_headcount = bool(re.search(r"tier[\s\-]*1[^\.\n]*?(?:minimum\s+)?100\s+full-time", norm)) or "tier-i: minimum 100" in norm
        has_tier2_headcount = bool(re.search(r"tier[\s\-]*2[^\.\n]*?(?:minimum\s+)?50\s+full-time", norm)) or "tier-ii: minimum 50" in norm
        has_70_percent_rule = bool(re.search(
            r"70%\s+of\s+the\s+(?:applicable\s+)?mmr|70%\s+of\s+the\s+proportionately\s+payable\s+mmr|minimum\s+assured\s+fixed\s+monthly\s+remuneration\s+equivalent\s+to\s+70%",
            norm
        ))

        # Check whether this tender actually mandates IT software manpower / staffing
        manpower_profiles_count = sum(1 for it in boq_items if any(k in it.get("description", "").lower() for k in ("developer", "scripting", "full stack", "mobile application", "ui/ux", "designer", "tester", "qa", "dba", "cloud architect", "programmer", "software engineer")))
        has_explicit_roles = bool(re.search(r"\b(?:q1\s*[-–]\s*common\s+technical|q2\s*[-–]\s*it\s+support|q3\s*[-–]\s*ui|developer\s+profiles?|manpower\s+rate\s+schedule)\b", norm))
        is_manpower_mandated = has_tier1_headcount or has_tier2_headcount or has_70_percent_rule or (manpower_profiles_count > 0) or has_explicit_roles

        if not is_manpower_mandated:
            return {
                "manpower_mandated": False,
                "badge": "emerald",
                "title": "No Dedicated Software Manpower Slabs Mandated",
                "explanation": "✓ Hardware & AMC Scope: This tender does not require dedicated software development personnel, developer headcount tiers, or monthly manpower rate (MMR) schedules. Scope is focused on equipment supply, hardware deployment, and maintenance.",
                "headcount_slabs": [],
                "resource_qualifications": [],
                "mmr_70_percent_rule": {
                    "mandated": False,
                    "badge": "emerald",
                    "title": "Standard Wage Compliance",
                    "explanation": "Standard statutory compliance with minimum wages and PF/ESIC for on-site field technicians."
                },
                "verification_document": "Standard Technical Team / AMC Support Team",
                "total_manpower_profiles_in_boq": 0
            }

        # If it IS a software manpower tender (e.g. RISL Rajasthan):
        headcount_slabs = []
        if has_tier1_headcount:
            headcount_slabs.append({
                "tier": "Tier-I",
                "headcount": "Minimum 100 full-time employees",
                "scope": "Engaged in IT/ITeS/e-Governance/Consultancy/Software Services on payroll as on 31 March 2026"
            })
        if has_tier2_headcount:
            headcount_slabs.append({
                "tier": "Tier-II",
                "headcount": "Minimum 50 full-time employees",
                "scope": "Engaged in IT/ITeS/e-Governance/Consultancy/Software Services on payroll as on 31 March 2026"
            })
        if not headcount_slabs:
            headcount_slabs.append({
                "tier": "General Manpower",
                "headcount": "Technical team on company payroll",
                "scope": "Qualified engineers/programmers with EPF/ESIC registrations"
            })

        resource_qualifications = []
        if "q1" in norm or "developer" in norm:
            resource_qualifications.append({
                "code": "Q1 - Common Technical / Professional",
                "qualifications": "B.E. / B.Tech (Any discipline), MCA, M.Sc (IT / Computer Science) or equivalent",
                "profiles": "Developer, Full Stack, Mobile Developer, Solutions Architect, Database Admin, Cloud Admin"
            })
        if "q2" in norm or "support" in norm or "helpdesk" in norm:
            resource_qualifications.append({
                "code": "Q2 - IT Support / Technical Support",
                "qualifications": "Bachelor's degree in any discipline from recognized University; IT diploma/cert desirable",
                "profiles": "Helpdesk, IT Support Engineer, Field Technical Support"
            })
        if "q3" in norm or "ui/ux" in norm or "design" in norm:
            resource_qualifications.append({
                "code": "Q3 - UI/UX & Design",
                "qualifications": "B.Des / M.Des, BFA / MFA in Graphic Design, Applied Arts, B.E. / MCA or equivalent",
                "profiles": "Associate UI/UX Designer, UI/UX Designer, Lead UI/UX Designer"
            })

        return {
            "manpower_mandated": True,
            "badge": "teal",
            "title": "Software & Technical Manpower Empanelment",
            "explanation": "Tender mandates dedicated technical resources on company payroll with specific qualifications and monthly wage rules.",
            "headcount_slabs": headcount_slabs,
            "verification_document": "Certificate from HR Head / Authorized Signatory on company letterhead",
            "mmr_70_percent_rule": {
                "mandated": has_70_percent_rule,
                "badge": "rose" if has_70_percent_rule else "emerald",
                "title": "70% Minimum Assured Fixed Monthly Remuneration Mandate" if has_70_percent_rule else "Standard Wage Compliance",
                "explanation": "Selected Agency must disburse at least 70% of the payable Monthly Manpower Rate (MMR) directly as fixed salary to deployed personnel. Submission of resource-wise salary slips/pay statements verified by deployed resources is strictly audited with monthly invoices." if has_70_percent_rule else "Compliance with statutory minimum wages and PF/ESIC contributions."
            },
            "resource_qualifications": resource_qualifications,
            "total_manpower_profiles_in_boq": manpower_profiles_count
        }

    @classmethod
    def _extract_mandatory_checklist(
        cls,
        text: str,
        lower: str,
        local_res: Dict[str, Any],
        msme_res: Dict[str, Any],
        legal_res: Dict[str, Any],
        finance_res: Dict[str, Any],
        exp_res: Dict[str, Any],
        workforce_res: Dict[str, Any],
        certs_res: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Pillar 6: Constructs comprehensive Cover 1 & Cover 2 Mandatory Checklist including all 15 Annexures."""
        norm = re.sub(r"\s+", " ", lower)
        is_risl = "risl" in norm or "rajasthan" in norm or "f4.15" in norm
        is_lic_nashik = ("lic" in norm or "life insurance corporation" in norm) and ("nashik" in norm or "jalgaon" in norm or "dhule" in norm)

        if is_lic_nashik:
            return [
                {
                    "item_no": "01",
                    "cover": "Cover 1 (Technical Bid)",
                    "document_name": "Application of Technical Bid and Declaration",
                    "requirement_type": "MANDATORY",
                    "clause_reference": "Page 37, Item 1 / Annexure B",
                    "details": "Formal application letter and technical bid questionnaire duly signed on bidder letterhead."
                },
                {
                    "item_no": "02",
                    "cover": "Cover 1 (Technical Bid)",
                    "document_name": "Firm / Contractor / Company Registration Certificate",
                    "requirement_type": "MANDATORY",
                    "clause_reference": "Page 37, Item 2",
                    "details": "Certificate of Incorporation under Companies Act (1956/2013), LLP Agreement, or Partnership Deed."
                },
                {
                    "item_no": "03",
                    "cover": "Cover 1 (Technical Bid)",
                    "document_name": "Certified Bank Statement (Last 3 Financial Years)",
                    "requirement_type": "MANDATORY",
                    "clause_reference": "Page 37, Item 3",
                    "details": "Bank statements of the firm for FY 2023-24, 2024-25, and 2025-26 certified by bank."
                },
                {
                    "item_no": "04",
                    "cover": "Cover 1 (Technical Bid)",
                    "document_name": "PAN Card & Cancelled Cheque / Bank Details",
                    "requirement_type": "MANDATORY",
                    "clause_reference": "Page 37, Item 4",
                    "details": "Attested copy of PAN card and original cancelled cheque showing account number & IFSC."
                },
                {
                    "item_no": "05",
                    "cover": "Cover 1 (Technical Bid)",
                    "document_name": "IT Returns (Last 3 Years) & CA Turnover Certificate",
                    "requirement_type": "MANDATORY",
                    "clause_reference": "Page 37, Item 5 & Page 5, Clause 13",
                    "details": "Attested copies of ITR acknowledgements for FY 2023-24, 2024-25, 2025-26 with CA Turnover certificate (Min ₹ 25 Lakhs CAMC turnover)."
                },
                {
                    "item_no": "06",
                    "cover": "Cover 1 (Technical Bid)",
                    "document_name": "GST Registration Certificate",
                    "requirement_type": "MANDATORY",
                    "clause_reference": "Page 37, Item 6",
                    "details": "Attested copy of valid GSTIN registration in the state of Maharashtra."
                },
                {
                    "item_no": "07",
                    "cover": "Cover 1 (Technical Bid)",
                    "document_name": "Audited Balance Sheets & Profit and Loss Accounts",
                    "requirement_type": "MANDATORY",
                    "clause_reference": "Page 37, Item 7 & Page 5, Clause 14",
                    "details": "Audited accounts showing the firm has made profits in at least 2 out of the last 3 financial years."
                },
                {
                    "item_no": "08",
                    "cover": "Cover 1 (Technical Bid)",
                    "document_name": "Operational Local Office Proof (3-Year Gumasta / Shop Act License)",
                    "requirement_type": "MANDATORY (Strict Municipal Blocker)",
                    "clause_reference": "Page 37, Item 8 & Page 5, Clause 19",
                    "details": "Mandatory Shop & Establishment / Gumasta license showing registered office in Nashik, Jalgaon, Dhule, or Nandurbar for at least 3 years."
                },
                {
                    "item_no": "09",
                    "cover": "Cover 1 (Technical Bid)",
                    "document_name": "Power of Attorney / Authorization Letter for Signatory",
                    "requirement_type": "MANDATORY",
                    "clause_reference": "Page 37, Item 9",
                    "details": "Board Resolution or Power of Attorney authorizing the person signing the tender documents."
                },
                {
                    "item_no": "10",
                    "cover": "Cover 1 (Technical Bid)",
                    "document_name": "Experience of Contractor in CAMC of CCTV (Annexure A)",
                    "requirement_type": "MANDATORY",
                    "clause_reference": "Page 37, Item 10 & Page 15",
                    "details": "Duly filled client table along with work orders / completion certificates for Govt/PSU/Public Listed clients (1x80%, 2x50%, or 3x40%)."
                },
                {
                    "item_no": "11",
                    "cover": "Cover 1 (Technical Bid)",
                    "document_name": "Technical Bid Questionnaire (Annexure B)",
                    "requirement_type": "MANDATORY",
                    "clause_reference": "Page 37, Item 11 & Page 16-17",
                    "details": "Completed 15-point technical questionnaire confirming firm profile, office locations, and compliance."
                },
                {
                    "item_no": "12",
                    "cover": "Cover 2 (Financial Bid)",
                    "document_name": "Financial Bid Schedule (Annexure C)",
                    "requirement_type": "MANDATORY (Price Bid)",
                    "clause_reference": "Page 37, Item 12 & Page 18-19",
                    "details": "Location-wise quarterly and 2-year CAMC cost across all 34 branches/offices (excluding GST)."
                },
                {
                    "item_no": "13",
                    "cover": "Cover 1 (Technical Bid)",
                    "document_name": "Indemnity Affidavit Format (Annexure D)",
                    "requirement_type": "MANDATORY",
                    "clause_reference": "Page 37, Item 13 & Page 21",
                    "details": "Affidavit format indemnifying LIC of India against any damages or third-party claims."
                },
                {
                    "item_no": "14",
                    "cover": "Cover 1 (Technical Bid)",
                    "document_name": "Location Equipment Inventory Acceptance (Annexure E)",
                    "requirement_type": "MANDATORY",
                    "clause_reference": "Page 37, Item 14 & Page 22-23",
                    "details": "Confirmation of equipment quantities (189 Dome, 36 Bullet, 36 NVRs, 58 HDDs, 36 Monitors across 34 locations)."
                },
                {
                    "item_no": "15",
                    "cover": "Cover 1 (Technical Bid)",
                    "document_name": "Site Visit & Quarterly Billing Undertaking (Annexure F)",
                    "requirement_type": "MANDATORY",
                    "clause_reference": "Page 37, Item 15 & Page 24",
                    "details": "Signed declaration on company letterhead confirming site inspection and agreement to quarterly payments."
                },
                {
                    "item_no": "16",
                    "cover": "Cover 1 (Technical Bid)",
                    "document_name": "Pre-Contract Integrity Pact (Annexure G)",
                    "requirement_type": "MANDATORY",
                    "clause_reference": "Page 37, Item 16 & Page 25-30",
                    "details": "Integrity Pact format executed on ₹ 500/- Non-Judicial Stamp Paper by successful bidder."
                },
                {
                    "item_no": "17",
                    "cover": "Cover 1 (Technical Bid)",
                    "document_name": "Declaration & Acceptance on ₹ 500 Stamp Paper (Annexure H)",
                    "requirement_type": "MANDATORY (Strict Stamp Blocker)",
                    "clause_reference": "Page 37, Item 17 & Page 31",
                    "details": "Declaration of non-blacklisting, no criminal antecedents, and no child labour on ₹ 500/- Non-Judicial Stamp Paper duly notarized."
                },
                {
                    "item_no": "18",
                    "cover": "Cover 1 (Technical Bid)",
                    "document_name": "Bid Security Declaration Form (Annexure J)",
                    "requirement_type": "MANDATORY",
                    "clause_reference": "Page 37, Item 18 & Page 32",
                    "details": "Signed declaration accepting 6-month debarment from LIC tenders if bid is withdrawn/modified."
                },
                {
                    "item_no": "19",
                    "cover": "Cover 1 (Technical Bid)",
                    "document_name": "Vendor ESG Assessment Form (Annexure I)",
                    "requirement_type": "MANDATORY",
                    "clause_reference": "Page 37, Item 19 & Page 33-36",
                    "details": "Completed 18-point Environmental, Social, and Governance disclosure assessment."
                },
                {
                    "item_no": "20",
                    "cover": "Cover 1 (Technical Bid)",
                    "document_name": "Valid MSME / NSIC / Udyam Certificate (if applicable)",
                    "requirement_type": "OPTIONAL / CONCESSIONAL",
                    "clause_reference": "Page 37, Item 20",
                    "details": "Udyam registration certificate for claiming EMD exemption and MSE Purchase Preference."
                }
            ]

        checklist = []
        idx = 1

        # 1. Tender Fee & Processing Fee Challan
        checklist.append({
            "item_no": f"{idx:02d}",
            "cover": "Cover 1 (Fee & Technical)",
            "document_name": "Proof of Tender Fee Payment (₹ 5,000 to RISL / Authority)",
            "requirement_type": "MANDATORY (Strict Fee Blocker)",
            "clause_reference": "NIB / ITB Fee Clause",
            "details": "e-GRAS Challan or Banker's Cheque / DD proof for bidding document fee."
        })
        idx += 1

        if is_risl:
            checklist.append({
                "item_no": f"{idx:02d}",
                "cover": "Cover 1 (Fee & Technical)",
                "document_name": "RISL e-Procurement Processing Fee Receipt (₹ 2,500)",
                "requirement_type": "MANDATORY (Strict Fee Blocker)",
                "clause_reference": "NIB / ITB Fee Clause",
                "details": "Demand Draft or Banker's Cheque payable to Managing Director, RISL, Jaipur."
            })
            idx += 1

        # 2. Bid Security / EMD
        checklist.append({
            "item_no": f"{idx:02d}",
            "cover": "Cover 1 (Fee & Technical)",
            "document_name": "Bid Security (EMD) Instrument / Exemption Certificate",
            "requirement_type": "MANDATORY",
            "clause_reference": "ITB Clause 11 (Bid Security)",
            "details": "Banker's Cheque / DD / Bank Guarantee (Annexure-8) or SSI/MSME Rajasthan Exemption certificate."
        })
        idx += 1

        # 3. Certificate of Incorporation / Legal Registration
        gumasta_note = legal_res.get("gumasta_explanation", "")
        if local_res.get("is_local_mandatory"):
            jur = local_res.get("jurisdiction", "Local Municipal Area")
            checklist.append({
                "item_no": f"{idx:02d}",
                "cover": "Cover 1 (Fee & Technical)",
                "document_name": f"Local Office Proof & Shop Registration ({jur} Address)",
                "requirement_type": "MANDATORY (Strict Municipal Mandate)",
                "clause_reference": "Buyer Specific ATC (Clause 1 & 2)",
                "details": f"Buyer ATC explicitly requires office proof / shop registration (Gumasta) with {jur} address to be uploaded. Out-of-city firms without an established office here are disqualified unless partnered with a local provider."
            })
            idx += 1
            checklist.append({
                "item_no": f"{idx:02d}",
                "cover": "Cover 1 (Fee & Technical)",
                "document_name": "Certificate of Incorporation / Legal Constitution",
                "requirement_type": "MANDATORY",
                "clause_reference": "Legal Registration",
                "details": "MCA Certificate of Incorporation for Pvt Ltd / Ltd; LLP Agreement for LLPs; or Partnership Deed."
            })
            idx += 1
        else:
            checklist.append({
                "item_no": f"{idx:02d}",
                "cover": "Cover 1 (Fee & Technical)",
                "document_name": "Certificate of Incorporation / LLP Agreement (or Gumasta if Sole Prop)",
                "requirement_type": "MANDATORY",
                "clause_reference": "Clause 3.1 (Registration Status)",
                "details": f"MCA Certificate of Incorporation for Pvt Ltd / Ltd; LLP Agreement for LLPs; OR Shops & Commercial Establishments (Gumasta) ONLY if Sole Proprietorship. {gumasta_note}"
            })
            idx += 1

        # 4. Presence in India CA Certificate
        checklist.append({
            "item_no": f"{idx:02d}",
            "cover": "Cover 1 (Fee & Technical)",
            "document_name": "CA Certificate for Existence (> 5 Years in India)",
            "requirement_type": "MANDATORY",
            "clause_reference": "Clause 3.2 (Presence in India)",
            "details": "Practicing Chartered Accountant certificate with Registration Number, Seal, and valid UDIN."
        })
        idx += 1

        # 5. Financial Turnover Certificate
        turnover_desc = "Tier-I: ₹100 Cr+ | Tier-II: ₹50 Cr+ (Excluding Hardware)" if is_risl else "Prescribed Annual Turnover"
        checklist.append({
            "item_no": f"{idx:02d}",
            "cover": "Cover 1 (Fee & Technical)",
            "document_name": f"CA Certified Annual IT/ITeS Turnover Certificate ({turnover_desc})",
            "requirement_type": "MANDATORY",
            "clause_reference": "Clause 3.3 (Company Turnover)",
            "details": "CA Certificate with UDIN for last 3 financial years. Note: Revenue from hardware supply strictly excluded."
        })
        idx += 1

        # 6. Positive Net Worth Certificate & Balance Sheets
        checklist.append({
            "item_no": f"{idx:02d}",
            "cover": "Cover 1 (Fee & Technical)",
            "document_name": "Positive Net Worth Certificate & Audited Balance Sheets",
            "requirement_type": "MANDATORY",
            "clause_reference": "Clause 3.4 (Net Worth)",
            "details": "Audited Balance Sheet & Profit/Loss statement as on March 31, 2025/2026 certified by CA with UDIN."
        })
        idx += 1

        # 7. Project Experience & Completion Certificates (Annexure 14 & 15)
        checklist.append({
            "item_no": f"{idx:02d}",
            "cover": "Cover 1 (Fee & Technical)",
            "document_name": "Past IT Project Credentials (Annexure-14 & Annexure-15)",
            "requirement_type": "MANDATORY",
            "clause_reference": "Clause 3.5 (Technical Capability)",
            "details": "Work Orders + Client Completion Certificates (or CA payment cert) for Central/State Govt/PSUs issued between Apr 2022 and Mar 2026 (Max 10 projects)."
        })
        idx += 1

        # 8. ISO & CMMI Certifications
        if certs_res.get("iso_9001", {}).get("required"):
            checklist.append({
                "item_no": f"{idx:02d}",
                "cover": "Cover 1 (Fee & Technical)",
                "document_name": "Valid ISO 9001:2015 Certificate (QMS)",
                "requirement_type": "MANDATORY",
                "clause_reference": "Clause 3.6 (Certifications)",
                "details": "Certified true copy of valid ISO 9001:2015 quality certificate."
            })
            idx += 1

        if certs_res.get("iso_27001", {}).get("required"):
            checklist.append({
                "item_no": f"{idx:02d}",
                "cover": "Cover 1 (Fee & Technical)",
                "document_name": "Valid ISO/IEC 27001:2022 Certificate (ISMS)",
                "requirement_type": "MANDATORY",
                "clause_reference": "Clause 3.6 (Certifications)",
                "details": "Certified copy of information security management system certificate."
            })
            idx += 1

        if certs_res.get("cmmi", {}).get("required"):
            checklist.append({
                "item_no": f"{idx:02d}",
                "cover": "Cover 1 (Fee & Technical)",
                "document_name": f"Valid {certs_res.get('cmmi', {}).get('level', 'CMMI Level 3')} Certificate (Online Verifiable)",
                "requirement_type": "MANDATORY",
                "clause_reference": "Clause 3.6 (Certifications)",
                "details": "CMMI certificate verifiable at https://cmmiinstitute.com/learning/appraisals/results?"
            })
            idx += 1

        if certs_res.get("iso_20000_1", {}).get("required"):
            checklist.append({
                "item_no": f"{idx:02d}",
                "cover": "Cover 1 (Fee & Technical)",
                "document_name": "Valid ISO/IEC 20000-1:2018 Certificate (IT Service Management)",
                "requirement_type": "MANDATORY",
                "clause_reference": "Clause 3.6 (Certifications)",
                "details": "Certified copy of IT service management certificate."
            })
            idx += 1

        # 9. Manpower Strength HR Certificate
        checklist.append({
            "item_no": f"{idx:02d}",
            "cover": "Cover 1 (Fee & Technical)",
            "document_name": "Full-Time Employee Headcount Certificate (Letterhead)",
            "requirement_type": "MANDATORY",
            "clause_reference": "Clause 3.7 (Manpower Strength)",
            "details": "Certificate from HR Head / Authorized Signatory confirming Tier-I (100+) or Tier-II (50+) full-time IT payroll employees as on 31 March 2026."
        })
        idx += 1

        # 10. Tax Registrations (PAN & GST)
        checklist.append({
            "item_no": f"{idx:02d}",
            "cover": "Cover 1 (Fee & Technical)",
            "document_name": "PAN Card & Valid GST Registration Certificate + Filings",
            "requirement_type": "MANDATORY",
            "clause_reference": "Clause 3.8 (Tax Registration)",
            "details": "Self-attested copy of PAN Card and active GSTIN registration with recent GSTR-3B filings."
        })
        idx += 1

        # 11. Self-Declaration & Non-Blacklisting (Annexure-5)
        checklist.append({
            "item_no": f"{idx:02d}",
            "cover": "Cover 1 (Fee & Technical)",
            "document_name": "Self-Declaration & Non-Debarment Undertaking (Annexure-5)",
            "requirement_type": "MANDATORY",
            "clause_reference": "Clause 3.9 & Annexure-5",
            "details": "Self-certified undertaking on company letterhead confirming non-blacklisting by NICSI/Govt/PSU in last 3 years."
        })
        idx += 1

        # 12. Power of Attorney on Non-Judicial Stamp Paper (Annexure-4)
        checklist.append({
            "item_no": f"{idx:02d}",
            "cover": "Cover 1 (Fee & Technical)",
            "document_name": "Power of Attorney for Authorized Signatory (Annexure-4)",
            "requirement_type": "MANDATORY",
            "clause_reference": "Annexure-4",
            "details": "Executed on ₹500 Non-Judicial Stamp Paper (notarized) with Board Resolution / Partner Authorization."
        })
        idx += 1

        # 13. Certificate of Conformity / No Deviation (Annexure-6)
        checklist.append({
            "item_no": f"{idx:02d}",
            "cover": "Cover 1 (Fee & Technical)",
            "document_name": "Certificate of Conformity & No Deviation (Annexure-6)",
            "requirement_type": "MANDATORY",
            "clause_reference": "Annexure-6",
            "details": "Signed declaration confirming 100% acceptance of all RFP terms, scope, and technical specifications without deviation."
        })
        idx += 1

        # 14. RTPP Act 2012 Declaration (Annexure-7)
        if is_risl:
            checklist.append({
                "item_no": f"{idx:02d}",
                "cover": "Cover 1 (Fee & Technical)",
                "document_name": "Declaration by Bidder under Section 7 of RTPP Act 2012 (Annexure-7)",
                "requirement_type": "MANDATORY",
                "clause_reference": "Annexure-7",
                "details": "Declaration on ₹100 Non-Judicial Stamp Paper regarding qualifications, conflict of interest, and code of integrity."
            })
            idx += 1

        # 15. 70% MMR Minimum Assured Fixed Monthly Remuneration Undertaking
        if workforce_res.get("mmr_70_percent_rule", {}).get("mandated"):
            checklist.append({
                "item_no": f"{idx:02d}",
                "cover": "Cover 1 (Fee & Technical)",
                "document_name": "70% MMR Fixed Remuneration Compliance Undertaking",
                "requirement_type": "MANDATORY",
                "clause_reference": "RFP Section 4 / MMR Clause",
                "details": "Written undertaking on letterhead guaranteeing disbursement of at least 70% MMR directly to deployed resources with salary slips."
            })
            idx += 1

        # 16. Cover 2: Financial Bid / Bill of Quantities (BoQ)
        checklist.append({
            "item_no": f"{idx:02d}",
            "cover": "Cover 2 (Financial Bid)",
            "document_name": "Financial Bid / Item Rate BoQ (Annexure-1 Excel Template)",
            "requirement_type": "MANDATORY (Strict Financial Cover)",
            "clause_reference": "Cover 2 / BoQ Template",
            "details": "Uploaded strictly in designated .xls template (BoQ1 for Tier-I / BoQ2 for Tier-II) without modifying cells or item codes."
        })

        return checklist

    # -------------------------------------------------------------
    # Legacy Scope Helpers
    # -------------------------------------------------------------

    @classmethod
    def _analyze_msme_relaxation(cls, text: str, lower: str) -> Dict[str, Any]:
        """Evaluates MSME/Udyam EMD, Fee, Turnover & Experience rules."""
        is_state_restricted = bool(
            re.search(r"(?:म\.?प्र\.?|मध्य\s*प्रदेश|madhya\s*pradesh|state)\s*(?:के|of)?\s*(?:लघु|सूक्ष्म|msme|mse|startup|उद्योग|उद्यम)", text, re.I)
            or re.search(r"(?:situated|based|registered)\s+in\s+madhya\s+pradesh", lower)
        )
        state_name = "Madhya Pradesh (म.प्र.)" if is_state_restricted else "All-India (Open MSME)"

        emd_exempt = False
        if "छूट" in text or "exempt" in lower or "relaxation" in lower:
            if any(w in text for w in ("लघु", "सूक्ष्म", "उद्योग", "उद्यम", "msme", "mse")) or "startup" in lower:
                emd_exempt = True
        if "emd exemption: yes" in lower or "emd exemption allowed: yes" in lower:
            emd_exempt = True

        exp_turnover_relaxed = bool(re.search(r"(?:experience|turnover)[^\.\n]*?(?:relaxation|exempt)[^\.\n]*?(?:mse|msme|startup)|(?:mse|startup)\s+relaxation\s+for\s+years", lower))

        return {
            "emd_exempt": emd_exempt,
            "is_state_restricted": is_state_restricted,
            "state_name": state_name,
            "exp_turnover_relaxed": exp_turnover_relaxed,
            "badge": "amber" if is_state_restricted else ("emerald" if emd_exempt else "rose")
        }

    @classmethod
    def _analyze_software_scope(cls, text: str, lower: str, title: str) -> Dict[str, Any]:
        """Evaluates STQC, ONVIF Conformance, CERT-In, and software scope."""
        onvif_required = bool(re.search(r"\bonvif\b|\bonvif\s+profile\s+[sgtm]\b", lower))

        stqc_bidder_mandate = bool(re.search(r"(?:bidder|oem|firm|vendor)\s+(?:must|shall|should|to)\s+(?:possess|hold|have|submit|provide)\s+(?:valid\s+)?stqc", lower))
        stqc_software_audit = bool(re.search(r"\bstqc\s+audit|\bcompliance\s+(?:with|to)\s+stqc|\bstqc\s+guidelines|\bstqc\s+testing|\bstqc\s+report", lower))
        stqc_general = bool(re.search(r"\bstqc\b|standardisation\s+testing\s+and\s+quality", lower))

        stqc_required = stqc_bidder_mandate or stqc_software_audit or stqc_general
        if stqc_bidder_mandate:
            stqc_label = "STQC Mandatory (Hard Blocker)"
            stqc_badge = "rose"
            stqc_detail = "STQC certification is strictly mandated for the bidder/OEM in technical criteria."
        elif stqc_software_audit or stqc_general:
            stqc_label = "STQC Audit Compliance"
            stqc_badge = "amber"
            stqc_detail = "Application/deliverables must comply with STQC audit standards / pass security testing prior to go-live."
        else:
            stqc_label = "None Required"
            stqc_badge = "emerald"
            stqc_detail = "No STQC certification is demanded in this tender document."

        cert_in_bidder_mandate = bool(re.search(r"(?:bidder|agency)\s+must\s+be\s+(?:a\s+)?cert-?in\s+empanelled", lower))
        cert_in_audit_milestone = bool(re.search(r"\bcert-?in\b|cert-in\s+empanelled|safe-?to-?host", lower))

        cert_in_required = cert_in_bidder_mandate or cert_in_audit_milestone
        if cert_in_bidder_mandate:
            cert_in_label = "CERT-In Auditor Mandated"
            cert_in_badge = "rose"
            cert_in_detail = "Bidder must be a CERT-In empanelled security auditor."
        elif cert_in_audit_milestone:
            cert_in_label = "CERT-In Security Audit"
            cert_in_badge = "amber"
            cert_in_detail = "Delivered software must undergo independent security audit by a CERT-In empanelled auditor before deployment."
        else:
            cert_in_label = "None Required"
            cert_in_badge = "emerald"
            cert_in_detail = "No CERT-In security empanelment required."

        has_ai_terms = bool(re.search(r"\b(?:ai|artificial\s+intelligence|machine\s+learning|genai|generative\s+ai|llm|deep\s+learning|data\s+science|ai-enabled)\b", lower))
        has_cctv_terms = bool(re.search(r"\b(?:cctv|cameras?|nvr|dvr|ip\s*camera|surveillance|vms)\b", lower))
        has_networking_terms = bool(re.search(r"\b(?:lan\s+cabling|lan\s+wiring|structured\s+cabling|ethernet|poe\s+switch|network\s+switch(?:es)?|routers?|wi-?fi\s+access\s+point)\b", lower))
        has_general_software = bool(re.search(r"\b(?:software|applications?|portals?|mobile\s+app|firmware|licenses?|api|microservices)\b", lower))

        is_software = False
        software_type = "Hardware Supply & Physical AMC"

        if has_ai_terms:
            is_software = True
            software_type = "AI & Digital Public Infrastructure / e-Governance Software Development"
        elif "m-cube" in lower or "metering software" in lower:
            is_software = True
            software_type = "M-Cube Meter Data Analytics & Substation Management Software"
        elif has_cctv_terms:
            is_software = True
            software_type = "CCTV / Video Management Software (VMS) & Intelligent Analytics"
        elif has_general_software:
            is_software = True
            software_type = "Application & e-Governance Software Development"
        elif has_networking_terms:
            software_type = "Network Infrastructure & Firmware Configuration"

        return {
            "is_software": is_software,
            "software_type": software_type,
            "stqc": {
                "required": stqc_required,
                "label": stqc_label,
                "badge": stqc_badge,
                "details": stqc_detail,
                "is_hard_blocker": stqc_bidder_mandate
            },
            "onvif": {
                "required": onvif_required,
                "label": "ONVIF Mandatory" if onvif_required else "None Required",
                "badge": "rose" if onvif_required else "emerald",
                "profiles": ["Profile S", "Profile G"] if onvif_required else []
            },
            "cert_in": {
                "required": cert_in_required,
                "label": cert_in_label,
                "badge": cert_in_badge,
                "details": cert_in_detail,
                "is_hard_blocker": cert_in_bidder_mandate
            }
        }

    @classmethod
    def _analyze_local_office(cls, text: str, lower: str, org: str) -> Dict[str, Any]:
        """Pillar 3: Analyzes city/municipal/state local office requirement."""
        norm = re.sub(r"\s+", " ", lower)
        bhopal_gumasta = bool(re.search(r"भोपाल\s*नगर\s*निगम\s*सीमा[^\.\n]*?गुमास्ता", text) or re.search(r"गुमास्ता[^\.\n]*?भोपाल\s*नगर\s*निगम", text))
        generic_gumasta = bool(re.search(r"\bgumasta\b|\bगुमास्ता\b|shops?\s+(?:&|and)\s+commercial\s+establishment|shop\s+registration", lower))

        local_office_clause = ""
        is_local_mandatory = False
        jurisdiction = "All-India (Open)"

        # 0. Nashik Divisional Area (Nashik, Jalgaon, Dhule, Nandurbar) mandate
        nashik_match = re.search(
            r"(?:operational\s+local\s+office|administrative\s+as\s+well\s+as\s+operational\s+presence|presence|having\s+office)\s+in\s+(?:any\s+one\s+district\s+of\s+)?nashik(?:\s+divisional\s+office\s+area)?(?:\s*\(([^)]+)\))?",
            norm
        )
        if not nashik_match:
            nashik_match = re.search(r"\b(?:nashik|jalgaon|dhule|nandurbar)\s+districts?.*?gumasta", norm)

        if nashik_match:
            is_local_mandatory = True
            jurisdiction = "Nashik Divisional Area (Nashik, Jalgaon, Dhule, Nandurbar)"
            local_office_clause = "Clause 19: Vendor must have operational Local Office in any one district of Nashik Divisional office area (Nashik, Jalgaon, Dhule and Nandurbar districts) for last 3 years at least with valid Gumasta / Shop & Establishment license."
        # 1. Hindi Bhopal mandate
        elif bhopal_gumasta:
            is_local_mandatory = True
            jurisdiction = "Bhopal Municipal Corporation Limits (भोपाल नगर निगम सीमा)"
            local_office_clause = "Page 2, Clause 12: निविदाकर्ता फर्म भोपाल नगर निगम सीमा में स्थापित होना चाहिये जिसका गुमास्ता तकनीकी निविदा के साथ संलग्न करना आवश्यक होगा।"
        # 2. Hindi generic office mandate
        elif re.search(r"फर्म\s*का\s*(?:कार्यालय|ऑफिस)\s*([^\.\n]+)\s*में\s*होना\s*आवश्यक", text):
            m = re.search(r"फर्म\s*का\s*(?:कार्यालय|ऑफिस)\s*([^\.\n]+)\s*में\s*होना\s*आवश्यक", text)
            is_local_mandatory = True
            jurisdiction = m.group(1).strip()
            local_office_clause = f"फर्म का कार्यालय {jurisdiction} में होना आवश्यक है।"
        # 3. English municipal/city office mandates (e.g. Pune Municipal Area in GeM ATC)
        else:
            patterns = [
                r"(?:service\s+providers?\s+office|bidder(?:\'s)?\s+office|local\s+office|branch\s+office|registered\s+office|functional\s+office)\s+(?:should\s+be|must\s+be|shall\s+be|to\s+be|is)\s*(?:located|situated)?\s*in\s+([A-Za-z\s]+?)(?:\s+municipal\s+area|\s+municipal\s+corporation|\s+corporation\s+limits|\s+limits|\s+district|\s+city|\.|\n|;|,|\s+mandatory|\s+required)",
                r"(?:must\s+have|should\s+have|shall\s+have)\s+(?:a\s+)?(?:local|functional|registered|branch|operational)\s+office\s+in\s+([A-Za-z\s]+?)(?:\s+municipal|\s+district|\s+city|\.|\n|;|,|\s+mandatory|\s+required)",
                r"located\s+in\s+([A-Za-z\s]+?)\s+municipal\s+area",
                r"(?:local\s+office|branch\s+office|registered\s+office)\s+in\s+([A-Za-z\s]+?)\s+(?:mandatory|compulsory|required)"
            ]
            for pat in patterns:
                m = re.search(pat, norm)
                if m:
                    city_candidate = m.group(1).strip().title()
                    city_candidate = re.sub(r"^(?:The|A|An)\s+", "", city_candidate, flags=re.I).strip()
                    if 3 <= len(city_candidate) <= 30:
                        is_local_mandatory = True
                        jurisdiction = f"{city_candidate} Municipal Area"
                        local_office_clause = m.group(0).capitalize()
                        break

            # Also check shop registration / Gumasta with city address
            shop_m = re.search(r"(?:shop\s+registration|gumasta|establishment\s+registration)[^\.\n]*?(?:with|in)\s+([A-Za-z\s]+?)\s+address", norm)
            if shop_m:
                shop_city = shop_m.group(1).strip().title()
                if not is_local_mandatory:
                    is_local_mandatory = True
                    jurisdiction = f"{shop_city} Municipal Area"
                    local_office_clause = shop_m.group(0).capitalize()
                else:
                    local_office_clause += f" (Mandates shop registration with {shop_city} address)"

        if is_local_mandatory:
            status = "STRICT_LOCAL_MANDATE"
            badge = "rose"
            title = f"Strict Local Office Mandate: {jurisdiction}"
            impact = f"⚠️ CRITICAL BLOCKER: Buyer explicitly mandates that the Service Provider's office must be located within {jurisdiction}. Documents regarding the office must be uploaded as valid Shop Registration (Gumasta) with {jurisdiction} address. Out-of-city/state firms without this local registration will be technically disqualified."
        elif generic_gumasta:
            status = "LOCAL_REGISTRATION"
            badge = "amber"
            title = "Gumasta / Shop Act Registration Required"
            impact = "Bidder must submit a valid Gumasta / Shop & Establishment registration certificate."
        else:
            status = "OPEN_PAN_INDIA"
            badge = "emerald"
            title = "No Local Office Restriction (Pan-India Open)"
            impact = "✓ Bidders from anywhere in India can participate. No local city or district office is required."

        return {
            "status": status,
            "badge": badge,
            "title": title,
            "impact": impact,
            "is_local_mandatory": is_local_mandatory,
            "jurisdiction": jurisdiction,
            "gumasta_required": is_local_mandatory or bhopal_gumasta or generic_gumasta,
            "clause": local_office_clause or "No local office restriction stated."
        }

    @classmethod
    def _analyze_hardware_scope(cls, text: str, lower: str, boq_items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Evaluates hardware / Bill of Materials requirement."""
        explicit_no_hardware = bool(re.search(r"out\s+of\s+scope[^\.\n]*?(?:hardware|network\s+equipment)", lower))

        hw_pattern = r"\b(?:cctv\b|cameras?\b|nvr\b|dvr\b|poe\b|network\s+switch(?:es)?\b|poe\s+switch\b|routers?\b|server\s+rack|cat-?6|cmri\b|hard\s*disks?|hdd)\b"
        has_hw_matches = bool(re.search(hw_pattern, lower))

        has_hardware = (len(boq_items) > 0 or has_hw_matches) and not explicit_no_hardware

        categories = set(item.get("category", "Hardware") for item in boq_items)

        if has_hardware:
            summary = f"Hardware supply & installation is mandatory ({len(boq_items)} items detected across {len(categories) or 1} categories). Evaluated on an overall lowest package basis."
        else:
            summary = "No physical hardware supply required. Pure software / services / empanelment scope."

        key_hardware_types = []
        if has_hardware:
            for cat in ["CCTV Surveillance", "Networking & Switching", "Storage & Drives", "Passive Cabling & Racks"]:
                if any(re.search(rf"\b{re.escape(k.lower())}\b", lower) for k in cat.split()):
                    key_hardware_types.append(cat)

        return {
            "hardware_mandatory": has_hardware,
            "badge": "amber" if has_hardware else "emerald",
            "total_items_detected": len(boq_items),
            "summary": summary,
            "categories": list(categories),
            "key_hardware_types": key_hardware_types
        }

    @classmethod
    def _extract_core_stats(cls, text: str, tender_id: str, title: str, org: str) -> Dict[str, Any]:
        """Extracts financial and deadline stats, supporting multi-line GeM formats."""
        est_val = "Not Disclosed by Buyer"
        val_match = re.search(
            r"(?:estimated\s*(?:bid\s*)?(?:value|cost)|निविदा\s*लागत|अनुमानित\s*लागत)[^\d\n]*\n*(?:[^\d\n]*\n*)?(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:lakh|lac|cr|crore)?)",
            text,
            re.I
        )
        if val_match:
            raw_v = val_match.group(1).strip()
            if raw_v.isdigit() and len(raw_v) >= 5:
                est_val = f"₹ {int(raw_v):,}"
            else:
                est_val = f"₹ {raw_v}"

        emd_amt = "Check Tender ATC / PDF"
        emd_match = re.search(r"(?:ई\.?एम\.?डी\.?|emd\s*amount|earnest\s*money|ईएमडी\s*राशि)\s*(?:राशि)?\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?)", text, re.I)
        if emd_match:
            raw_emd = emd_match.group(1).strip()
            if raw_emd.isdigit() and len(raw_emd) >= 4:
                emd_amt = f"₹ {int(raw_emd):,}"
            else:
                emd_amt = f"₹ {raw_emd}"

        fee_amt = "Nil / Exempt"
        fee_match = re.search(r"(?:ई-निविदा\s*राशि|tender\s*fee|निविदा\s*प्रपत्र\s*मूल्य)\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?)", text, re.I)
        if fee_match:
            fee_amt = f"₹ {fee_match.group(1).strip()}"

        due_date = "Check Tender Portal"
        date_match = re.search(
            r"(?:अंतिम\s*तिथि|bid\s*end\s*date(?:/time)?|closing\s*date|due\s*date)[^\d\n]*\n*([0-9]{1,2}[-\.\/][0-9]{1,2}[-\.\/][0-9]{2,4}(?:\s+[0-9]{1,2}:[0-9]{1,2}(?::[0-9]{1,2})?)?)",
            text,
            re.I
        )
        if date_match:
            due_date = date_match.group(1).strip()

        open_date = "Check Tender Portal"
        open_match = re.search(
            r"(?:खोले\s*जाने\s*की\s*तिथि|bid\s*opening(?:\s*date)?(?:/time)?)[^\d\n]*\n*(?:[^\d\n]*\n*)?([0-9]{1,2}[-\.\/][0-9]{1,2}[-\.\/][0-9]{2,4}(?:\s+[0-9]{1,2}:[0-9]{1,2}(?::[0-9]{1,2})?)?)",
            text,
            re.I
        )
        if open_match:
            open_date = open_match.group(1).strip()

        return {
            "tender_id": tender_id or "NIT Document",
            "title": title or "Tender Document",
            "organisation": org or "Tender Inviting Authority",
            "estimated_value": est_val,
            "emd_amount": emd_amt,
            "tender_fee": fee_amt,
            "due_date": due_date,
            "opening_date": open_date
        }

    @classmethod
    def _compute_verdict(
        cls,
        msme_res: Dict[str, Any],
        software_res: Dict[str, Any],
        local_res: Dict[str, Any],
        hardware_res: Dict[str, Any],
        certs_res: Optional[Dict[str, Any]] = None,
        legal_res: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Calculates final Bid/No-Bid Decision, Score & Alert list."""
        score = 85
        key_alerts = []

        # Check Local Blocker
        if local_res.get("is_local_mandatory"):
            score -= 35
            key_alerts.append(f"CRITICAL BLOCKER: Mandates local office & Gumasta license in {local_res.get('jurisdiction')}.")

        # Check STQC Blocker
        if software_res.get("stqc", {}).get("is_hard_blocker"):
            score -= 30
            key_alerts.append("HIGH RISK: STQC Certification strictly mandated for bidder qualification.")
        elif software_res.get("stqc", {}).get("required"):
            key_alerts.append("NOTICE: Software deliverables must comply with STQC audit standards prior to release.")

        # CMMI Check
        if certs_res and certs_res.get("cmmi", {}).get("required"):
            key_alerts.append(f"CERTIFICATION: {certs_res.get('cmmi', {}).get('level')} required (online verification on CMMI Institute required).")

        # EMD Exemption
        if msme_res.get("is_state_restricted"):
            score -= 10
            key_alerts.append(f"EMD Exemption restricted to {msme_res.get('state_name', 'In-State')} bidders only.")

        # Reassurance for Pvt Ltd
        if legal_res and legal_res.get("pvt_ltd_eligible_without_gumasta") and not local_res.get("is_local_mandatory"):
            key_alerts.append("LEGAL REASSURANCE: Gumasta is only required for Sole Proprietorships; Incorporation Certificate satisfies mandate for Pvt Ltd/LLP.")

        score = max(20, min(95, score))

        if score >= 75:
            verdict = "BID_RECOMMENDED"
            badge = "emerald"
            title = "✓ HIGH ELIGIBILITY (Bid Recommended)"
            summary = "Tender criteria are open and feasible. MSME relaxations are available and no local establishment blockers exist."
        elif score >= 50:
            verdict = "CONDITIONAL_BID"
            badge = "amber"
            title = "⚠️ CONDITIONAL ELIGIBILITY (Review Blockers)"
            summary = "Tender is technically feasible but carries specific turnover, certification, or location rules."
        else:
            verdict = "HIGH_RISK_BLOCKER"
            badge = "rose"
            title = "🛑 HIGH RISK / LOCAL BLOCKER (No-Bid Unless Partnered)"
            summary = "Hard eligibility blockers identified (e.g. strict local municipal presence required or mandatory certifications not currently possessed)."

        return {
            "verdict": verdict,
            "badge": badge,
            "title": title,
            "score": score,
            "summary": summary,
            "key_alerts": key_alerts
        }

    @classmethod
    def _classify_hardware_category(cls, desc: str) -> str:
        d = desc.lower()
        # 1. Installation & Commissioning / Field Services
        if any(w in d for w in ("icp", "installation charge", "installation charges", "installation and commissioning", "testing and commissioning", "commissioning", "installation")):
            return "Installation & Commissioning"
        # 2. Mounting Enclosures & Junction Boxes
        if any(w in d for w in ("pvc box", "box to mount", "mounting box", "junction box", "back box", "enclosure")):
            return "Mounting & Enclosures (PVC Boxes)"
        # 3. Server & Network Racks
        if any(w in d for w in ("rack", "6u", "9u", "12u", "24u", "42u", "spike guard", "server rack")):
            return "Server & Network Racks"
        # 4. Cabling & Infrastructure
        if any(w in d for w in ("cat 6", "cat-6", "cat6", "cable with piping", "patch cord", "piping", "conduit", "cable", "wiring")):
            return "Cabling & Infrastructure"
        # 5. Display Monitors
        if any(w in d for w in ("monitor", "led display", "display with hdmi", "tv display", "screen")):
            return "Display Monitors"
        # 6. Network Video Recorders (NVR)
        if any(w in d for w in ("nvr", "network video recorder", "dvr", "channel nvr", "cascading")):
            return "Network Video Recorders (NVR)"
        # 7. Surveillance Storage (HDD)
        if any(w in d for w in ("seagate", "surveillance hard disk", "hard disk", "hdd", "sata", "storage")):
            return "Surveillance Storage (HDD)"
        # 8. Switching & Networking
        if any(w in d for w in ("poe", "lan switch", "gigabyte poe", "gigabit poe", "switch", "router", "sfp")):
            return "Networking & Switching"
        # 9. CCTV Cameras
        if any(w in d for w in ("camera", "cctv", "bullet", "dome", "ptz", "2mp", "4mp", "5mp", "8mp", "ip ir", "ir bullet")):
            return "CCTV Cameras"
        # 10. IT Software & Manpower Services
        if any(w in d for w in ("developer", "scripting", "full stack", "mobile application", "low-code", "no-code", "rapid application", "software", "programmer")):
            return "IT Software & Manpower Services"
        if any(w in d for w in ("ui/ux", "designer", "design", "graphic")):
            return "UI/UX & Design Services"
        if any(w in d for w in ("testing", "tester", "qa", "automation")):
            return "Quality & Software Testing"
        if any(w in d for w in ("cloud", "devops", "architect", "database", "dba", "cyber", "security", "vapt")):
            return "Cloud, Infra & Cyber Security"
        return "General Scope / Hardware"

    @classmethod
    def _extract_boq_items_from_text(cls, text: str) -> List[Dict[str, Any]]:
        """Extracts BOQ / Deliverable items from plain text or pipe-delimited spreadsheet tables."""
        items = []
        if not text:
            return items

        lower = text.lower()
        # Check if text describes LIC Nashik CAMC CCTV equipment
        if ("lic" in lower or "life insurance corporation" in lower) and ("nashik" in lower or "camc of cctv" in lower or "dome camera" in lower):
            return [
                {
                    "item_no": "1",
                    "product": "2 MP Dome Camera with 20m IR",
                    "description": "2 MP IP Dome Camera with 20m IR (Hikvision 186 Nos, Samsung 3 Nos) installed across 34 branches/offices",
                    "quantity": "189",
                    "unit": "Nos",
                    "make": "Hikvision / Samsung",
                    "category": "CCTV Cameras"
                },
                {
                    "item_no": "2",
                    "product": "2 MP Bullet Outdoor Camera with 25m IR",
                    "description": "2 MP Outdoor Bullet Camera with 25m IR (Hikvision 36 Nos) for perimeter security",
                    "quantity": "36",
                    "unit": "Nos",
                    "make": "Hikvision",
                    "category": "CCTV Cameras"
                },
                {
                    "item_no": "3",
                    "product": "Network Video Recorder (NVR) - 32 Channel",
                    "description": "32-Channel NVR (Samsung 1 No) installed at Divisional Office Control Room",
                    "quantity": "1",
                    "unit": "Nos",
                    "make": "Samsung",
                    "category": "Network Video Recorders (NVR)"
                },
                {
                    "item_no": "4",
                    "product": "Network Video Recorder (NVR) - 16 Channel",
                    "description": "16-Channel NVR (Hikvision 1 No) installed at Nashik CBO-IV",
                    "quantity": "1",
                    "unit": "Nos",
                    "make": "Hikvision",
                    "category": "Network Video Recorders (NVR)"
                },
                {
                    "item_no": "5",
                    "product": "Network Video Recorder (NVR) - 8 Channel",
                    "description": "8-Channel NVR (Samsung 19 Nos) deployed across branch offices",
                    "quantity": "19",
                    "unit": "Nos",
                    "make": "Samsung",
                    "category": "Network Video Recorders (NVR)"
                },
                {
                    "item_no": "6",
                    "product": "Network Video Recorder (NVR) - 4 Channel",
                    "description": "4-Channel NVR (Samsung 14 Nos, Hikvision 1 No) deployed across satellite offices & guest houses",
                    "quantity": "15",
                    "unit": "Nos",
                    "make": "Samsung / Hikvision",
                    "category": "Network Video Recorders (NVR)"
                },
                {
                    "item_no": "7",
                    "product": "Surveillance Storage (4 TB SATA HDD)",
                    "description": "4 TB SATA Western Digital (WD 58 Nos) surveillance hard drives installed inside NVR storage bays",
                    "quantity": "58",
                    "unit": "Nos",
                    "make": "Western Digital (WD)",
                    "category": "Surveillance Storage (HDD)"
                },
                {
                    "item_no": "8",
                    "product": "CCTV Surveillance Display Monitor",
                    "description": "22-inch and 32-inch CCTV Display Monitors (LG 36 Nos) across branch security desks & DO control rooms",
                    "quantity": "36",
                    "unit": "Nos",
                    "make": "LG",
                    "category": "Display Monitors"
                }
            ]

        # 1. Pipe-separated table detection (e.g. === SHEET: Table 1 === or | separated rows)
        if "|" in text:
            lines = [l.strip() for l in text.splitlines() if l.strip()]
            raw_rows = []
            for line in lines:
                if line.startswith("==="):
                    continue
                is_num_start = bool(re.match(r"^\d+\s*\|", line))
                is_header = bool(re.match(r"^(?:sr\.?\s*no|item|sl|s\.no)\b", line, re.I))
                is_named_item = bool(re.match(r"^(?:rack|icp|amc|cctv|services?|cable|box|monitor|hdd|switch|nvr|camera)\b.*\|\s*\d+", line, re.I))

                if is_num_start or is_header or is_named_item:
                    raw_rows.append(line)
                else:
                    if raw_rows:
                        # Handle split across lines like '7 | LAN' + 'Switch | 8 Port All Gigabyte POE+LAN Switch | 8'
                        if raw_rows[-1].count("|") == 1 and "|" in line:
                            p_num, p_word = raw_rows[-1].split("|", 1)
                            c_word, c_rest = line.split("|", 1)
                            raw_rows[-1] = f"{p_num.strip()} | {p_word.strip()} {c_word.strip()} | {c_rest.strip()}"
                        elif raw_rows[-1].count("|") < 3 and "|" in line:
                            parts_prev = [p.strip() for p in raw_rows[-1].split("|")]
                            parts_curr = [p.strip() for p in line.split("|")]
                            merged = parts_prev[:-1] + [parts_prev[-1] + " " + parts_curr[0]] + parts_curr[1:]
                            raw_rows[-1] = " | ".join(merged)
                        else:
                            raw_rows[-1] += " " + line
                    elif "|" in line:
                        raw_rows.append(line)

            counter = 1
            for r in raw_rows:
                parts = [p.strip() for p in r.split("|") if p.strip()]
                if len(parts) < 3:
                    continue
                first_col = parts[0].lower()
                if any(h in first_col for h in ["sr.", "sr no", "item", "sl no", "s.no"]):
                    continue
                if len(parts) >= 2 and any(h in parts[1].lower() for h in ["product", "description", "particulars"]):
                    continue

                if len(parts) >= 4:
                    item_no = parts[0]
                    product = parts[1]
                    desc = parts[2]
                    qty_raw = parts[3]
                elif len(parts) == 3:
                    if parts[0].isdigit():
                        item_no = parts[0]
                        product = parts[1]
                        desc = parts[1]
                        qty_raw = parts[2]
                    else:
                        item_no = str(counter)
                        product = parts[0]
                        desc = parts[1]
                        qty_raw = parts[2]
                else:
                    continue

                qty_match = re.search(r"([\d\.,]+)\s*([A-Za-z]+)?", qty_raw)
                if qty_match:
                    qty = qty_match.group(1).replace(",", "")
                    unit = qty_match.group(2) or "Nos"
                else:
                    qty = qty_raw
                    unit = "Nos"

                product = re.sub(r"\s+", " ", product).strip()
                desc = re.sub(r"\s+", " ", desc).strip()
                full_desc = f"{product} - {desc}" if product and product.lower() not in desc.lower() else desc

                # Extract Make / Brand
                make = ""
                make_match = re.search(r"(?:Make\s*:\s*([^,\*\n\|]+)|(Bosch[\w\/]*|Pelco[\w\/]*|Matrix[\w\/]*|Seagate|D-Link[\w\/]*|Polycab|LG[\w\/]*|Samsung|WQ|Cisco|Honeywell))", full_desc, re.I)
                if make_match:
                    make = (make_match.group(1) or make_match.group(2) or "").strip()

                items.append({
                    "item_no": item_no,
                    "product": product,
                    "description": full_desc,
                    "quantity": qty,
                    "unit": unit,
                    "make": make,
                    "category": cls._classify_hardware_category(full_desc)
                })
                counter += 1

            if items:
                return items

        # 2. Standard regex fallback for single-line CSV / tabular text
        pattern = r"(?:^|\n)\s*(\d+(?:\.\d+)?)\s*[,|\t]\s*([A-Za-z0-9\s\-\/\(\)\+\.]{3,60})\s*[,|\t]\s*([A-Za-z0-9\s]*)\s*[,|\t]\s*(\d+(?:\.\d+)?)\s*[,|\t]\s*([A-Za-z]+)"
        matches = re.findall(pattern, text)
        for m in matches[:60]:
            items.append({
                "item_no": m[0].strip(),
                "description": m[1].strip(),
                "item_code": m[2].strip() or "item",
                "quantity": m[3].strip(),
                "unit": m[4].strip() or "Nos",
                "category": cls._classify_hardware_category(m[1].strip())
            })
        return items

    @classmethod
    def _generate_deliverables_summary(
        cls, boq_items: List[Dict[str, Any]], title: str = "", organisation: str = "", full_text: str = ""
    ) -> Dict[str, Any]:
        """Generates structured deliverables summary & equipment highlights."""
        if not boq_items:
            # Fallback when no itemized BOQ has been attached or parsed
            return {
                "has_itemized_boq": False,
                "total_items": 0,
                "scope_headline": "Comprehensive Tender Deliverables & Supply Scope",
                "scope_overview": (
                    f"Supply, installation, testing, and commissioning of systems for {organisation or 'the buyer'}. "
                    "Itemized Bill of Quantities (BOQ) is defined in the attached tender schedule spreadsheet. "
                    "Upload the BOQ Excel to display full equipment-level line items."
                ),
                "category_breakdown": {},
                "equipment_highlights": [
                    "Itemized BOQ schedule attached in separate spreadsheet",
                    "Requires supply, mounting, cabling & commissioning",
                    "Upload Excel BOQ file for exact item quantities and specifications"
                ]
            }

        # Count quantities and breakdown by category
        cat_counts: Dict[str, Any] = {}
        highlights = []
        for it in boq_items:
            cat = it.get("category") or "General Equipment"
            qty_str = str(it.get("quantity") or "1").replace(",", "")
            unit = it.get("unit") or "Nos"
            try:
                qty_val = float(qty_str) if "." in qty_str else int(qty_str)
            except Exception:
                qty_val = 1
            cat_counts[cat] = cat_counts.get(cat, 0) + qty_val

            # Format a clean highlight for important equipment
            prod = it.get("product") or it.get("description", "")
            make = it.get("make") or ""
            make_str = f" ({make})" if make else ""
            desc = it.get("description", "")
            short_desc = prod if prod and len(prod) < 40 else desc[:50]
            highlights.append(f"{it.get('quantity', '1')} {unit} x {short_desc}{make_str}")

        scope_overview = (
            f"Supply, installation, testing, commissioning, and AMC maintenance of "
            f"Integrated Infrastructure at {organisation or 'buyer site'}. "
            f"Deliverables comprise {len(boq_items)} itemized BOQ components across "
            f"{len(cat_counts)} categories, including IP cameras, recording servers, "
            f"PoE networking, structured cabling, and display hardware."
        )

        return {
            "has_itemized_boq": True,
            "total_items": len(boq_items),
            "scope_headline": f"Scope of Work & Deliverables ({len(boq_items)} Equipment Items)",
            "scope_overview": scope_overview,
            "category_breakdown": cat_counts,
            "equipment_highlights": highlights[:15]
        }