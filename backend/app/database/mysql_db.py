"""Database connection and session management supporting PostgreSQL, MySQL, and SQLite."""
import os
import logging
from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

logger = logging.getLogger("code_archaeologist.db")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./code_archaeologist.db"

# Normalize legacy postgres:// connection strings to postgresql:// for SQLAlchemy 1.4/2.0
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

def _create_sqlite_engine(url: str):
    eng = create_engine(
        url,
        connect_args={"check_same_thread": False, "timeout": 60},
    )
    @event.listens_for(eng, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA busy_timeout=60000")
            cursor.close()
        except Exception as exc:
            logger.warning(f"Failed to set SQLite PRAGMA: {exc}")
    return eng

# Connect to database with automatic SQLite fallback
if DATABASE_URL.startswith("sqlite"):
    engine = _create_sqlite_engine(DATABASE_URL)
else:
    try:
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            pool_recycle=3600,
            pool_size=5,
            max_overflow=10,
        )
        with engine.connect() as conn:
            logger.info("Successfully connected to external database.")
    except Exception as e:
        logger.warning(f"Could not connect to database at {DATABASE_URL}: {e}. Falling back to SQLite.")
        DATABASE_URL = "sqlite:///./code_archaeologist.db"
        engine = _create_sqlite_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
