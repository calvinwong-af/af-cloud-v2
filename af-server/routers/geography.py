"""
routers/geography.py  —  Geography endpoints
Port, country, and city lookups from Datastore.
"""
import time
import logging
from fastapi import APIRouter, Depends
from core.auth import Claims, require_auth
from core.datastore import get_client

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Port cache — 10-minute in-memory TTL (same pattern as shipments.py)
# ---------------------------------------------------------------------------

_port_cache: list[dict] = []
_port_cache_ts: float = 0
_PORT_CACHE_TTL = 600  # 10 minutes


def _load_ports(client) -> list[dict]:
    """Query all Port Kind entities from Datastore and map to response shape."""
    query = client.query(kind="Port")
    entities = list(query.fetch())

    ports = []
    for e in entities:
        un_code = e.get("un_code") or e.key.name or ""
        if not un_code:
            continue
        ports.append({
            "un_code": un_code,
            "name": e.get("name") or e.get("port_name") or un_code,
            "country": e.get("country") or "",
            "port_type": e.get("port_type") or "",
            "has_terminals": bool(e.get("has_terminals", False)),
            "terminals": e.get("terminals") or [],
        })

    ports.sort(key=lambda p: p["name"])
    return ports


@router.get("/ports")
async def list_ports(claims: Claims = Depends(require_auth)):
    global _port_cache, _port_cache_ts

    now = time.monotonic()
    if _port_cache and (now - _port_cache_ts) < _PORT_CACHE_TTL:
        return {"status": "OK", "data": _port_cache}

    client = get_client()
    _port_cache = _load_ports(client)
    _port_cache_ts = now
    logger.info(f"[geography] Port cache refreshed — {len(_port_cache)} ports loaded")

    return {"status": "OK", "data": _port_cache}


@router.get("/countries")
async def list_countries(claims: Claims = Depends(require_auth)):
    return {"status": "OK", "data": [], "msg": "Countries — implementation in progress"}
