"""Database engine/session setup.

Uses SQLite by default so the app runs with zero external services, but the URL is
read from DATABASE_URL so a deploy target (Railway/Render) can point at Postgres
without a code change.
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./vehicle_tracker.db")

# check_same_thread=False is required for SQLite because FastAPI serves requests
# from a threadpool, and each request may touch the connection from a different thread.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency that yields a session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
