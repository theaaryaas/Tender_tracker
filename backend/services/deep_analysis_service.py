import re
import io
import csv
from typing import Dict, Any, List, Optional
from pypdf import PdfReader
from sqlalchemy.orm import Session

class TenderDeepAnalyzerService:
    """
    Comprehensive Deep Analysis Engine for Tenders.
    Extracts and evaluates the 4 Essential Eligibility Criteria:
      1. MSME / Udyam Relaxation (EMD, Fee, Turnover, Experience, State-specific rules)
      2. Scope of Work (Software, STQC, ONVIF Conformance, CERT-In Certifications)
      3. Local Office / Jurisdiction (City/Municipal office, Gumasta, State boundaries)
      4. Hardware Scope & Bill of Materials (BOM / BOQ items)
    Along with Mandatory Documents Checklist and Overall Bid/No-Bid Decision.
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
    def parse_boq_items_from_csv_or_excel(cls, content: str | bytes, filename: str = "") -> List[Dict[str, Any]]:
        """Parses item-wise BOQ from CSV or text string."""
        items = []
        if isinstance(content, bytes):
            try:
                content = content.decode("utf-8", errors="ignore")
            except Exception:
                content = ""

        lines = content.splitlines()
        reader = csv.reader(lines)
        for row in reader:
            if not row or len(row) < 2:
                continue
            # Look for item number pattern like 1.01, 1.02, 1, 2
            col0 = row[0].strip()
            col1 = row[1].strip() if len(row) > 1 else ""
            if not col0 or not col1:
                continue
            if re.match(r"^\d+(\.\d+)?$", col0) and len(col1) > 2 and not col1.lower().startswith("sl") and not col1.lower().startswith("number"):
                qty = ""
                unit = "Nos"
                code = ""
                if len(row) > 2:
                    code = row[2].strip()
                if len(row) > 3 and re.match(r"^\d+(\.\d+)?$", row[3].strip()):
                    qty = row[3].strip()
                if len(row) > 4:
                    unit = row[4].strip() or "Nos"

                # Classify category
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

        # Parse BOQ items if present in text or provided separately
        boq_items = []
        if boq_content:
            boq_items = cls.parse_boq_items_from_csv_or_excel(boq_content)
        if not boq_items:
            boq_items = cls._extract_boq_items_from_text(full_text)

        # 1. Analyze MSME / Udyam Relaxation
        msme_res = cls._analyze_msme_relaxation(full_text, lower_text)

        # 2. Analyze Software Scope & Certifications (STQC, ONVIF, CERT-In)
        software_res = cls._analyze_software_scope(full_text, lower_text, title)

        # 3. Analyze Local Office & Jurisdiction (Bhopal Gumasta, state office, etc.)
        local_res = cls._analyze_local_office(full_text, lower_text, organisation)

        # 4. Analyze Hardware Scope & BOQ
        hardware_res = cls._analyze_hardware_scope(full_text, lower_text, boq_items)

        # 5. Extract Core Financials & Dates
        core_stats = cls._extract_core_stats(full_text, tender_id, title, organisation)

        # 6. Extract Mandatory Bid Documents Checklist
        checklist = cls._extract_mandatory_checklist(full_text, lower_text, local_res, msme_res)

        # 7. Compute Overall Decision & Fit Verdict
        verdict = cls._compute_verdict(msme_res, software_res, local_res, hardware_res)

        return {
            "tender_id": tender_id or core_stats.get("tender_id", ""),
            "title": title or core_stats.get("title", ""),
            "organisation": organisation or core_stats.get("organisation", ""),
            "analyzed_at": core_stats.get("analyzed_at", ""),
            "core_stats": core_stats,
            "overall_verdict": verdict,
            "criteria_checks": {
                "msme_relaxation": msme_res,
                "software_certifications": software_res,
                "local_office": local_res,
                "hardware_scope": hardware_res
            },
            "mandatory_documents_checklist": checklist,
            "boq_items": boq_items[:50], # Top 50 items for preview
            "total_boq_count": len(boq_items)
        }

    # -------------------------------------------------------------
    # Internal Evaluation Methods
    # -------------------------------------------------------------

    @classmethod
    def _analyze_msme_relaxation(cls, text: str, lower: str) -> Dict[str, Any]:
        """Evaluates MSME/Udyam EMD, Fee, Turnover & Experience rules."""
        # Check State restriction (e.g. MP only)
        is_state_restricted = bool(
            re.search(r"(?:म\.?प्र\.?|मध्य\s*प्रदेश|madhya\s*pradesh|state)\s*(?:के|of)?\s*(?:लघु|सूक्ष्म|msme|mse|startup|उद्योग|उद्यम)", text, re.I)
            or re.search(r"(?:situated|based|registered)\s+in\s+madhya\s+pradesh", lower)
            or re.search(r"out-of-state\s+mses?\s+.*not\s+eligible", lower)
        )

        state_name = "Madhya Pradesh (म.प्र.)" if "madhya pradesh" in lower or "म.प्र." in text or "भोपाल" in text else "Tender State Only"

        # Check EMD exemption
        emd_exempt = False
        emd_clause = ""
        emd_match = re.search(r"([^\n।]*?(?:लघु\s*उद्यम|सूक्ष्म|startup|स्टार्टअप|msme|mse)[^\n।]*?(?:छूट|exempt|relaxation)[^\n।]*)", text, re.I)
        if not emd_match:
            emd_match = re.search(r"([^\n।]*?(?:छूट|exempt|relaxation)[^\n।]*?(?:लघु\s*उद्यम|सूक्ष्म|startup|स्टार्टअप|msme|mse)[^\n।]*)", text, re.I)

        if emd_match:
            emd_exempt = True
            emd_clause = emd_match.group(1).strip()
        elif "emd exemption: yes" in lower or "emd: exempt" in lower or "exempt from emd" in lower:
            emd_exempt = True
            emd_clause = "EMD exemption granted to registered MSE / Startup units"

        # Check Tender Fee exemption
        fee_exempt = False
        fee_clause = "No exemption on Tender Fee. Mandatory non-refundable payment."
        if re.search(r"tender\s*fee[^\n।]*?(?:exempt|छूट)", lower):
            fee_exempt = True
            fee_clause = "Tender Fee exemption allowed for eligible MSE units."
        elif "tender fee" in lower or "ई-निविदा राशि" in text or "निविदा प्रपत्र मूल्य" in text:
            fee_clause = "Tender Fee must be paid online by all bidders (No MSME waiver stated)."

        # Check Turnover relaxation
        turnover_exempt = False
        turnover_detail = "No MSME relaxation stated for turnover. Minimum CA certified turnover applies."
        if re.search(r"turnover[^\n।]*?(?:relaxed|exempt|relaxation\s*:\s*yes|छूट)", lower):
            turnover_exempt = True
            turnover_detail = "Turnover criteria relaxed for MSEs / Startups."
        elif re.search(r"टर्न\s*ओवर\s*न्यूनतम\s*(\d+[\.\d]*\s*(?:लाख|करोड़|lakh))", text, re.I):
            t_match = re.search(r"टर्न\s*ओवर\s*न्यूनतम\s*(\d+[\.\d]*\s*(?:लाख|करोड़|lakh))", text, re.I)
            turnover_detail = f"Strict minimum turnover of {t_match.group(1)} mandated with CA certificate; no MSME relaxation clause."

        # Check Experience relaxation
        exp_exempt = False
        exp_detail = "No MSME relaxation specified for past experience."
        if re.search(r"experience[^\n।]*?(?:relaxed|exempt|relaxation\s*:\s*yes|छूट)", lower):
            exp_exempt = True
            exp_detail = "Past experience criteria relaxed for MSEs / Startups."

        # Status badge & summary
        if emd_exempt and is_state_restricted:
            status = "STATE_RESTRICTED"
            badge = "amber"
            title = f"EMD Exemption Restricted ({state_name} Bidders Only)"
            summary = f"EMD exemption is allowed strictly for MSEs/Startups situated in {state_name}. Out-of-state bidders must pay the full EMD."
        elif emd_exempt:
            status = "FULL_EXEMPTION"
            badge = "emerald"
            title = "Full MSME / Udyam EMD Exemption"
            summary = "Registered Micro & Small Enterprises (MSEs) and Startups are fully exempt from EMD."
        else:
            status = "NO_EXEMPTION"
            badge = "rose"
            title = "Strict EMD Payable / No MSME Waiver"
            summary = "All participating bidders must submit the mandated EMD; no MSME exemption is granted in this NIT."

        return {
            "status": status,
            "badge": badge,
            "title": title,
            "summary": summary,
            "is_state_restricted": is_state_restricted,
            "state_name": state_name if is_state_restricted else None,
            "emd_exempt": emd_exempt,
            "emd_clause": emd_clause or "Refer to General Tender Conditions.",
            "fee_exempt": fee_exempt,
            "fee_clause": fee_clause,
            "turnover_exempt": turnover_exempt,
            "turnover_detail": turnover_detail,
            "experience_exempt": exp_exempt,
            "experience_detail": exp_detail
        }

    @classmethod
    def _analyze_software_scope(cls, text: str, lower: str, title: str) -> Dict[str, Any]:
        """Evaluates STQC, ONVIF Conformance, CERT-In, and software scope."""
        # STQC Check
        stqc_required = bool(re.search(r"\bstqc\b|standardisation\s+testing\s+and\s+quality", lower))
        # ONVIF Check
        onvif_required = bool(re.search(r"\bonvif\b|profile\s*[sgt]", lower))
        # CERT-In Check
        cert_in_required = bool(re.search(r"\bcert-?in\b|cert-in\s+empanelled|safe-?to-?host", lower))

        # Detect Software Nature
        is_software = False
        software_type = "Hardware Supply & Physical AMC"
        if any(w in lower for w in ("software", "vms", "application", "portal", "license", "firmware", "m-cube")):
            is_software = True
            if "m-cube" in lower or "metering software" in lower:
                software_type = "Specialized Metering / COTS Software"
            elif any(w in lower for w in ("cctv", "camera", "nvr", "dvr", "ip camera", "lan", "wi-fi", "router")):
                software_type = "CCTV / Network Infrastructure & Firmware Configuration"
            else:
                software_type = "Software Solution / Application"

        # Scope Description
        scope_summary = []
        if is_software:
            scope_summary.append(f"Scope involves {software_type}.")
        if "cctv" in lower:
            scope_summary.append("Includes CCTV cameras, DVR/NVR surveillance setup, and monitoring.")
        if "lan" in lower or "network" in lower or "wi-fi" in lower:
            scope_summary.append("Includes LAN wiring, switches, IP routing, Wi-Fi management, and cable organization.")
        if not scope_summary:
            scope_summary.append(title[:120] if title else "Standard supply and maintenance scope.")

        return {
            "is_software_involved": is_software,
            "software_type": software_type,
            "scope_description": " ".join(scope_summary),
            "stqc": {
                "required": stqc_required,
                "badge": "rose" if stqc_required else "emerald",
                "label": "STQC Mandatory (Hard Blocker)" if stqc_required else "None Required",
                "detail": "STQC certification is strictly mandated in technical criteria." if stqc_required else "No STQC certification is demanded in this tender document."
            },
            "onvif": {
                "required": onvif_required,
                "badge": "rose" if onvif_required else "emerald",
                "label": "ONVIF Conformance Mandated" if onvif_required else "None Required",
                "detail": "ONVIF (Profile S/G/T) compliance required for video/CCTV devices." if onvif_required else "No ONVIF compliance certificates mandated."
            },
            "cert_in": {
                "required": cert_in_required,
                "badge": "rose" if cert_in_required else "emerald",
                "label": "CERT-In Audit Mandated" if cert_in_required else "None Required",
                "detail": "CERT-In empanelled security audit report / Safe-to-Host certificate required." if cert_in_required else "No CERT-In security empanelment required."
            }
        }

    @classmethod
    def _analyze_local_office(cls, text: str, lower: str, organisation: str) -> Dict[str, Any]:
        """Evaluates whether local office / Gumasta / Municipal registration is mandatory."""
        # Detect Bhopal Gumasta
        bhopal_gumasta = bool(
            re.search(r"भोपाल\s*नगर\s*निगम\s*सीमा\s*में\s*स्थापित", text)
            or (re.search(r"गुमास्ता|gumasta", text, re.I) and "भोपाल" in text)
        )

        # Detect Generic Local Gumasta
        generic_gumasta = bool(re.search(r"गुमास्ता|gumasta|shop\s*and\s*establishment|शॉप\s*एक्ट", text, re.I))

        # Detect Local Office Mandate
        local_office_clause = ""
        is_local_mandatory = False
        jurisdiction = "All-India (Open)"

        if bhopal_gumasta:
            is_local_mandatory = True
            jurisdiction = "Bhopal Municipal Corporation Limits (भोपाल नगर निगम सीमा)"
            local_office_clause = "Page 2, Clause 12: निविदाकर्ता फर्म भोपाल नगर निगम सीमा में स्थापित होना चाहिये जिसका गुमास्ता तकनीकी निविदा के साथ संलग्न करना आवश्यक होगा।"
        elif re.search(r"(?:local\s+office|branch\s+office|registered\s+office)\s+in\s+([A-Za-z\s]+)\s+(?:mandatory|compulsory|required)", lower):
            m = re.search(r"(?:local\s+office|branch\s+office|registered\s+office)\s+in\s+([A-Za-z\s]+)\s+(?:mandatory|compulsory|required)", lower)
            is_local_mandatory = True
            jurisdiction = m.group(1).strip().title()
            local_office_clause = f"Mandatory local branch/registered office required in {jurisdiction}."
        elif re.search(r"फर्म\s*का\s*(?:कार्यालय|ऑफिस)\s*([^\.\n]+)\s*में\s*होना\s*आवश्यक", text):
            m = re.search(r"फर्म\s*का\s*(?:कार्यालय|ऑफिस)\s*([^\.\n]+)\s*में\s*होना\s*आवश्यक", text)
            is_local_mandatory = True
            jurisdiction = m.group(1).strip()
            local_office_clause = f"फर्म का कार्यालय {jurisdiction} में होना आवश्यक है।"

        if is_local_mandatory:
            status = "STRICT_LOCAL_MANDATE"
            badge = "rose"
            title = f"Strict Local Office Mandate: {jurisdiction}"
            impact = f"⚠️ CRITICAL BLOCKER: Bidders must possess an active office and valid Gumasta/registration in {jurisdiction}. Out-of-city/state firms without this local license will be technically disqualified."
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
            "gumasta_required": bhopal_gumasta or generic_gumasta,
            "clause": local_office_clause or "No local office restriction stated."
        }

    @classmethod
    def _analyze_hardware_scope(cls, text: str, lower: str, boq_items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Evaluates hardware / Bill of Materials requirement."""
        has_hardware = len(boq_items) > 0 or any(
            hw in lower for hw in ("camera", "cctv", "nvr", "dvr", "poe", "switch", "router", "rack", "cable", "cat-6", "cmri", "hdd", "hard disk")
        )

        categories = set(item.get("category", "Hardware") for item in boq_items)

        if has_hardware:
            summary = f"Hardware supply & installation is mandatory ({len(boq_items)} items detected across {len(categories) or 1} categories). Evaluated on an overall lowest package basis."
        else:
            summary = "No major physical hardware identified. Primarily services/consulting/pure software."

        return {
            "hardware_mandatory": has_hardware,
            "badge": "amber" if has_hardware else "emerald",
            "total_items_detected": len(boq_items),
            "summary": summary,
            "categories": list(categories),
            "key_hardware_types": [
                cat for cat in ["CCTV Surveillance", "Networking & Switching", "Storage & Drives", "Passive Cabling & Racks"]
                if any(k.lower() in lower for k in cat.split())
            ]
        }

    @classmethod
    def _extract_core_stats(cls, text: str, tender_id: str, title: str, org: str) -> Dict[str, Any]:
        """Extracts financial and deadline stats."""
        # Estimated value
        est_val = "Not Disclosed by Buyer"
        val_match = re.search(r"(?:estimated\s*(?:value|cost)|निविदा\s*लागत|अनुमानित\s*लागत)\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?\s*(?:lakh|cr|crore)?)", text, re.I)
        if val_match:
            est_val = f"₹ {val_match.group(1).strip()}"

        # EMD
        emd_amt = "Check Tender ATC / PDF"
        emd_match = re.search(r"(?:ई\.?एम\.?डी\.?|emd\s*amount|earnest\s*money)\s*(?:राशि)?\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?)", text, re.I)
        if emd_match:
            emd_amt = f"₹ {emd_match.group(1).strip()}"

        # Tender Fee
        fee_amt = "Nil / Exempt"
        fee_match = re.search(r"(?:ई-निविदा\s*राशि|tender\s*fee|निविदा\s*प्रपत्र\s*मूल्य)\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?)", text, re.I)
        if fee_match:
            fee_amt = f"₹ {fee_match.group(1).strip()}"

        # End Date
        due_date = "Check Tender Portal"
        date_match = re.search(r"(?:अंतिम\s*तिथि|bid\s*end\s*date|closing\s*date|due\s*date)\s*[:\-]?\s*([0-9]{1,2}[-\.\/][0-9]{1,2}[-\.\/][0-9]{2,4}[^,\n\r]*)", text, re.I)
        if date_match:
            due_date = date_match.group(1).strip()

        # Opening Date
        open_date = "Check Tender Portal"
        open_match = re.search(r"(?:खोले\s*जाने\s*की\s*तिथि|bid\s*opening\s*date)\s*[:\-]?\s*([0-9]{1,2}[-\.\/][0-9]{1,2}[-\.\/][0-9]{2,4}[^,\n\r]*)", text, re.I)
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
    def _extract_mandatory_checklist(
        cls,
        text: str,
        lower: str,
        local_res: Dict[str, Any],
        msme_res: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Constructs the mandatory bid documents checklist with stamp paper and CA requirements."""
        checklist = []

        # 1. Local Registration / Gumasta
        if local_res.get("gumasta_required"):
            checklist.append({
                "item_no": "01",
                "document_name": f"Valid Gumasta / Shop & Establishment Certificate ({local_res.get('jurisdiction')})",
                "requirement_type": "MANDATORY (Strict Technical Blocker)",
                "clause_reference": "Page 2, Clause 12",
                "details": "Active commercial establishment registration within municipal limits."
            })

        # 2. PAN Card
        checklist.append({
            "item_no": "02",
            "document_name": "Permanent Account Number (PAN) Card",
            "requirement_type": "MANDATORY",
            "clause_reference": "Clause 13 / Checklist",
            "details": "Self-attested copy of bidder firm PAN card."
        })

        # 3. GST Registration & Returns
        checklist.append({
            "item_no": "03",
            "document_name": "GST Registration Certificate & Last 3 Years Filing Returns",
            "requirement_type": "MANDATORY",
            "clause_reference": "Clause 14 / Checklist",
            "details": "Valid GSTIN registration and 3 financial years of online tax filing receipts."
        })

        # 4. CA Certified Turnover Certificate
        turnover_val = "₹ 5.00 Lakhs" if "05" in text or "5" in text else "Prescribed Threshold"
        checklist.append({
            "item_no": "04",
            "document_name": f"CA Certified Annual Turnover Certificate (Min {turnover_val})",
            "requirement_type": "MANDATORY",
            "clause_reference": "Clause 15 / Checklist",
            "details": "Certificate from practicing Chartered Accountant with UDIN for FY 2024-25 / 2025-26."
        })

        # 5. Non-Blacklisting Affidavit on Non-Judicial Stamp Paper
        stamp_val = "₹ 100/-" if "100" in text else ("₹ 200/-" if "200" in text else "₹ 100/- to ₹ 200/-")
        checklist.append({
            "item_no": "05",
            "document_name": f"Non-Blacklisting / Integrity Affidavit on {stamp_val} Stamp Paper",
            "requirement_type": "MANDATORY",
            "clause_reference": "Clause 17 / Format-02",
            "details": f"Affidavit on {stamp_val} Non-Judicial Stamp Paper duly notarized stating firm has never been blacklisted."
        })

        # 6. EMD Receipt or MSME Udyam Certificate
        checklist.append({
            "item_no": "06",
            "document_name": "EMD Online Payment Receipt OR Valid MSME / Udyam Certificate",
            "requirement_type": "MANDATORY",
            "clause_reference": "Page 1, Clause 4",
            "details": f"Online portal challan OR eligible {msme_res.get('state_name', 'MSME')} certificate."
        })

        # 7. Manufacturer Authorization Form (MAF)
        if "oem" in lower or "maf" in lower or "authoriz" in lower:
            checklist.append({
                "item_no": "07",
                "document_name": "OEM Authorization Certificate (MAF)",
                "requirement_type": "CONDITIONAL",
                "clause_reference": "Technical Specifications",
                "details": "Manufacturer authorization for hardware equipment (CCTV, Switches, CMRI, Software)."
            })

        return checklist

    @classmethod
    def _compute_verdict(
        cls,
        msme_res: Dict[str, Any],
        software_res: Dict[str, Any],
        local_res: Dict[str, Any],
        hardware_res: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculates final Bid/No-Bid Decision, Score & Alert list."""
        score = 85
        key_alerts = []

        # Check Local Blocker
        if local_res.get("is_local_mandatory"):
            score -= 35
            key_alerts.append(f"CRITICAL BLOCKER: Mandates local office & Gumasta license in {local_res.get('jurisdiction')}.")

        # Check STQC Blocker
        if software_res.get("stqc", {}).get("required"):
            score -= 30
            key_alerts.append("HIGH RISK: STQC Certification required for software.")

        # Check EMD State Restriction
        if msme_res.get("is_state_restricted"):
            score -= 10
            key_alerts.append(f"EMD Exemption restricted to {msme_res.get('state_name', 'In-State')} bidders only.")

        # Clamp Score
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
            summary = "Tender is technically feasible but carries location-specific or fee restrictions (e.g. Local Gumasta or state EMD payment required)."
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
        if any(w in d for w in ("camera", "cctv", "dvr", "nvr", "dome", "bullet", "ptz", "bnc")):
            return "CCTV & Surveillance"
        if any(w in d for w in ("switch", "router", "poe", "sfp", "port", "lan", "wi-fi", "kvm")):
            return "Networking & Switching"
        if any(w in d for w in ("hdd", "hard disk", "sata", "ssd", "tb", "storage")):
            return "Storage & Drives"
        if any(w in d for w in ("cable", "cat-6", "cat6", "wire", "patch", "rack", "connector", "jack")):
            return "Passive Cabling & Racks"
        if any(w in d for w in ("software", "license", "vms", "firmware", "cmri")):
            return "Software & Licensing"
        if any(w in d for w in ("wages", "visit", "charge", "installation", "maintenance")):
            return "Services & Labor"
        return "General Hardware"

    @classmethod
    def _extract_boq_items_from_text(cls, text: str) -> List[Dict[str, Any]]:
        """Fallback extractor for BOQ lists embedded in plain text."""
        items = []
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
