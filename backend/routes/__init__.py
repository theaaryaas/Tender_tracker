from backend.routes.tenders import router as tenders_router
from backend.routes.sync import router as sync_router
from backend.routes.analytics import router as analytics_router
from backend.routes.settings import router as settings_router
from backend.routes.export import router as export_router
from backend.routes.auth import router as auth_router
from backend.routes.crm import router as crm_router
from backend.routes.users import router as users_router
from backend.routes.audit import router as audit_router

__all__ = [
    "tenders_router",
    "sync_router",
    "analytics_router",
    "settings_router",
    "export_router",
    "auth_router",
    "crm_router",
    "users_router",
    "audit_router"
]
