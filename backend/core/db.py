from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.core.config import settings

# Handle SQLite vs PostgreSQL configurations
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    # If SQLite file path, ensure directory exists
    clean_url = settings.DATABASE_URL.replace("sqlite:////", "/").replace("sqlite:///", "")
    if clean_url and clean_url != ":memory:":
        try:
            db_file = Path(clean_url)
            db_file.parent.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args=connect_args,
        echo=False
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        echo=False
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
