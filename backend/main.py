from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import text
from backend.core.config import settings
from backend.core.db import engine, Base
from backend.routes import (
    tenders_router,
    sync_router,
    analytics_router,
    settings_router,
    export_router
)
from backend.seed_data import seed_database

def ensure_schema():
    with engine.connect() as conn:
        for col, col_type in [
            ("estimated_value", "VARCHAR(100) DEFAULT 'Check tender PDF / ATC'"),
            ("epbg_required", "VARCHAR(100) DEFAULT 'Check tender PDF / ATC'"),
            ("extracted_pdf_text", "TEXT")
        ]:
            try:
                conn.execute(text(f"ALTER TABLE tenders ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables exist & seed default data
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    try:
        seed_database()
    except Exception as e:
        print(f"Initial seed warning: {e}")
    yield
    # Shutdown

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise Tender Intelligence & Opportunity Discovery API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers under /api/v1
app.include_router(tenders_router, prefix=settings.API_V1_STR)
app.include_router(sync_router, prefix=settings.API_V1_STR)
app.include_router(analytics_router, prefix=settings.API_V1_STR)
app.include_router(settings_router, prefix=settings.API_V1_STR)
app.include_router(export_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)

