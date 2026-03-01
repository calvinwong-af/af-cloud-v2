"""
routers/geography.py — Geography endpoints (PostgreSQL).
Port and country lookups from the ports table.
"""
import time
import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text

from core.auth import Claims, require_auth
from core.db import get_db
from core.db_queries import _parse_jsonb

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Port cache — 10-minute in-memory TTL
# ---------------------------------------------------------------------------

_port_cache: list[dict] = []
_port_cache_ts: float = 0
_PORT_CACHE_TTL = 600  # 10 minutes


def _load_ports(conn) -> list[dict]:
    """Query all ports from PostgreSQL and map to response shape."""
    rows = conn.execute(text("""
        SELECT un_code, name, country, country_code, port_type,
               has_terminals, terminals
        FROM ports
        ORDER BY name
    """)).fetchall()

    ports = []
    for r in rows:
        ports.append({
            "un_code": r[0] or "",
            "name": r[1] or "",
            "country": r[2] or "",
            "country_code": r[3] or "",
            "port_type": r[4] or "SEA",
            "has_terminals": r[5] or False,
            "terminals": _parse_jsonb(r[6]) or [],
        })

    return ports


@router.get("/ports")
async def list_ports(
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    global _port_cache, _port_cache_ts

    now = time.monotonic()
    if _port_cache and (now - _port_cache_ts) < _PORT_CACHE_TTL:
        return {"status": "OK", "data": _port_cache}

    _port_cache = _load_ports(conn)
    _port_cache_ts = now
    logger.info(f"[geography] Port cache refreshed — {len(_port_cache)} ports loaded")

    return {"status": "OK", "data": _port_cache}


@router.get("/ports/{un_code}")
async def get_port(
    un_code: str,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """Get a single port by UN code."""
    row = conn.execute(text("""
        SELECT un_code, name, country, country_code, port_type,
               has_terminals, terminals
        FROM ports WHERE un_code = :code
    """), {"code": un_code}).fetchone()

    if not row:
        return {"status": "ERROR", "msg": f"Port {un_code} not found"}

    data = {
        "un_code": row[0] or "",
        "name": row[1] or "",
        "country": row[2] or "",
        "country_code": row[3] or "",
        "port_type": row[4] or "SEA",
        "has_terminals": row[5] or False,
        "terminals": _parse_jsonb(row[6]) or [],
    }

    return {"status": "OK", "data": data}


@router.get("/countries")
async def list_countries(claims: Claims = Depends(require_auth)):
    return {"status": "OK", "data": [], "msg": "Countries — implementation in progress"}
