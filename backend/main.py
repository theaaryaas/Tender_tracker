import sys
from pathlib import Path

# Ensure root directory is in sys.path to access root-level modules like 'chatbot'
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

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
    export_router,
    auth_router,
    crm_router,
    users_router,
    audit_router,
    contacts_router
)
try:
    from chatbot.routes import router as chatbot_router
except ImportError:
    chatbot_router = None
from backend.seed_data import seed_database

from pathlib import Path
from alembic.config import Config
from alembic import command

def run_migrations():
    try:
        alembic_ini_path = Path(__file__).resolve().parent / "alembic.ini"
        if alembic_ini_path.exists():
            alembic_cfg = Config(str(alembic_ini_path))
            command.upgrade(alembic_cfg, "head")
            print("Database migrations applied successfully via Alembic.")
        else:
            Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Migration note/warning: {e}")
        Base.metadata.create_all(bind=engine)

    # Defensive check: Ensure recently added columns exist in PostgreSQL
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE tenders ADD COLUMN IF NOT EXISTS documents JSON;"))
            conn.execute(text("ALTER TABLE tenders ADD COLUMN IF NOT EXISTS deep_analysis JSON;"))
            conn.execute(text("ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS bidding_status VARCHAR(30) DEFAULT 'Reviewing';"))
            conn.execute(text("ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS tender_end_date VARCHAR(60);"))
            conn.execute(text("ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(255);"))
            conn.execute(text("ALTER TABLE crm_records ALTER COLUMN client_phone TYPE VARCHAR(255);"))
            conn.execute(text("ALTER TABLE crm_records ALTER COLUMN client_email TYPE VARCHAR(255);"))
            conn.execute(text("ALTER TABLE crm_records ALTER COLUMN client_name TYPE VARCHAR(255);"))
            conn.execute(text("ALTER TABLE crm_records ALTER COLUMN client_designation TYPE VARCHAR(255);"))
    except Exception as e:
        print(f"Defensive schema check note: {e}")

def migrate_from_sqlite_if_empty():
    """If Postgres is brand new and SQLite database exists, migrate tenders & settings seamlessly."""
    try:
        candidate_paths = [
            Path("/app/data/tenders.db"),
            Path("/app/backend/data/tenders.db"),
            Path("/app/backend/tenders.db"),
            Path("data/tenders.db"),
            Path("backend/data/tenders.db"),
            Path("backend/tenders.db")
        ]
        sqlite_path = next((p for p in candidate_paths if p.exists() and p.is_file()), None)
        if not sqlite_path:
            return
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM tenders")).scalar()
            if result and result > 0:
                return # PostgreSQL already populated

        print(f"Migrating existing data from SQLite ({sqlite_path}) to PostgreSQL...")
        import sqlite3
        sq_conn = sqlite3.connect(str(sqlite_path))
        sq_conn.row_factory = sqlite3.Row
        sq_cur = sq_conn.cursor()

        # Migrate Settings
        try:
            sq_cur.execute("SELECT key, value_json, description FROM settings")
            rows = sq_cur.fetchall()
            with engine.connect() as conn:
                for r in rows:
                    conn.execute(
                        text("INSERT INTO settings (key, value_json, description) VALUES (:k, :v, :d) ON CONFLICT (key) DO NOTHING"),
                        {"k": r["key"], "v": r["value_json"], "d": r["description"]}
                    )
                conn.commit()
            print(f"Migrated {len(rows)} settings from SQLite.")
        except Exception as e:
            print(f"Settings migration note: {e}")

        # Migrate Tenders
        try:
            sq_cur.execute("SELECT * FROM tenders")
            rows = sq_cur.fetchall()
            if rows:
                cols = [desc[0] for desc in sq_cur.description if desc[0] != "id"]
                col_names = ", ".join(cols)
                col_params = ", ".join(f":{c}" for c in cols)
                migrated_count = 0
                with engine.begin() as conn:
                    for r in rows:
                        row_dict = {c: r[c] for c in cols}
                        if "is_starred" in row_dict:
                            row_dict["is_starred"] = bool(row_dict["is_starred"])
                        conn.execute(
                            text(f"INSERT INTO tenders ({col_names}) VALUES ({col_params}) ON CONFLICT (tender_id) DO NOTHING"),
                            row_dict
                        )
                        migrated_count += 1
                print(f"Successfully migrated {migrated_count} tenders from SQLite to PostgreSQL!")
        except Exception as e:
            print(f"Tenders migration note: {e}")

        sq_conn.close()
    except Exception as e:
        print(f"SQLite migration check warning: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Apply Alembic migrations, migrate legacy SQLite data, seed defaults
    run_migrations()
    migrate_from_sqlite_if_empty()
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
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(tenders_router, prefix=settings.API_V1_STR)
app.include_router(sync_router, prefix=settings.API_V1_STR)
app.include_router(analytics_router, prefix=settings.API_V1_STR)
app.include_router(settings_router, prefix=settings.API_V1_STR)
app.include_router(export_router, prefix=settings.API_V1_STR)
app.include_router(crm_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(audit_router, prefix=settings.API_V1_STR)
app.include_router(contacts_router, prefix=settings.API_V1_STR)
if chatbot_router:
    app.include_router(chatbot_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0"
    }

# -------------------------------------------------------------
# Serve React Frontend from backend/public (SPA Single Container)
# -------------------------------------------------------------
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from fastapi import HTTPException

PUBLIC_DIR = Path(__file__).resolve().parent / "public"

if PUBLIC_DIR.exists():
    assets_dir = PUBLIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # Do not catch docs, redoc, openapi, or unmatched /api routes
        if full_path.startswith("api/") or full_path in ("docs", "redoc", "openapi.json"):
            raise HTTPException(status_code=404, detail="Not Found")

        target_file = PUBLIC_DIR / full_path
        if target_file.exists() and target_file.is_file():
            return FileResponse(str(target_file))
        return FileResponse(
            str(PUBLIC_DIR / "index.html"),
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
