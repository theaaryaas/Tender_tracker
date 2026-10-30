from typing import Tuple, Dict, Any, List
import re

TECHNICAL_TERMS = [
    "cctv", "camera", "video analytics", "video management system", "vms", "surveillance",
    "anpr", "itms", "atms", "traffic", "crowd management", "facial recognition", "frs",
    "genai", "generative ai", "artificial intelligence", "command and control", "iccc",
    "nms", "mlff", "machine learning", "red light violation", "rlvd", "automatic number plate",
    "video surveillance", "fire and smoke detection", "video search"
]

ADJACENT_TERMS = [
    "software", "cyber", "network", "digitisation", "digital", "data center",
    "server", "iot", "automation", "information technology", "application",
    "telecom", "hardware", "system integration"
]

class EligibilityService:
    @staticmethod
    def match_keywords(text: str, keywords: List[str]) -> List[str]:
        low = (text or "").lower()
        return [k for k in keywords if k.lower() in low]

    @staticmethod
    def assess(tender_title: str, organisation: str, keyword: str, profile: Dict[str, Any]) -> Tuple[str, str, str, int]:
        """
        Assesses a tender against BitVivid's capabilities.
        Returns: (status, si_partner_route, notes, fit_score)
        """
        full_text = f"{tender_title} {organisation} {keyword}".lower()
        matched_tech = [t for t in TECHNICAL_TERMS if t in full_text]
        matched_adj = [t for t in ADJACENT_TERMS if t in full_text]

        fit_score = 50
        notes_parts = []

        if matched_tech:
            status = "Direct Technical Alignment — Video & Surveillance Systems"
            partner = "OEM Authorization Route: Secure MAF from hardware OEM. Bid directly if 2-year past experience threshold is met, or partner with prime SI."
            fit_score = 85
            notes_parts.append("Scope aligns with BitVivid's capabilities in CCTV surveillance, AI video analytics, and camera infrastructure.")
        elif matched_adj:
            status = "Review / possible SI-partner route"
            partner = "SI / Consortium Route: Partner as software/AI specialist with prime system integrator."
            fit_score = 65
            notes_parts.append("Adjacent technology opportunity. Review scope, bidder definition, turnover, experience, and consortium guidelines.")
        else:
            status = "Eligibility not determined — manual review"
            partner = "Assess prime contractor tie-up or consortium route."
            fit_score = 45
            notes_parts.append("Search result alone does not establish technical fit. Open tender document to verify detailed specifications.")

        # Check company profile flags
        if profile.get("udyam_registered") or profile.get("dpiit_startup_recognised"):
            notes_parts.append("Check if MSME/Startup relaxation for prior experience or turnover applies in ATC.")
            fit_score += 5

        turnover = profile.get("average_annual_turnover_inr")
        if not turnover:
            notes_parts.append("Verify bidder turnover requirements against portal ATC terms.")

        return status, partner, " ".join(notes_parts), min(100, fit_score)

