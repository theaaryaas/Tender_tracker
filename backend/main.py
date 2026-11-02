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

def migrate_from_sqlite_if_empty():
    """If Postgres is brand new and /app/data/tenders.db exists, migrate tenders & settings seamlessly."""
    try:
        sqlite_path = Path("/app/data/tenders.db")
        if not sqlite_path.exists():
            return
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM tenders")).scalar()
            if result and result > 0:
                return # PostgreSQL already populated

        print("Migrating existing data from SQLite to PostgreSQL...")
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
                with engine.connect() as conn:
                    for r in rows:
                        row_dict = {c: r[c] for c in cols}
                        if "is_starred" in row_dict:
                            row_dict["is_starred"] = bool(row_dict["is_starred"])
                        conn.execute(
                            text(f"INSERT INTO tenders ({col_names}) VALUES ({col_params}) ON CONFLICT (tender_id) DO NOTHING"),
                            row_dict
                        )
                    conn.commit()
                print(f"Successfully migrated {len(rows)} tenders from SQLite to PostgreSQL!")
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

