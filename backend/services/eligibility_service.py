import re
from typing import Tuple, Dict, Any, List, Optional

TIER_1_AI_SOFTWARE = [
    "video analytics", "vms", "video management system", "video management", "anpr",
    "automatic number plate", "itms", "atms", "traffic management", "crowd management",
    "crowd analytics", "facial recognition", "frs", "genai", "generative ai",
    "artificial intelligence", "ai", "ai-enabled", "ai enabled", "ai solution", "ai solutions",
    "ai platform", "software development", "software developer", "software partner", "ai partner",
    "machine learning", "ml", "command and control", "iccc", "smart city surveillance",
    "safe city", "red light violation", "rlvd", "fire and smoke detection", "video search",
    "deep learning", "computer vision", "video synopsis", "perimeter intrusion",
    "perimeter intrusion detection", "speed violation", "traffic enforcement",
    "data analytics", "analytics software"
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
    # Physical gear, clothing & road safety hardware
    "jacket", "traffic jacket", "gloves", "traffic cone", "road cone", "road blocker cone",
    "blocker cone", "hydraulic jack", "safety shoes", "safety boots", "gumboots", "raincoat", "apron",
    "uniform",
    # Firefighting mechanical & plumbing hardware
    "fire hydrant", "hydrant", "fire hose", "fire nozzle", "fire pump", "jockey pump",
    "fire fighting suit", "sprinkler pipe", "hose reel", "delivery hose", "suction hose",
    "fire extinguisher", "watermist",
    # Industrial machinery, mechanical tools & workshop items
    "lathe", "welding", "generator set", "diesel generator", "hydraulic component", "pneumatic",
    "bar tack machine", "rewinding machine", "induction motor", "dc generator", "crimping tool",
    "stake hatchet", "drill gauge", "pulley", "pulleys", "belt conveyor", "transformer",
    "machinery", "machineries", "workshop equipment", "heavy machinery",
    # Medical, surgical & clinical equipment
    "medical", "surgical", "sinus", "skullbase", "scanning machine", "shoe cover",
    "oxygen cylinder", "dental", "hospital bed", "dressing", "dressings", "bandage",
    "medicine", "pharmaceutical", "ambulance", "endoscope", "endoscopy", "laryngoscope",
    "ophthalmoscope", "gastrointestinal", "ultrasound", "chemist",
    # Civil, sanitation, agricultural, manpower & consumables
    "civil work", "building construction", "cleaning", "sanitation", "catering",
    "printing machine", "offset printing", "waste management", "laundry",
    "fertilizer", "seed", "pesticide", "borewell", "plumbing", "detergent",
    "soap", "toilet soap", "consultancy", "manpower", "housekeeping", "security guard",
    # Real estate, vehicle & leasing
    "leasing", "residential property", "housing", "vehicle hiring",
    # Furniture & fixtures
    "blackboard", "easel", "furniture", "bedsheet", "towel", "table", "chair", "desk", "sofa"
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
        estimated_value: str = "",
        emd_exemption: str = "",
        experience_years: str = "",
        experience_required: str = "",
        custom_keywords: Optional[List[str]] = None
    ) -> Tuple[str, str, str, int]:
        """
        Assesses a tender against BitVivid's capabilities:
        0. STQC Certification (Hard Blocker: 0 points if mandated)
        1. Keywords Match (0 - 30 pts) — uses frontend keywords first; fallbacks if empty
        2. Turnover Feasibility (0 - 20 pts) — full 20 pts if <= company turnover or exempt
        3. MSE / Startup Concessions (0 - 20 pts) — full 20 pts if MSE relaxation granted
        4. EMD & Financial Terms (0 - 15 pts) — full 15 pts if exempt OR EMD <= 50,000
        5. Years of Experience (0 - 15 pts) — full 15 pts if <= 7 years or exempt

        Returns: (status, si_partner_route, notes, fit_score)
        """
        profile = profile or {}
        notes_parts = []

        # ---------------------------------------------------------
        # 0. STQC CERTIFICATION HARD BLOCKER
        # If buyer mandates STQC, BitVivid is not eligible -> 0 points
        # ---------------------------------------------------------
        combined_text = f"{tender_title} {scope_summary} {full_text} {experience_required}".lower()
        stqc_required = bool(re.search(r"\b(stqc|stqc\s+certified|stqc\s+certification|stqc\s+certificate)\b", combined_text, re.I))

        if stqc_required:
            status = "Ineligible — Mandatory STQC Certification Required"
            partner = "Not Recommended for Direct Bidding: Tender mandates STQC certification."
            notes = "STQC certification is mandated by buyer in tender clauses. Fit score set to 0."
            return status, partner, notes, 0

        # Negative unrelated domain filter (hardware, gear, plumbing, medical, civil, etc.)
        matched_neg = EligibilityService.match_terms(TIER_NEGATIVE_UNRELATED, combined_text)
        explicit_surveillance = bool(
            re.search(r"\b(cctv|surveillance|camera|ip camera|video recorder|video analytics|nvr|dvr|ptz|ai|vms|artificial intelligence|genai|computer vision|deep learning|software development)\b", combined_text, re.I)
        )
        is_unrelated = bool(matched_neg) and not explicit_surveillance

        if is_unrelated:
            status = "Not Aligned — Outside BitVivid Core Scope (Unrelated Hardware/Commodity)"
            partner = "Not Recommended for Direct Bidding: Tender scope contains non-surveillance or physical hardware."
            notes = f"Scope appears outside BitVivid core domain: {', '.join(matched_neg[:3])}. Fit score set to 0."
            return status, partner, notes, 0

        # ---------------------------------------------------------
        # 1. KEYWORDS MATCH (0 - 30 points)
        # Prioritize keywords configured from frontend; fallback to hardcoded tiers
        # Note: Match strictly against actual tender title & scope, NOT the search query
        # ---------------------------------------------------------
        tech_text = f"{tender_title} {scope_summary}".lower()
        active_keywords = [k.strip() for k in (custom_keywords or []) if k and k.strip()]

        matched_kw: List[str] = []
        matched_t1: List[str] = []
        matched_t2: List[str] = []
        matched_t3: List[str] = []
        matched_t4: List[str] = []

        if active_keywords:
            matched_kw = EligibilityService.match_terms(active_keywords, tech_text)
            if len(matched_kw) >= 2:
                kw_score = 30
                notes_parts.append(f"Direct match with active company keywords: {', '.join(matched_kw[:3])}.")
            elif len(matched_kw) == 1:
                kw_score = 22
                notes_parts.append(f"Direct match with company keyword: {matched_kw[0]}.")
            else:
                kw_score = 5
                notes_parts.append("No direct match with configured company keywords.")
        else:
            # Fallback to hardcoded tiers only when no keywords configured in frontend
            matched_t1 = EligibilityService.match_terms(TIER_1_AI_SOFTWARE, tech_text)
            matched_t2 = EligibilityService.match_terms(TIER_2_CCTV_HARDWARE, tech_text)
            matched_t3 = EligibilityService.match_terms(TIER_3_NETWORKING_INFRA, tech_text)
            matched_t4 = EligibilityService.match_terms(TIER_4_ADJACENT_IT, tech_text)

            if matched_t1:
                kw_score = 30
                notes_parts.append(f"Direct match with BitVivid core AI & video software: {', '.join(matched_t1[:3])}.")
            elif matched_t2:
                kw_score = 22
                notes_parts.append(f"Strong CCTV video surveillance & camera infrastructure match: {', '.join(matched_t2[:3])}.")
            elif matched_t3:
                kw_score = 15
                notes_parts.append(f"Active networking & surveillance infrastructure match: {', '.join(matched_t3[:3])}.")
            elif matched_t4:
                kw_score = 10
                notes_parts.append(f"Peripheral IT or adjacent technology opportunity: {', '.join(matched_t4[:3])}.")
            else:
                kw_score = 5
                notes_parts.append("General search match; detailed technical fit requires manual ATC inspection.")

        # ---------------------------------------------------------
        # 2. TURNOVER FEASIBILITY (0 - 20 points)
        # Full 20 pts if turnover is exempt or <= company turnover capacity
        # ---------------------------------------------------------
        to_str = f"{turnover_required} {bidder_turnover}".lower()
        if "no minimum" in to_str or "nil" in to_str or "exempt" in to_str or "not mandated" in to_str:
            to_score = 20
            notes_parts.append("Turnover criteria not mandated or fully exempted for MSE/Startups.")
        else:
            val_in_lakhs = None
            num_match = re.search(r"(\d+(?:\.\d+)?)\s*(lakh|cr|crore)", to_str, re.I)
            if num_match:
                val = float(num_match.group(1))
                unit = num_match.group(2).lower()
                val_in_lakhs = val * 100 if "cr" in unit else val
            else:
                raw_num = re.search(r"(\d+(?:,\d+)*(?:\.\d+)?)", to_str)
                if raw_num:
                    clean_num = float(raw_num.group(1).replace(",", ""))
                    if clean_num > 0:
                        if clean_num >= 10000:
                            val_in_lakhs = clean_num / 100000.0
                        else:
                            val_in_lakhs = clean_num

            if val_in_lakhs is not None:
                company_turnover_inr = profile.get("average_annual_turnover_inr")
                company_turnover_lakhs = (float(company_turnover_inr) / 100000.0) if company_turnover_inr and str(company_turnover_inr).replace('.', '', 1).isdigit() else None

                if company_turnover_lakhs and val_in_lakhs <= company_turnover_lakhs:
                    to_score = 20
                    notes_parts.append(f"Turnover (₹ {val_in_lakhs:g} Lakhs) is fully within BitVivid's profile capacity (₹ {company_turnover_lakhs:g} Lakhs).")
                elif company_turnover_lakhs and val_in_lakhs > company_turnover_lakhs:
                    to_score = 5
                    notes_parts.append(f"Turnover requirement (₹ {val_in_lakhs/100:.2f} Cr) exceeds BitVivid turnover capacity (₹ {company_turnover_lakhs/100:.2f} Cr).")
                elif val_in_lakhs <= 100:
                    to_score = 20
                    notes_parts.append(f"Accessible turnover requirement: ₹ {val_in_lakhs:g} Lakhs.")
                elif val_in_lakhs <= 300:
                    to_score = 14
                    notes_parts.append(f"Moderate turnover requirement: ₹ {val_in_lakhs:g} Lakhs.")
                else:
                    to_score = 6
                    notes_parts.append(f"High turnover requirement: ₹ {val_in_lakhs/100:g} Crores (SI partner route suggested).")
            else:
                to_score = 15

        # ---------------------------------------------------------
        # 3. MSE / STARTUP RELAXATION (0 - 20 points)
        # Full 20 pts if MSE relaxation is granted
        # ---------------------------------------------------------
        mse_str = (mse_relaxation or "").lower()
        st_str = (startup_relaxation or "").lower()

        mse_yes = "yes" in mse_str or "complete" in mse_str
        st_yes = "yes" in st_str or "complete" in st_str
        mse_no = "no" in mse_str and "yes" not in mse_str
        st_no = "no" in st_str and "yes" not in st_str

        if mse_yes or st_yes:
            relax_score = 20
            notes_parts.append("MSE / Startup policy relaxation granted by buyer.")
        elif mse_no and st_no:
            relax_score = 2
            notes_parts.append("Explicitly No MSE/Startup relaxation granted by buyer.")
        else:
            if profile.get("udyam_registered") or profile.get("dpiit_startup_recognised"):
                relax_score = 16
                notes_parts.append("BitVivid Udyam/DPIIT credentials applicable for standard statutory preferences.")
            else:
                relax_score = 8

        # ---------------------------------------------------------
        # 4. EMD & FINANCIAL SECURITY (0 - 15 points)
        # Full 15 pts if exempt OR EMD <= 50,000 INR
        # ---------------------------------------------------------
        emd_str = (emd_amount or "").lower()
        ex_str = (emd_exemption or "").lower()
        mse_str_lower = (mse_relaxation or "").lower()

        # Check if EMD exemption is explicitly disallowed/denied
        emd_exempt_denied = (
            ex_str in ("no", "false", "0")
            or ex_str.startswith("no")
            or "not allowed" in ex_str
            or "denied" in ex_str
        )

        is_emd_exempt = not emd_exempt_denied and (
            ex_str in ("yes", "true", "1")
            or ex_str.startswith("yes")
            or ("allowed" in ex_str and "not allowed" not in ex_str)
            or ("exempt" in ex_str and "not" not in ex_str and "no" not in ex_str)
            or "exempt" in emd_str
            or "nil" in emd_str
            or "not required" in emd_str
            or emd_str in ("0", "₹ 0")
        )

        if is_emd_exempt:
            emd_score = 15
            notes_parts.append("Zero EMD or EMD exemption granted for registered MSEs/Startups.")
        else:
            emd_num_match = re.search(r"(\d+(?:,\d+)*(?:\.\d+)?)", emd_str)
            if emd_num_match:
                amt = float(emd_num_match.group(1).replace(",", ""))
                if amt <= 50000:
                    emd_score = 15
                    notes_parts.append(f"EMD amount (₹ {amt:,.0f}) is within accessible threshold (≤ ₹ 50,000).")
                elif amt <= 200000:
                    emd_score = 8
                    notes_parts.append(f"Moderate EMD amount: ₹ {amt:,.0f}.")
                else:
                    emd_score = 4
                    if emd_exempt_denied:
                        notes_parts.append(f"High EMD requirement: ₹ {amt:,.0f} (Exemption explicitly disallowed by buyer).")
                    else:
                        notes_parts.append(f"High EMD requirement: ₹ {amt:,.0f}.")
            else:
                emd_score = 12

        # ---------------------------------------------------------
        # 5. YEARS OF EXPERIENCE (0 - 15 points)
        # Full 15 pts if required experience <= 7 years or exempt
        # ---------------------------------------------------------
        exp_text = f"{experience_years} {experience_required}".lower()
        exp_exempt = (
            mse_yes 
            or st_yes 
            or "exempt" in exp_text 
            or "nil" in exp_text 
            or "not mandated" in exp_text 
            or "not required" in exp_text
            or "no experience" in exp_text
        )

        if exp_exempt:
            exp_score = 15
            notes_parts.append("Prior experience exempted under MSE / Startup policy.")
        else:
            exp_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:year|yr)", exp_text, re.I)
            if not exp_match:
                exp_match = re.search(r"(\d+(?:\.\d+)?)", exp_text)
            exp_val = float(exp_match.group(1)) if exp_match else None

            if exp_val is not None:
                if exp_val <= 7:
                    exp_score = 15
                    notes_parts.append(f"Experience required ({exp_val:g} yrs) ≤ BitVivid's 7-year capacity.")
                else:
                    exp_score = 5
                    notes_parts.append(f"Experience required ({exp_val:g} yrs) exceeds 7-year capacity.")
            else:
                exp_score = 15  # Default when no specific year requirement is mandated

        # ---------------------------------------------------------
        # TOTAL FIT SCORE (0 - 100)
        # ---------------------------------------------------------
        total_score = min(100, max(5, kw_score + to_score + relax_score + emd_score + exp_score))

        # ---------------------------------------------------------
        # STATUS & PARTNER STRATEGY
        # ---------------------------------------------------------
        if matched_kw or matched_t1:
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
