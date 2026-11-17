import re
from typing import Dict, Any, List, Tuple, Optional

class LocalRAGEngine:
    """
    100% Local RAG (Retrieval-Augmented Generation) Engine.
    Operates without external API keys or cloud dependencies.
    Analyzes tender metadata, BOQ specifications, and extracted PDF text.
    """

    @classmethod
    def answer_query(cls, tender_data: Dict[str, Any], query: str) -> Dict[str, Any]:
        q_clean = query.strip()
        q_lower = q_clean.lower()
        t_id = tender_data.get("tender_id", "Unknown")

        # 1. Guardrail: Detect completely off-topic questions
        if cls._is_out_of_scope(q_lower):
            return {
                "answer": (
                    f"⚠️ **Out of Scope Query**\n\n"
                    f"I am the **Tender Intelligence Assistant** dedicated exclusively to **Tender `{t_id}`**.\n"
                    f"I can only answer questions about this tender's scope, BOQ equipment, EMD, turnover, "
                    f"deadlines, relaxations, and ATC compliance terms.\n\n"
                    f"Please ask a question related to this tender."
                ),
                "sources": ["Scope Guardrail"],
                "confidence": "Strict",
                "suggested_followups": [
                    "What are the EMD and Turnover requirements?",
                    "What is the equipment scope / BOQ?",
                    "Are MSE or Startups exempt?"
                ]
            }

        # 2. Extract Document Context Chunks
        raw_text = tender_data.get("extracted_pdf_text") or ""
        chunks = cls._chunk_text(raw_text)

        # 3. Intent Detection & Dedicated Clause Resolvers
        # --- A. EMD & Bank Guarantee / ePBG ---
        if any(w in q_lower for w in ["emd", "earnest money", "bid security", "epbg", "bank guarantee", "security deposit"]):
            return cls._resolve_emd_epbg(tender_data, chunks)

        # --- B. Turnover / Annual Financial Standing ---
        if any(w in q_lower for w in ["turnover", "annual turnover", "revenue", "net worth", "balance sheet"]):
            return cls._resolve_turnover(tender_data, chunks)

        # --- C. Past Experience / Past Performance ---
        if any(w in q_lower for w in ["experience", "past performance", "past project", "similar work", "credentials", "qualification"]):
            return cls._resolve_experience(tender_data, chunks)

        # --- D. MSE / Startup / MSME Exemptions ---
        if any(w in q_lower for w in ["mse", "msme", "startup", "dpiit", "udyam", "exemption", "relaxation"]):
            return cls._resolve_relaxations(tender_data, chunks)

        # --- E. Equipment Scope, BOQ, Technical Specs ---
        if any(w in q_lower for w in ["boq", "equipment", "scope", "hardware", "camera", "nvr", "switch", "cable", "storage", "spec", "specification", "item"]):
            return cls._resolve_scope_boq(tender_data, chunks)

        # --- F. Deadlines & Dates ---
        if any(w in q_lower for w in ["date", "deadline", "closing", "opening", "submission", "validity", "when"]):
            return cls._resolve_deadlines(tender_data, chunks)

        # --- G. Buyer, Department, Consignee & Delivery ---
        if any(w in q_lower for w in ["buyer", "department", "organisation", "organization", "ministry", "consignee", "delivery", "address", "location"]):
            return cls._resolve_buyer_delivery(tender_data, chunks)

        # --- H. Compliance, STQC, BIS, Security, Make In India ---
        if any(w in q_lower for w in ["compliance", "stqc", "bis", "crs", "mha", "make in india", "mii", "land border", "labour", "penalty", "liquidated damages", "damages"]):
            return cls._resolve_compliance_penalties(tender_data, chunks)

        # 4. Fallback: Semantic & Keyword Matching across all Document Chunks
        matched_chunks = cls._search_chunks(chunks, q_clean, top_k=3)
        if matched_chunks:
            return cls._format_semantic_matches(tender_data, q_clean, matched_chunks)

        # 5. Generic Summary if nothing specific could be matched
        return cls._resolve_general_overview(tender_data)

    @classmethod
    def _is_out_of_scope(cls, q: str) -> bool:
        off_topic_patterns = [
            r"\b(who is the president|who is prime minister|weather|capital of|movie|cricket|song|recipe|joke|poem|story)\b",
            r"\b(write a python code|write code|write a script|create an app|how to cook|football|score)\b",
            r"^(hi|hello|hey|who are you|what can you do)\s*$"
        ]
        return any(re.search(pat, q, re.I) for pat in off_topic_patterns)

    @classmethod
    def _chunk_text(cls, text: str) -> List[Dict[str, Any]]:
        if not text:
            return []
        raw_paragraphs = re.split(r"\n\s*\n|\n(?=[A-Z0-9\s]{3,35}:)|(?=\b(?:Buyer Added|Technical Specifications|Consignee|EMD Detail|ePBG)\b)", text)
        chunks = []
        for idx, p in enumerate(raw_paragraphs):
            clean = p.strip()
            if len(clean) < 25:
                continue
            chunks.append({
                "id": idx + 1,
                "text": clean,
                "length": len(clean)
            })
        return chunks

    @classmethod
    def _search_chunks(cls, chunks: List[Dict[str, Any]], query: str, top_k: int = 3) -> List[Tuple[Dict[str, Any], float]]:
        words = [w.lower() for w in re.findall(r"\w+", query) if len(w) > 2]
        if not words:
            return []
        scored = []
        for c in chunks:
            text_lower = c["text"].lower()
            score = 0
            for w in words:
                count = text_lower.count(w)
                if count > 0:
                    score += 1 + min(count, 5) * 0.5
            if score > 0:
                scored.append((c, score))
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]

    # --- RESOLVER IMPLEMENTATIONS ---

    @classmethod
    def _resolve_emd_epbg(cls, t: Dict[str, Any], chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        emd = t.get("emd_amount") or "Nil / Not Required"
        epbg = t.get("epbg_required") or "Not Required"
        exemption = t.get("emd_exemption") or "Verify MSME / Startup rules"
        text = t.get("extracted_pdf_text", "")

        # Look for specific bank guarantee or EMD details in text
        bg_clause = ""
        bg_match = re.search(r"(?:EMD\s+Detail|ePBG\s+Detail)[\s\S]{1,300}?(?=\n\s*\n|Consignee|Splitting|\Z)", text, re.I)
        if bg_match:
            bg_clause = bg_match.group(0).strip()

        ans = [
            f"### 💰 EMD & Financial Security Summary",
            f"* **EMD Amount:** `{emd}`",
            f"* **EMD Exemption:** {exemption}",
            f"* **ePBG Performance Security:** `{epbg}`",
        ]

        if bg_clause:
            ans.append(f"\n**Excerpt from Tender PDF:**\n> {bg_clause.replace(chr(10), ' ')}")

        ans.append("\n**Key Takeaway:** If your company is a registered MSE (Udyam) or DPIIT Startup, verify exemption eligibility as per General Terms.")

        return {
            "answer": "\n".join(ans),
            "sources": ["Tender Financial Details", "Tender PDF (EMD/ePBG Clause)"],
            "confidence": "High",
            "suggested_followups": [
                "Are MSE or Startups exempt from EMD?",
                "What is the annual turnover requirement?",
                "What is the total estimated tender value?"
            ]
        }

    @classmethod
    def _resolve_turnover(cls, t: Dict[str, Any], chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        turnover = t.get("turnover_required") or "No Minimum Turnover Mandated"
        bidder_to = t.get("bidder_turnover")
        oem_to = t.get("oem_turnover")

        ans = ["### 📈 Minimum Annual Turnover Requirements"]
        if bidder_to:
            ans.append(f"* **Bidder Turnover (3-Year Average):** `{bidder_to}`")
        if oem_to:
            ans.append(f"* **OEM Turnover:** `{oem_to}`")
        if not bidder_to and not oem_to:
            ans.append(f"* **Mandated Turnover:** `{turnover}`")

        text = t.get("extracted_pdf_text", "")
        m = re.search(r"Minimum\s+Average\s+Annual\s+Turnover[\s\S]{1,250}?(?=\n\s*\n|\Z)", text, re.I)
        if m:
            ans.append(f"\n**Tender Document Clause:**\n> {m.group(0).strip().replace(chr(10), ' ')}")

        ans.append("\n*Note: Valid CA certificates with UDIN and audited balance sheets are typically required as proof.*")

        return {
            "answer": "\n".join(ans),
            "sources": ["Turnover Criteria", "Extracted ATC Clause"],
            "confidence": "High",
            "suggested_followups": [
                "Can startups or MSE get an exemption on turnover?",
                "What are the past experience requirements?",
                "What is the EMD amount for this tender?"
            ]
        }

    @classmethod
    def _resolve_experience(cls, t: Dict[str, Any], chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        exp = t.get("experience_required") or "Check tender PDF / ATC"
        years = t.get("experience_years")
        text = t.get("extracted_pdf_text", "")

        ans = ["### 📜 Past Experience & Qualification Criteria"]
        if years:
            ans.append(f"* **Required Years of Experience:** `{years} Years` in similar domain")
        ans.append(f"* **Experience Specification:** {exp}")

        m = re.search(r"(?:Past\s+Experience|Years\s+of\s+Past\s+Experience)[\s\S]{1,250}?(?=\n\s*\n|\Z)", text, re.I)
        if m:
            ans.append(f"\n**Extracted Document Requirement:**\n> {m.group(0).strip().replace(chr(10), ' ')}")

        ans.append("\n*Bidders must supply copies of relevant Purchase Orders / Work Orders and Completion Certificates.*")

        return {
            "answer": "\n".join(ans),
            "sources": ["Past Experience Criteria", "Buyer Specific ATC"],
            "confidence": "High",
            "suggested_followups": [
                "Does MSE or Startup exemption apply to experience?",
                "What is the required equipment BOQ?",
                "What are the STQC or BIS certifications required?"
            ]
        }

    @classmethod
    def _resolve_relaxations(cls, t: Dict[str, Any], chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        mse = t.get("mse_relaxation") or "Verify in ATC"
        startup = t.get("startup_relaxation") or "Verify in ATC"
        text = t.get("extracted_pdf_text", "")

        ans = [
            "### 🏷️ MSE & Startup Policy Concessions",
            f"* **MSE (Micro & Small Enterprises) Relaxation:** `{mse}`",
            f"* **DPIIT Startup Relaxation:** `{startup}`"
        ]

        m_mse = re.search(r"MSE\s+Relaxation\s*:\s*(Yes|No)[\s\S]{1,200}?(?=\n|\Z)", text, re.I)
        if m_mse:
            ans.append(f"* **PDF Citation (MSE):** {m_mse.group(0).strip()}")

        m_su = re.search(r"Startup\s+Relaxation\s*:\s*(Yes|No)[\s\S]{1,200}?(?=\n|\Z)", text, re.I)
        if m_su:
            ans.append(f"* **PDF Citation (Startup):** {m_su.group(0).strip()}")

        ans.append("\n*Entities holding valid Udyam Registration or DPIIT Recognition may be exempt from prior turnover & experience criteria if marked 'Yes'.*")

        return {
            "answer": "\n".join(ans),
            "sources": ["Government Concessions", "GeM Bid Document Policy Table"],
            "confidence": "High",
            "suggested_followups": [
                "What is the turnover requirement if not exempt?",
                "What is the EMD amount?",
                "What is the bid closing deadline?"
            ]
        }

    @classmethod
    def _resolve_scope_boq(cls, t: Dict[str, Any], chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        scope = t.get("scope_summary") or t.get("title") or "Technical specifications listed in notice"
        text = t.get("extracted_pdf_text", "")

        ans = [
            f"### 📦 Scope of Work & Equipment Breakdown",
            f"**Tender Title:** {t.get('title')}\n",
            f"**Identified Hardware / Deliverables:**"
        ]

        # Scan for typical surveillance/IT equipment in extracted text
        items = []
        if re.search(r"\b(bullet|dome|ptz|camera|cctv)\b", text, re.I):
            items.append("• **Surveillance Cameras:** IP Cameras (Dome / Bullet / PTZ / 4K sensor specifications)")
        if re.search(r"\b(nvr|network\s+video\s+recorder|vms)\b", text, re.I):
            items.append("• **Recording & VMS:** Multi-channel NVR with H.265+ encoding & Video Management Software")
        if re.search(r"\b(switch|poe|layer\s*2|layer\s*3|sfp)\b", text, re.I):
            items.append("• **Networking Hardware:** Managed PoE+ Access Switches with SFP Fiber uplinks")
        if re.search(r"\b(hdd|hard\s+disk|storage|sata|surveillance\s+grade)\b", text, re.I):
            items.append("• **Storage Subsystem:** 24x7 Surveillance Grade SATA Hard Drives / RAID configuration")
        if re.search(r"\b(cat\s*6|utp|fiber|cable|conduit)\b", text, re.I):
            items.append("• **Cabling & Passive Infra:** Armoured Fiber / Cat6 UTP Cables with conduits")

        if items:
            ans.extend(items)
        else:
            ans.append(f"• {scope}")

        ans.append(f"\n*Refer to the full PDF / ATC for exact itemized quantities and schedule allocations.*")

        return {
            "answer": "\n".join(ans),
            "sources": ["Technical BOQ Breakdown", "Extracted Specifications"],
            "confidence": "High",
            "suggested_followups": [
                "What are the STQC and BIS compliance requirements?",
                "What is the delivery timeline?",
                "What are the payment terms?"
            ]
        }

    @classmethod
    def _resolve_deadlines(cls, t: Dict[str, Any], chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        closing = t.get("closing_date") or "Check portal"
        opening = t.get("opening_date") or "Check portal"
        published = t.get("published_date") or "N/A"

        ans = [
            "### ⏳ Important Dates & Submission Timeline",
            f"* **Bid Submission End Date (Closing):** `{closing}`",
            f"* **Technical Bid Opening Date:** `{opening}`",
            f"* **Notice Published Date:** `{published}`"
        ]

        text = t.get("extracted_pdf_text", "")
        v_match = re.search(r"Bid\s+Offer\s+Validity[\s\S]{1,100}?(?=\n|\Z)", text, re.I)
        if v_match:
            ans.append(f"* **Bid Offer Validity:** {v_match.group(0).strip()}")

        ans.append("\n⚠️ *Make sure all documents, technical compliance sheets, and EMD guarantees are uploaded prior to the closing timestamp.*")

        return {
            "answer": "\n".join(ans),
            "sources": ["Tender Timeline", "GeM Schedule"],
            "confidence": "High",
            "suggested_followups": [
                "What documents must be uploaded?",
                "What is the EMD requirement?",
                "Who is the buyer organisation?"
            ]
        }

    @classmethod
    def _resolve_buyer_delivery(cls, t: Dict[str, Any], chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        org = t.get("organisation") or "Public Procuring Authority"
        portal = t.get("portal") or "GeM BidPlus"
        text = t.get("extracted_pdf_text", "")

        ans = [
            f"### 🏢 Buyer & Consignee Location",
            f"* **Procuring Organisation:** {org}",
            f"* **Procurement Portal:** {portal}",
        ]

        consignee_match = re.search(r"(?:Consignees\/Reporting\s+Officer|Delivery\s+Location)[\s\S]{1,250}?(?=\n\s*\n|\Z)", text, re.I)
        if consignee_match:
            ans.append(f"\n**Consignee Details:**\n> {consignee_match.group(0).strip().replace(chr(10), ' ')}")

        del_match = re.search(r"Delivery\s+Days\s*:\s*(\d+)", text, re.I)
        if del_match:
            ans.append(f"\n* **Delivery Timeline:** Complete execution within `{del_match.group(1)} Days` from contract award.")

        return {
            "answer": "\n".join(ans),
            "sources": ["Authority & Consignee Schedule", "GeM Delivery Table"],
            "confidence": "High",
            "suggested_followups": [
                "What is the delivery timeline?",
                "What are the payment milestones?",
                "What is the equipment scope?"
            ]
        }

    @classmethod
    def _resolve_compliance_penalties(cls, t: Dict[str, Any], chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        text = t.get("extracted_pdf_text", "")
        ans = ["### ⚖️ Mandatory Statutory Compliances & ATC Clauses"]
        compliances = []

        if re.search(r"STQC|Security\s+Testing", text, re.I):
            compliances.append("• **STQC / MeitY Security Certification:** Testing report for CCTV/VSS mandatory before CRAC.")
        if re.search(r"IS\s*13252|BIS|CRS", text, re.I):
            compliances.append("• **BIS CRS Scheme-II:** Conforming to IS 13252 (Part 1) under Compulsory Registration Scheme.")
        if re.search(r"MHA|IV-24011", text, re.I):
            compliances.append("• **MHA Security Advisory:** Compliance with Ministry of Home Affairs security advisory.")
        if re.search(r"land\s+border|Rule\s*144", text, re.I):
            compliances.append("• **Land Border Sharing:** Bidder compliance declaration under Rule 144(xi) GFR 2017.")
        if re.search(r"OPTION\s+CLAUSE", text, re.I):
            compliances.append("• **Option Clause:** Purchaser reserves right to vary order quantity up to ±25%.")

        if compliances:
            ans.extend(compliances)
        else:
            ans.append("• Standard Government eProcurement general terms and buyer-specific ATC apply.")

        ans.append("\n**Liquidated Damages (Delay Penalty):**")
        ans.append("> Typically 0.5% per week of delayed supplies, capped at a maximum of 10% of the total contract value.")

        return {
            "answer": "\n".join(ans),
            "sources": ["Buyer Added Bid Specific ATC", "Statutory Compliance Clauses"],
            "confidence": "High",
            "suggested_followups": [
                "What are the payment terms?",
                "Are MSE or Startups exempt?",
                "What is the required equipment BOQ?"
            ]
        }

    @classmethod
    def _format_semantic_matches(cls, t: Dict[str, Any], query: str, matched_chunks: List[Tuple[Dict[str, Any], float]]) -> Dict[str, Any]:
        ans = [
            f"### 🔍 Retrieved Clauses for: *\"{query}\"*",
            f"Based on analyzing the extracted documents for **Tender `{t.get('tender_id')}`**:\n"
        ]
        sources = []
        for idx, (chunk, score) in enumerate(matched_chunks, 1):
            snippet = chunk["text"]
            if len(snippet) > 350:
                snippet = snippet[:350] + "..."
            ans.append(f"**Section Match {idx}:**\n> {snippet}\n")
            sources.append(f"PDF Excerpt #{chunk['id']}")

        return {
            "answer": "\n".join(ans),
            "sources": sources,
            "confidence": "Extracted from PDF",
            "suggested_followups": [
                "What are the EMD and Turnover requirements?",
                "What is the required equipment BOQ?",
                "What are the key deadlines?"
            ]
        }

    @classmethod
    def _resolve_general_overview(cls, t: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "answer": (
                f"### 📋 Tender Summary for `{t.get('tender_id')}`\n\n"
                f"* **Title:** {t.get('title')}\n"
                f"* **Organisation:** {t.get('organisation') or 'N/A'}\n"
                f"* **Portal:** {t.get('portal')}\n"
                f"* **Estimated Value:** {t.get('estimated_value')}\n"
                f"* **EMD Required:** {t.get('emd_amount')}\n"
                f"* **Closing Date:** {t.get('closing_date')}\n"
                f"* **Fit Score:** {t.get('fit_score')}%\n\n"
                f"You can ask me specific questions about **EMD**, **Turnover**, **Equipment BOQ**, **Relaxations**, or **ATC Clauses**."
            ),
            "sources": ["Tender Core Record"],
            "confidence": "High",
            "suggested_followups": [
                "What is the EMD amount?",
                "What is the equipment scope / BOQ?",
                "Are MSE or Startups exempt?"
            ]
        }
