from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Optional
import re

IST = ZoneInfo("Asia/Kolkata")

DATE_FORMATS = [
    "%d-%b-%Y %I:%M %p",
    "%d-%b-%Y %I:%M%p",
    "%d-%b-%Y %H:%M",
    "%d-%b-%Y",
    "%d/%m/%Y %I:%M %p",
    "%d/%m/%Y %I:%M%p",
    "%d/%m/%Y %H:%M",
    "%d/%m/%Y",
    "%d-%m-%Y %I:%M %p",
    "%d-%m-%Y %I:%M%p",
    "%d-%m-%Y %H:%M",
    "%d-%m-%Y",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y-%m-%d",
]

def parse_closing_datetime(closing_str: Optional[str]) -> Optional[datetime]:
    """
    Parses heterogeneous portal date strings into timezone-aware datetime (IST).
    Examples handled:
    - '02-Nov-2026 03:00 PM'
    - '01-Dec-2026 04:30 PM'
    - '01 Dec 2026 12:30 AM'
    - '2026-11-02 15:00:00'
    - '02/11/2026 15:00'
    """
    if not closing_str:
        return None
    s = str(closing_str).strip()
    if not s or s.lower().startswith("check") or s.lower().startswith("not"):
        return None

    # Direct match on common formats
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=IST)
        except Exception:
            pass

    # Normalized separators (e.g. slashes or multiple spaces)
    normalized = re.sub(r"[\./]", "-", s)
    normalized = re.sub(r"\s+", " ", normalized)
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(normalized, fmt).replace(tzinfo=IST)
        except Exception:
            pass

    # ISO fallback
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=IST)
        return dt.astimezone(IST)
    except Exception:
        pass

    return None

