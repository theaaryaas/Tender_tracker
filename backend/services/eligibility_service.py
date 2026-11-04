import re
from typing import Tuple, Dict, Any, List, Optional

TIER_1_AI_SOFTWARE = [
    "video analytics", "vms", "video management system", "video management", "anpr",
    "automatic number plate", "itms", "atms", "traffic management", "crowd management",
    "crowd analytics", "facial recognition", "frs", "genai", "generative ai",
    "artificial intelligence", "command and control", "iccc", "smart city surveillance",
    "safe city", "red light violation", "rlvd", "fire and smoke detection", "video search",
    "deep learning", "computer vision", "video synopsis", "perimeter intrusion",
    "perimeter intrusion detection", "speed violation", "traffic enforcement"
]

TIER_2_CCTV_HARDWARE = [
    "cctv", "camera", "bullet camera", "dome camera", "ptz camera", "ptz", "ip camera",
    "video recorder", "nvr", "dvr", "surveillance hard disk", "surveillance system",
    "cctv surveillance", "security surveillance", "video surveillance", "body worn camera",
    "surveillance cameras", "closed circuit television", "surveillance equipment"
]

TIER_3_NETWORKING_INFRA = [
    "poe switch", "network switch", "managed switch", "layer 2 switch", "router",
    "server rack", "network rack", "fiber optic", "optical fiber", "ofc", "cat6",
    "lan cable", "patch panel", "wireless access point", "wireless ap", "ups", "media convertor"
]

TIER_4_ADJACENT_IT = [
    "software", "cyber", "data center", "server", "iot", "automation", "information technology",
    "telecom", "hardware", "system integration", "display", "monitor", "video wall",
    "workstation", "conferencing", "audio visual", "interactive panel", "printer", "scanner"
]

TIER_NEGATIVE_UNRELATED = [
    "medical", "surgical", "sinus", "skullbase", "scanning machine", "shoe cover",
    "fire extinguisher", "oxygen cylinder", "dental", "hospital bed", "transformer",
    "civil work", "building construction", "cleaning", "sanitation", "catering",
    "dressing", "dressings", "bandage", "medicine", "pharmaceutical", "printing machine",
    "offset printing", "waste management", "ambulance", "watermist", "laundry",
    "uniform", "fertilizer", "seed", "pesticide", "borewell", "plumbing", "detergent",
    "soap", "toilet soap", "consultancy"
]


