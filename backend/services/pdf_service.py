import httpx
import re
import io
from typing import Dict, Any, Optional
from pypdf import PdfReader
from backend.core.config import settings

class PDFService:
    @staticmethod
    async def extract_clauses_from_url(pdf_url: str, client: Optional[httpx.AsyncClient] = None) -> Dict[str, Any]:
        """
        Downloads a tender notice PDF and parses commercial, financial, and technical clauses.
        Returns: { estimated_value, emd_amount, emd_exemption, epbg_required, turnover_required, experience_required, scope_summary, extracted_pdf_text }
        """
        result = {
            "estimated_value": "Not Disclosed by Buyer on GeM",
            "emd_amount": "Nil / Not Required",
            "emd_exemption": "EMD not required for this bid",
            "epbg_required": "Not Required",
            "turnover_required": "No Minimum Turnover Mandated",
            "bidder_turnover": None,
            "oem_turnover": None,
            "experience_required": "Relevant past project experience certificates required",
            "experience_years": None,
            "mse_relaxation": "Verify in ATC / Standard MSME rules",
            "startup_relaxation": "Verify in ATC / DPIIT certificate required",
            "scope_summary": "",
            "extracted_pdf_text": ""
        }

        if not pdf_url:
            return result

        try:
            close_client = False
            if client is None:
                client = httpx.AsyncClient(timeout=35.0, follow_redirects=True)
                close_client = True

            headers = {
                "User-Agent": settings.USER_AGENT,
                "Accept": "application/pdf,*/*"
            }
            response = await client.get(pdf_url, headers=headers)

            if close_client:
                await client.aclose()

            if response.status_code != 200 or len(response.content) < 500:
                result["scope_summary"] = f"Could not retrieve PDF (HTTP {response.status_code})"
                return result

            # Parse PDF bytes
            reader = PdfReader(io.BytesIO(response.content))
            num_pages = len(reader.pages)
            pages_text = []

            for i in range(num_pages):
                txt = reader.pages[i].extract_text() or ""
                pages_text.append(txt)

            full_text = "\n".join(pages_text)
            if not full_text.strip():
                result["scope_summary"] = "PDF document contains scanned images without text layer."
                return result

            # Clean readable text for user inspection in UI drawer (filter out Devanagari noise & control chars)
            raw_excerpt = "\n\n--- PAGE EXCERPT ---\n\n".join(
                p.strip() for p in pages_text[:4] if p.strip()
            )
            clean_t = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', raw_excerpt)
            clean_t = re.sub(r'[\u0900-\u097F]+', '', clean_t)
            clean_t = re.sub(r'Turnover\s+of\s+the\s+bidder\s*\(For\s+the\s+last\s+3:?\s*Financial\s+Years\)', 'Turnover of the bidder (For 3 Years)', clean_t, flags=re.I)
            clean_t = re.sub(r'MSE\s+Relaxation\s+for\s+Years\s+Of\s+Experience:?\s+and\s+Turnover:?\s+Yes', 'MSE Relaxation for Years of Experience and Turnover: Yes', clean_t, flags=re.I)
            clean_t = re.sub(r'Startup\s+Relaxation\s+for\s+Years\s+Of:?\s+Experience\s+and\s+Turnover:?\s+Yes', 'Startup Relaxation for Years of Experience and Turnover: Yes', clean_t, flags=re.I)

            valid_words = {'to', 'in', 'of', 'on', 'at', 'by', 'no', 'as', 'is', 'or', 'if', 'an', 'we', 'do', 'up', 'us', 'rs', 're'}
            filtered_lines = []
            for line in clean_t.split('\n'):
                l = re.sub(r'^[\s/:\-]+|[\s/:\-]+$', '', line).strip()
                if not l:
                    continue
                # Drop isolated icon font glyphs / table bullets (E, F, H, I, J, L, P, FJ, X, Y, a, c, e)
                if len(l) <= 2 and l.lower() not in valid_words and not l.isdigit():
                    continue
                if re.match(r'^[^\w\s]+$', l):
                    continue
                if filtered_lines and filtered_lines[-1].lower() == l.lower():
                    continue
                filtered_lines.append(l)

            # Strip leading Bid / Details / table debris
            while filtered_lines and filtered_lines[0].lower() in ('bid', 'details', 'bid details', 'bid document', 'document'):
                filtered_lines.pop(0)

            # Merge broken lines and pair key headers with values
            formatted_lines = ['=== OFFICIAL GeM BID DETAILS & SPECIFICATIONS ===\n']
            key_headers = [
                'Bid End Date/Time', 'Bid Opening Date/Time', 'Bid Offer Validity',
                'Ministry/State Name', 'Department Name', 'Organisation Name', 'Office Name',
                'Total Quantity', 'Item Category', 'Minimum Average Annual Turnover of the bidder',
                'OEM Average Turnover', 'Years of Past Experience Required',
                'Turnover eligibility criteria', 'MSE Relaxation', 'Startup Relaxation',
                'Primary product category', 'Type of Bid', 'Evaluation Method', 'RA Qualification Rule',
                'Advisory Bank', 'ePBG Percentage', 'EMD Amount', 'Beneficiary'
            ]

            idx = 0
            while idx < len(filtered_lines):
                line = filtered_lines[idx]
                matched_kh = None
                for kh in key_headers:
                    if line.lower().startswith(kh.lower()):
                        matched_kh = kh
                        break
                
                if matched_kh and idx + 1 < len(filtered_lines):
                    val = filtered_lines[idx + 1]
                    is_other_kh = any(val.lower().startswith(kh.lower()) for kh in key_headers)
                    if not is_other_kh and len(val) < 180:
                        formatted_lines.append(f"{line}: {val}")
                        idx += 2
                        continue
                formatted_lines.append(line)
                idx += 1

            result["extracted_pdf_text"] = "\n".join(formatted_lines)[:7000]

            # 1. EMD Amount & Exemption Parsing (GeM & general)
            emd_section = re.search(r"/(?:EMD Detail|ईएमड[\s\S]*?ववरण)[\s\S]{1,150}?(?:आवPयकता|Required)[\s\S]{1,40}?(No|Yes)", full_text, re.I)
            if emd_section:
                val = emd_section.group(1).strip().capitalize()
                if val == "No":
                    result["emd_amount"] = "Nil / Not Required"
                    result["emd_exemption"] = "EMD is not required for this bid"
                else:
                    amt_match = re.search(r"EMD\s+Amount[\s\S]{1,60}?(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)", full_text, re.I)
                    if amt_match:
                        result["emd_amount"] = f"₹ {amt_match.group(1).strip()}"
                        result["emd_exemption"] = "EMD mandatory (Verify MSME / Startup exemption in ATC)"
                    else:
                        result["emd_amount"] = "Required (See ATC for Amount)"
            else:
                amt_match = re.search(r"EMD\s+(?:Amount|Required|Value)?\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.\d{2})?)", full_text, re.I)
                amt_match = re.search(r"EMD\s+(?:Amount|Required|Value)?\s*[:\-]?\s*(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.\d{2})?)", full_text, re.I)
                if amt_match and amt_match.group(1).replace(",", "") not in ("0", "00"):
                    result["emd_amount"] = f"₹ {amt_match.group(1).strip()}"

            # 2. ePBG / Performance Bank Guarantee
            epbg_pct = re.search(r"ePBG\s+Percentage\s*(?:\(%?\))?\s*[\r\n\s]*([0-9.]+)", full_text, re.I)
            epbg_section = re.search(r"/(?:ePBG Detail|ईपीबीजी[\s\S]*?ववरण)[\s\S]{1,150}?(?:आवPयकता|Required)[\s\S]{1,40}?(No|Yes)", full_text, re.I)
            if epbg_pct and float(epbg_pct.group(1)) > 0:
                result["epbg_required"] = f"Required ({epbg_pct.group(1)}%)"
            elif epbg_section:
                epbg_val = epbg_section.group(1).strip().capitalize()
                result["epbg_required"] = "Not Required" if epbg_val == "No" else "Required (Performance Security)"
            else:
                result["epbg_required"] = "Not Required"

            # 3. Startup & MSE Relaxations
            mse_match = re.search(r"MSE\s+Relaxation(?:\s+for\s+Years\s+of\s+Experience\s+and\s+Turnover)?[\s\S]{1,80}?\n\s*(Yes|No)", full_text, re.I)
            if mse_match:
                mse_val = mse_match.group(1).strip().capitalize()
                if mse_val == "Yes":
                    result["mse_relaxation"] = "Yes (Relaxation for Experience & Turnover)"
                else:
                    result["mse_relaxation"] = "No (No Relaxation for MSEs)"
            elif re.search(r"Purchase\s+preference\s+to\s+Micro\s+and\s+Small\s+Enterprises[\s\S]{1,60}?(Yes|No)", full_text, re.I):
                pref_m = re.search(r"Purchase\s+preference\s+to\s+Micro\s+and\s+Small\s+Enterprises[\s\S]{1,60}?(Yes|No)", full_text, re.I)
                if pref_m.group(1).strip().capitalize() == "Yes":
                    result["mse_relaxation"] = "Yes (MSE Purchase Preference applicable)"
                else:
                    result["mse_relaxation"] = "No (Purchase preference not applicable)"
            else:
                result["mse_relaxation"] = "Verify in ATC / Standard MSME rules"

            startup_match = re.search(r"Startup\s+Relaxation(?:\s+for\s+Years\s+of\s+Experience\s+and\s+Turnover)?[\s\S]{1,80}?\n\s*(Yes|No)", full_text, re.I)
            if startup_match:
                st_val = startup_match.group(1).strip().capitalize()
                if st_val == "Yes":
                    result["startup_relaxation"] = "Yes (Relaxation for Experience & Turnover)"
                else:
                    result["startup_relaxation"] = "No (No Relaxation for Startups)"
            else:
                result["startup_relaxation"] = "Verify in ATC / DPIIT certificate required"

            startup_rel = (startup_match and startup_match.group(1).lower() == "yes")
            mse_rel = (mse_match and mse_match.group(1).lower() == "yes")

            # 4. Turnover Requirement
            m_bidder = re.search(r"Minimum\s+Average\s+Annual\s+Turnover\s+of\s+the\s+bidder(?:\s*\([^)]*\))*\s*[:\-]?\s*\n\s*([0-9.]+\s*(?:Lakh|Crore|Cr|Lakhs)?(?:\s*\(s\))?)", full_text, re.I)
            m_oem = re.search(r"OEM\s+(?:Average\s+)?Turnover(?:\s*\([^)]*\))*\s*[:\-]?\s*\n\s*([0-9.]+\s*(?:Lakh|Crore|Cr|Lakhs)?(?:\s*\(s\))?)", full_text, re.I)

            if m_bidder or m_oem:
                to_parts = []
                if m_bidder:
                    result["bidder_turnover"] = m_bidder.group(1).strip()
                    to_parts.append(f"Bidder: ₹ {m_bidder.group(1).strip()}")
                if m_oem:
                    result["oem_turnover"] = m_oem.group(1).strip()
                    to_parts.append(f"OEM: ₹ {m_oem.group(1).strip()}")
                to_text = " | ".join(to_parts)
                if startup_rel or mse_rel:
                    to_text += " (Exempt/Relaxed for DPIIT Startups & MSEs)"
                result["turnover_required"] = to_text
            else:
                seller_docs_m = re.search(r"Document required\s+from seller[\s\S]{1,100}?\n\s*([^\n\r*]+)", full_text, re.I)
                seller_docs = seller_docs_m.group(1).strip() if seller_docs_m else ""
                if "Turnover" not in seller_docs and "टन%ओवर" not in seller_docs:
                    result["turnover_required"] = "No Minimum Turnover Mandated (Only Past Experience & OEM Auth required)"
                elif startup_rel or mse_rel:
                    result["turnover_required"] = "Exempt for DPIIT Startups / MSEs (Standard GeM Terms)"
                else:
                    turnover_explicit = re.search(r"(?:Annual|Bidder)\s+Turnover\s*[:\-]?\s*(?:INR|Rs\.?|₹)\s*([0-9,.]+\s*(?:Lakh|Crore|Cr|Lakhs))", full_text, re.I)
                    if turnover_explicit:
                        result["turnover_required"] = f"₹ {turnover_explicit.group(1).strip()}"
                    else:
                        result["turnover_required"] = "As per ATC / GeM Verified Turnover (No minimum cap published)"

            # 5. Estimated Tender Value & Order Criteria
            est_match = re.search(r"(?:Estimated\s+(?:Bid|Tender|Contract)?\s*Value|Total\s+Estimated\s+Value)\s*[:\-]?\s*(?:INR|Rs\.?|₹)?\s*([0-9,.]+\s*(?:Lakh|Crore|Cr|Lakhs)?)", full_text, re.I)
            if est_match:
                result["estimated_value"] = f"₹ {est_match.group(1).strip()}"
            else:
                # Check 3-order formula (1 order of 80%, 2 of 50%, 3 of 40%)
                m1 = re.search(r"One\s+(?:same\s*/\s*similar|similar)?[^\n\r]*?valuing not less than[^\d]*?Rs\.?\s*([0-9, ]+)", full_text, re.I)
                m2 = re.search(r"Two\s+(?:same\s*/\s*similar|similar)?[^\n\r]*?valuing not less than[^\d]*?Rs\.?\s*([0-9, ]+)", full_text, re.I)
                m3 = re.search(r"Three\s+(?:same\s*/\s*similar|similar)?[^\n\r]*?valuing not less than[^\d]*?Rs\.?\s*([0-9, ]+)", full_text, re.I)

                if m1 and m2 and m3:
                    o1 = m1.group(1).strip()
                    o2 = m2.group(1).strip()
                    o3 = m3.group(1).strip()
                    try:
                        clean_num = float(re.sub(r"[^\d.]", "", o1))
                        est_calc = round((clean_num / 0.8) / 100000, 2)
                        result["estimated_value"] = f"~ ₹ {est_calc} Lakhs (Derived from 80% threshold)"
                    except Exception:
                        result["estimated_value"] = f"1 Order of ₹{o1} / 2 of ₹{o2} / 3 of ₹{o3}"

                    result["experience_required"] = (
                        f"Order thresholds: 1 order of ₹{o1} | 2 orders of ₹{o2} | 3 orders of ₹{o3}."
                    )

            # 4. Startup / MSME Relaxation & Exemption
            if re.search(r"For Startups party need to submit DPIIT certificate to get exemption", full_text, re.I):
                if result["experience_required"] != "Check tender PDF / ATC":
                    result["experience_required"] += " (DPIIT Startups exempt with PoC / relevant PO)"
                else:
                    result["experience_required"] = "DPIIT Startups exempt with PoC / relevant PO"
                    # Check total quantity
                    m_qty = re.search(r"Total\s+Quantity\s*\n\s*([0-9,]+)", full_text, re.I)
                    if m_qty:
                        result["estimated_value"] = f"Qty: {m_qty.group(1).strip()} Units (Buyer unquoted)"

            if "Startup Relaxation for Years of Experience and Turnover\nYes" in full_text:
                result["emd_exemption"] = "Startups / MSME Exempted from Prior Turnover & Experience"

            # 5. Specific Experience Criteria
            if "Check tender PDF" in result["experience_required"]:
                spec_exp = re.search(r"Experience Criteria[\s\S]{1,40}?(Successfully supplied[^\n\r]{20,250})", full_text, re.I)
                if spec_exp:
                    result["experience_required"] = spec_exp.group(1).strip()
            # 6. Past Experience Criteria (Years or Thresholds)
            if "Order thresholds" not in result["experience_required"]:
                m_exp = re.search(r"Years\s+of\s+Past\s+Experience\s+Required[\s\S]{1,80}?\n\s*(\d+\s*Years?(?:\s*\(s\))?)", full_text, re.I)
                if m_exp:
                    result["experience_years"] = m_exp.group(1).strip()
                    result["experience_required"] = f"Minimum {m_exp.group(1).strip()} past experience in similar domain required."
                else:
                    exp_years = re.search(r"(?:Years\s+of\s+)?Past\s+Experience\s+Required\s*[:\-]?\s*(\d+\s*Years?)", full_text, re.I)
                    if exp_years:
                        result["experience_years"] = exp_years.group(1).strip()
                        result["experience_required"] = f"Minimum {exp_years.group(1).strip()} past experience required."
                    spec_exp = re.search(r"Experience Criteria[\s\S]{1,40}?(Successfully supplied[^\n\r]{20,250})", full_text, re.I)
                    if spec_exp:
                        result["experience_required"] = spec_exp.group(1).strip()
                    else:
                        result["experience_required"] = "Relevant past project experience certificates & OEM authorization required."

            # Startup / MSME Relaxation Note for Experience
            if re.search(r"For Startups party need to submit DPIIT certificate to get exemption", full_text, re.I):
                result["experience_required"] += " (DPIIT Startups exempt with PoC / relevant PO)"
            elif startup_rel:
                result["experience_required"] += " (Exempted for DPIIT Recognized Startups)"

            # 7. Scope Summary / Item Category
            scope_cat = re.search(r"/Item Category\s*\n\s*([^\n\r]+)", full_text, re.I)
            if scope_cat:
                result["scope_summary"] = scope_cat.group(1).strip()
            else:
                scope_alt = re.search(r"(?:Scope\s+of\s+Work|Brief\s+Description)[:\-]?\s*([^\n\r]{20,250})", full_text, re.I)
                if scope_alt:
                    result["scope_summary"] = scope_alt.group(1).strip()

        except Exception as e:
            result["scope_summary"] = f"Extraction note: {str(e)[:100]}"

        return result
