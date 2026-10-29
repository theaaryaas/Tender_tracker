from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class CompanyProfileSchema(BaseModel):
    company_name: str
    msme_status: str
    udyam_registered: bool
    dpiit_startup_recognised: bool
    gem_registered: bool
    known_certifications: List[str]
    known_project_experience: List[str]
    average_annual_turnover_inr: Optional[float] = None
    net_worth_inr: Optional[float] = None
    blacklisting_status_confirmed: bool = False
    current_mafs_and_oem_authorisations: str = "Verify case by case"
    direct_bidder_type: str = "Software/product OEM and solution provider"
    notes: Optional[str] = ""

class KeywordsSchema(BaseModel):
    keywords: List[str]

class PortalConfigSchema(BaseModel):
    key: str
    name: str
    enabled: bool
    kind: str
    url: str