class EligibilityService:
    @staticmethod
    def match_terms(terms: List[str], text: str) -> List[str]:
        matches = []
        for t in terms:
            if re.search(r"\b" + re.escape(t) + r"\b", text, re.I):
                matches.append(t)
        return matches

    @staticmethod
    def assess(
        tender_title: str = "",
        organisation: str = "",
        keyword: str = "",
        profile: Optional[Dict[str, Any]] = None,
        scope_summary: str = "",
        full_text: str = "",
        turnover_required: str = "",
        bidder_turnover: str = "",
        oem_turnover: str = "",
        mse_relaxation: str = "",
        startup_relaxation: str = "",
        emd_amount: str = "",
        estimated_value: str = ""
    ) -> Tuple[str, str, str, int]:
        """
        Assesses a tender against BitVivid's capabilities using a 4-dimensional scoring model:
        1. Technical Scope Alignment (0 - 40 pts)
        2. Turnover Feasibility (0 - 25 pts)
        3. MSE / Startup Concessions (0 - 20 pts)
        4. EMD & Financial Terms (0 - 15 pts)

        Returns: (status, si_partner_route, notes, fit_score)
        """
        profile = profile or {}

        # ---------------------------------------------------------
        # 1. TECHNICAL FIT (0 - 40 points)
        # Search title and scope (using exact regex word boundaries \b)
        # ---------------------------------------------------------
        tech_text = f"{tender_title} {scope_summary}".lower()

        matched_t1 = EligibilityService.match_terms(TIER_1_AI_SOFTWARE, tech_text)
        matched_t2 = EligibilityService.match_terms(TIER_2_CCTV_HARDWARE, tech_text)
        matched_t3 = EligibilityService.match_terms(TIER_3_NETWORKING_INFRA, tech_text)
        matched_t4 = EligibilityService.match_terms(TIER_4_ADJACENT_IT, tech_text)
        matched_neg = EligibilityService.match_terms(TIER_NEGATIVE_UNRELATED, tech_text)

        # Explicit surveillance anchor: true surveillance noun
        explicit_surveillance = bool(
            re.search(r"\b(cctv|surveillance|camera|ip camera|video recorder|video analytics|nvr|dvr|ptz)\b", tech_text, re.I)
        )
        is_unrelated = bool(matched_neg) and not explicit_surveillance

        notes_parts = []
        is_non_core = False

        if is_unrelated:
            tech_score = 3
            is_non_core = True
            notes_parts.append(f"Scope appears outside BitVivid core domain: {', '.join(matched_neg[:2])}.")
        elif matched_t1:
            tech_score = 38
            notes_parts.append(f"Direct match with BitVivid core AI & video software: {', '.join(matched_t1[:3])}.")
        elif matched_t2:
            tech_score = 30
            notes_parts.append(f"Strong CCTV video surveillance & camera infrastructure match: {', '.join(matched_t2[:3])}.")
        elif matched_t3:
            tech_score = 20
            notes_parts.append(f"Active networking & surveillance infrastructure match: {', '.join(matched_t3[:3])}.")
        elif matched_t4:
            tech_score = 12
            notes_parts.append(f"Peripheral IT or adjacent technology opportunity: {', '.join(matched_t4[:3])}.")
        else:
            tech_score = 5
            is_non_core = True
            notes_parts.append("General search match; detailed technical fit requires manual ATC inspection.")

        # ---------------------------------------------------------
        # 2. TURNOVER FEASIBILITY (0 - 25 points)
        # ---------------------------------------------------------
        to_str = f"{turnover_required} {bidder_turnover}".lower()
        if "no minimum" in to_str or "nil" in to_str or "exempt" in to_str or "not mandated" in to_str:
            to_score = 25
            notes_parts.append("Turnover criteria not mandated or fully exempted for MSE/Startups.")
        else:
            num_match = re.search(r"(\d+(?:\.\d+)?)\s*(lakh|cr|crore)", to_str, re.I)
            if num_match:
                val = float(num_match.group(1))
                unit = num_match.group(2).lower()
                val_in_lakhs = val * 100 if "cr" in unit else val
                if val_in_lakhs <= 25:
                    to_score = 24
                    notes_parts.append(f"Accessible turnover requirement: ₹ {val_in_lakhs:g} Lakhs.")
                elif val_in_lakhs <= 60:
                    to_score = 21
                    notes_parts.append(f"Moderate turnover requirement: ₹ {val_in_lakhs:g} Lakhs.")
                elif val_in_lakhs <= 150:
                    to_score = 16
                    notes_parts.append(f"Turnover threshold: ₹ {val_in_lakhs:g} Lakhs (Verify MSE relaxation in ATC).")
                elif val_in_lakhs <= 500:
                    to_score = 10
                    notes_parts.append(f"High turnover requirement: ₹ {val_in_lakhs/100:g} Crores (SI partner route suggested).")
                else:
                    to_score = 4
                    notes_parts.append(f"Very high turnover: ₹ {val_in_lakhs/100:g} Crores (Subcontractor route only).")
            else:
                to_score = 16

        # ---------------------------------------------------------
        # 3. MSE / STARTUP RELAXATION (0 - 20 points)
        # ---------------------------------------------------------
        mse_str = (mse_relaxation or "").lower()
        st_str = (startup_relaxation or "").lower()

        mse_yes = "yes" in mse_str or "complete" in mse_str
        st_yes = "yes" in st_str or "complete" in st_str
        mse_no = "no" in mse_str and "yes" not in mse_str
        st_no = "no" in st_str and "yes" not in st_str

        if mse_yes and st_yes:
            relax_score = 20
            notes_parts.append("Both MSE and DPIIT Startup exemptions granted for Turnover & Past Experience.")
        elif mse_yes or st_yes:
            relax_score = 15
            notes_parts.append("MSE/Startup policy relaxation applicable.")
        elif mse_no and st_no:
            relax_score = 3
            notes_parts.append("Explicitly No MSE/Startup relaxation granted by buyer.")
        else:
            if profile.get("udyam_registered") or profile.get("dpiit_startup_recognised"):
                relax_score = 14
                notes_parts.append("BitVivid Udyam/DPIIT credentials applicable for standard statutory preferences.")
            else:
                relax_score = 8

        # ---------------------------------------------------------
        # 4. EMD & FINANCIAL SECURITY (0 - 15 points)
        # ---------------------------------------------------------
        emd_str = (emd_amount or "").lower()
        if "nil" in emd_str or "not required" in emd_str or emd_str == "0" or emd_str == "₹ 0":
            emd_score = 15
            notes_parts.append("Zero EMD requirement (Nil).")
        elif "exempt" in emd_str or "schedule" in emd_str:
            emd_score = 13
            notes_parts.append("EMD is schedule-wise or exempt for MSE manufacturers.")
        else:
            emd_num_match = re.search(r"(\d+(?:,\d+)*(?:\.\d+)?)", emd_str)
            if emd_num_match:
                amt = float(emd_num_match.group(1).replace(",", ""))
                if amt <= 25000:
                    emd_score = 12
                elif amt <= 100000:
                    emd_score = 10
                elif amt <= 500000:
                    emd_score = 7
                else:
                    emd_score = 4
            else:
                emd_score = 11

        # ---------------------------------------------------------
        # TOTAL FIT SCORE (0 - 100)
        # ---------------------------------------------------------
        if is_non_core:
            # Hard cap for unrelated / non-core tenders
            total_score = min(22, tech_score + (to_score // 5) + (relax_score // 5) + (emd_score // 5))
        else:
            total_score = min(100, max(10, tech_score + to_score + relax_score + emd_score))

        # ---------------------------------------------------------
        # STATUS & PARTNER STRATEGY (Every surveillance tender is Direct Fit!)
        # ---------------------------------------------------------
        if is_non_core:
            status = "Not Aligned — Outside BitVivid Core Scope"
            partner = "Not Recommended for Direct Bidding: Tender scope contains non-surveillance or unrelated equipment."
        elif matched_t1:
            if total_score >= 80:
                status = "Direct Technical Alignment (Direct Fit) — Core AI & Video Solutions"
                partner = "Direct Bidder: BitVivid proprietary AI/VMS software with standard OEM camera authorization. Fully eligible under Startup & MSME preference."
            else:
                status = "Direct Technical Alignment (Direct Fit) — AI & Video Analytics Partner Route"
                partner = "SI / Consortium Route: Partner as specialist AI/Video software provider with prime System Integrator."
        elif matched_t2:
            if total_score >= 70:
                status = "Direct Technical Alignment (Direct Fit) — CCTV Video Surveillance Systems"
                partner = "OEM Authorization Route: Secure Manufacturer Authorization Form (MAF) from hardware OEM (CP PLUS, Dahua, Hikvision, etc.). Bid directly under MSE exemption."
            else:
                status = "Direct Technical Alignment (Direct Fit) — CCTV Hardware & Deployment"
                partner = "SI Partner Route: Joint bidding with System Integrator or prime contractor for hardware supply and deployment."
        elif matched_t3:
            status = "Moderate Alignment — Active Networking & Infrastructure (SI Route)"
            partner = "SI / Consortium Route: Partner as active network specialist or hardware supplier with prime System Integrator."
        elif matched_t4:
            status = "Low Alignment — Peripheral IT & Hardware (Subcontractor)"
            partner = "Subcontractor Opportunity: Secondary hardware/accessories supply or assess feasibility based on detailed ATC specifications."
        else:
            status = "General Review — Manual ATC Verification Required"
            partner = "Assess prime contractor tie-up or consortium route."

        return status, partner, " ".join(notes_parts), total_score
