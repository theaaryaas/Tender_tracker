from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json
from backend.core.db import get_db
from backend.models.setting import Setting
from backend.schemas.settings import CompanyProfileSchema, KeywordsSchema, PortalConfigSchema
from backend.services.scraper_service import PORTALS_DEF, DEFAULT_KEYWORDS

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("/profile")
def get_company_profile(db: Session = Depends(get_db)):
    setting = db.query(Setting).filter(Setting.key == "company_profile").first()
    if not setting:
        return {}
    return json.loads(setting.value_json)

@router.put("/profile")
def update_company_profile(profile: CompanyProfileSchema, db: Session = Depends(get_db)):
    setting = db.query(Setting).filter(Setting.key == "company_profile").first()
    if not setting:
        setting = Setting(key="company_profile", value_json=profile.model_dump_json())
        db.add(setting)
    else:
        setting.value_json = profile.model_dump_json()
    db.commit()
    return {"status": "success", "profile": profile}

@router.get("/keywords")
def get_keywords(db: Session = Depends(get_db)):
    setting = db.query(Setting).filter(Setting.key == "keywords").first()
    if not setting:
        return {"keywords": DEFAULT_KEYWORDS}
    return json.loads(setting.value_json)

@router.put("/keywords")
def update_keywords(data: KeywordsSchema, db: Session = Depends(get_db)):
    setting = db.query(Setting).filter(Setting.key == "keywords").first()
    if not setting:
        setting = Setting(key="keywords", value_json=json.dumps({"keywords": data.keywords}))
        db.add(setting)
    else:
        setting.value_json = json.dumps({"keywords": data.keywords})
    db.commit()
    return {"status": "success", "keywords": data.keywords}

@router.get("/portals")
def get_portals():
    seen = set()
    result = []
    for k, v in PORTALS_DEF.items():
        if k in ("up", "mp"):
            continue
        if k not in seen:
            seen.add(k)
            result.append({
                "key": k,
                "name": v["name"],
                "kind": v.get("kind", "public"),
                "url": v.get("url", ""),
                "enabled": True
            })
    return result

