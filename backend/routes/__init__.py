from backend.routes.tenders import router as tenders_router
from backend.routes.sync import router as sync_router
from backend.routes.analytics import router as analytics_router
from backend.routes.settings import router as settings_router
from backend.routes.export import router as export_router

__all__ = [
    "tenders_router",
    "sync_router",
    "analytics_router",
    "settings_router",
    "export_router"
]

