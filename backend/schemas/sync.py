from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
import json

class SyncTriggerRequest(BaseModel):
    sites: Optional[List[str]] = None # e.g. ["gem"] or None for all
    keywords: Optional[List[str]] = None
    gem_pages: Optional[int] = 3
    extract_pdfs: Optional[bool] = False

class SyncStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    status: str
    portal_filter: Optional[str] = None
    tenders_found: int = 0
    tenders_added: int = 0
    tenders_updated: int = 0
    error_count: int = 0
    error_details: Optional[Any] = []
    duration_seconds: float = 0.0
    started_at: Optional[Any] = None
    completed_at: Optional[Any] = None

    @field_validator("error_details", mode="before")
    @classmethod
    def parse_error_details(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        if v is None:
            return []
        return v

