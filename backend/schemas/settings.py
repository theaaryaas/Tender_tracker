from pydantic import BaseModel, Field
from typing import List, Optional

class CompanyProfileSchema(BaseModel):
    company_name: Optional[str] = "BitVivid Solutions Private Limited"
    msme_status: Optional[str] = "Micro Enterprise - Services"
    udyam_registered: Optional[bool] = False
    dpiit_startup_recognised: Optional[bool] = False
    gem_registered: Optional[bool] = False
    blacklisting_status_confirmed: Optional[bool] = False
    known_certifications: Optional[List[str]] = Field(default_factory=list)
    known_project_experience: Optional[List[str]] = Field(default_factory=list)
    average_annual_turnover_inr: Optional[float] = Field(None, ge=0, description="Annual turnover in INR (must be >= 0)")
    net_worth_inr: Optional[float] = Field(None, ge=0, description="Net worth in INR (must be >= 0)")
    current_mafs_and_oem_authorisations: Optional[str] = "Verify case by case"
    direct_bidder_type: Optional[str] = "Software/product OEM and solution provider"
    notes: Optional[str] = ""

class KeywordsSchema(BaseModel):
    keywords: Optional[List[str]] = Field(default_factory=list)

class PortalConfigSchema(BaseModel):
    key: str
    name: str
    enabled: bool = True
    kind: str = "public"
    url: str = ""
