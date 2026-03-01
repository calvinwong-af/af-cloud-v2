"""
core/db.py — Database connection via SQLAlchemy Core + Cloud SQL Python Connector.

Cloud Run: uses Cloud SQL Python Connector (pg8000, Unix socket).
Local:     uses psycopg2 over TCP.
"""

import os
import logging
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

logger = logging.getLogger(__name__)

_INSTANCE_CONNECTION_NAME = os.environ.get("INSTANCE_CONNECTION_NAME", "cloud-accele-freight:asia-northeast1:af-db")
_DB_NAME = os.environ.get("DB_NAME", "accelefreight")
_DB_USER = os.environ.get("DB_USER", "af_server")
_DB_PASS = os.environ.get("DB_PASS", "")
_DATABASE_URL = os.environ.get("DATABASE_URL", "")


def _is_cloud_run() -> bool:
    return bool(os.environ.get("K_SERVICE"))


@lru_cache(maxsize=1)
def get_engine():
    if _is_cloud_run():
        from google.cloud.sql.connector import Connector
        connector = Connector()

        def getconn():
            return connector.connect(
                _INSTANCE_CONNECTION_NAME, "pg8000",
                user=_DB_USER, password=_DB_PASS, db=_DB_NAME,
            )

        engine = create_engine("postgresql+pg8000://", creator=getconn, poolclass=NullPool)
        logger.info("[db] Cloud SQL Python Connector (pg8000)")
    else:
        url = _DATABASE_URL or f"postgresql+psycopg2://{_DB_USER}:{_DB_PASS}@localhost:5432/{_DB_NAME}"
        engine = create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=10)
        logger.info("[db] Local psycopg2: %s", url.split("@")[-1])
    return engine


def get_db():
    """FastAPI dependency — yields a connection, commits on success."""
    with get_engine().connect() as conn:
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
