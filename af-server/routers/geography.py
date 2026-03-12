"""
routers/geography.py — Geography endpoints (PostgreSQL).
Port, state, and area lookups + CRUD.
"""
import json
import logging
import os
import time

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

from core.auth import Claims, require_auth, require_afu
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

# States cache — 10-minute TTL
_states_cache: list[dict] = []
_states_cache_ts: float = 0

_terminals_cache: list[dict] = []
_terminals_cache_ts: float = 0


def _invalidate_port_cache():
    global _port_cache, _port_cache_ts, _terminals_cache, _terminals_cache_ts
    _port_cache = []
    _port_cache_ts = 0
    _terminals_cache = []
    _terminals_cache_ts = 0


def _invalidate_states_cache():
    global _states_cache, _states_cache_ts
    _states_cache = []
    _states_cache_ts = 0


# ---------------------------------------------------------------------------
# Ports
# ---------------------------------------------------------------------------

def _load_ports(conn) -> list[dict]:
    """Query all ports from PostgreSQL and map to response shape."""
    rows = conn.execute(text("""
        SELECT p.un_code, p.name, p.country_code, c.name AS country_name,
               p.port_type, p.has_terminals, p.terminals, p.lat, p.lng
        FROM ports p
        LEFT JOIN countries c ON c.country_code = p.country_code
        ORDER BY p.name
    """)).fetchall()

    ports = []
    for r in rows:
        ports.append({
            "un_code": r[0] or "",
            "name": r[1] or "",
            "country_code": r[2] or "",
            "country_name": r[3] or "",
            "port_type": r[4] or "SEA",
            "has_terminals": r[5] or False,
            "terminals": _parse_jsonb(r[6]) or [],
            "lat": float(r[7]) if r[7] is not None else None,
            "lng": float(r[8]) if r[8] is not None else None,
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
        SELECT p.un_code, p.name, p.country_code, c.name AS country_name,
               p.port_type, p.has_terminals, p.terminals, p.lat, p.lng
        FROM ports p
        LEFT JOIN countries c ON c.country_code = p.country_code
        WHERE p.un_code = :code
    """), {"code": un_code}).fetchone()

    if not row:
        return {"status": "ERROR", "msg": f"Port {un_code} not found"}

    data = {
        "un_code": row[0] or "",
        "name": row[1] or "",
        "country_code": row[2] or "",
        "country_name": row[3] or "",
        "port_type": row[4] or "SEA",
        "has_terminals": row[5] or False,
        "terminals": _parse_jsonb(row[6]) or [],
        "lat": float(row[7]) if row[7] is not None else None,
        "lng": float(row[8]) if row[8] is not None else None,
    }

    return {"status": "OK", "data": data}


# ---------------------------------------------------------------------------
# Port Terminals
# ---------------------------------------------------------------------------

@router.get("/port-terminals")
async def list_port_terminals(
    port_un_code: str | None = Query(default=None),
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    global _terminals_cache, _terminals_cache_ts

    if port_un_code:
        rows = conn.execute(text("""
            SELECT terminal_id, port_un_code, name, is_default, is_active
            FROM port_terminals
            WHERE is_active = TRUE AND port_un_code = :port
            ORDER BY terminal_id
        """), {"port": port_un_code}).fetchall()
        data = [
            {"terminal_id": r[0], "port_un_code": r[1], "name": r[2],
             "is_default": r[3], "is_active": r[4]}
            for r in rows
        ]
        return {"status": "OK", "data": data}

    now = time.monotonic()
    if _terminals_cache and (now - _terminals_cache_ts) < _PORT_CACHE_TTL:
        return {"status": "OK", "data": _terminals_cache}

    rows = conn.execute(text("""
        SELECT terminal_id, port_un_code, name, is_default, is_active
        FROM port_terminals
        WHERE is_active = TRUE
        ORDER BY port_un_code, terminal_id
    """)).fetchall()

    _terminals_cache = [
        {"terminal_id": r[0], "port_un_code": r[1], "name": r[2],
         "is_default": r[3], "is_active": r[4]}
        for r in rows
    ]
    _terminals_cache_ts = now
    logger.info(f"[geography] Terminals cache refreshed — {len(_terminals_cache)} terminals loaded")

    return {"status": "OK", "data": _terminals_cache}


@router.get("/port-terminals/{terminal_id}")
async def get_port_terminal(
    terminal_id: str,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    row = conn.execute(text("""
        SELECT terminal_id, port_un_code, name, is_default, is_active
        FROM port_terminals WHERE terminal_id = :tid
    """), {"tid": terminal_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Terminal {terminal_id} not found")

    return {"status": "OK", "data": {
        "terminal_id": row[0], "port_un_code": row[1], "name": row[2],
        "is_default": row[3], "is_active": row[4],
    }}


class PortCoordinateUpdate(BaseModel):
    lat: float | None = None
    lng: float | None = None


@router.patch("/ports/{un_code}")
async def update_port_coordinates(
    un_code: str,
    body: PortCoordinateUpdate,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Update lat/lng for a port (AFU only)."""
    row = conn.execute(text("SELECT un_code FROM ports WHERE un_code = :code"),
                       {"code": un_code}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Port {un_code} not found")

    conn.execute(text("""
        UPDATE ports SET lat = :lat, lng = :lng WHERE un_code = :code
    """), {"lat": body.lat, "lng": body.lng, "code": un_code})

    _invalidate_port_cache()
    return {"status": "OK"}


# ---------------------------------------------------------------------------
# Port Resolution via Claude API
# ---------------------------------------------------------------------------

class PortResolveRequest(BaseModel):
    code: str


class PortConfirmRequest(BaseModel):
    un_code: str
    name: str
    country_name: str
    country_code: str
    port_type: str  # "AIR" | "SEA"
    lat: float | None = None
    lng: float | None = None


_PORT_RESOLVE_PROMPT = """You are a freight logistics assistant. Resolve the following port or airport code and return ONLY a valid JSON object with no preamble or markdown.

Code: {code}

Return this exact structure:
{{
  "un_code": "IATA or UN/LOCODE code (uppercase)",
  "name": "Full official name",
  "country_name": "Full country name",
  "country_code": "ISO 2-letter country code (uppercase)",
  "port_type": "AIR or SEA",
  "lat": latitude as float or null,
  "lng": longitude as float or null,
  "confidence": "HIGH or LOW"
}}

If the code is genuinely unknown or ambiguous, return confidence: LOW and fill what you can."""


@router.post("/ports/resolve")
async def resolve_port(
    body: PortResolveRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Resolve an unknown port code via Claude API (AFU only)."""
    code = body.code.strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Code is required")

    # Check if already exists
    row = conn.execute(text("""
        SELECT p.un_code, p.name, p.country_code, c.name AS country_name,
               p.port_type, p.lat, p.lng
        FROM ports p
        LEFT JOIN countries c ON c.country_code = p.country_code
        WHERE p.un_code = :code
    """), {"code": code}).fetchone()

    if row:
        return {
            "status": "OK",
            "already_exists": True,
            "candidate": {
                "un_code": row[0],
                "name": row[1],
                "country_name": row[3] or "",
                "country_code": row[2] or "",
                "port_type": row[4],
                "lat": float(row[5]) if row[5] is not None else None,
                "lng": float(row[6]) if row[6] is not None else None,
                "confidence": "HIGH",
            },
        }

    # Call Claude to resolve
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    import anthropic

    try:
        client = anthropic.AsyncAnthropic(api_key=api_key)
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            timeout=30.0,
            messages=[{
                "role": "user",
                "content": _PORT_RESOLVE_PROMPT.format(code=code),
            }],
        )
        raw = response.content[0].text.strip()
        # Strip code fences if present
        if raw.startswith("```"):
            first_nl = raw.find("\n")
            if first_nl != -1:
                raw = raw[first_nl + 1:]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()

        candidate = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Claude returned invalid JSON for port resolution")
    except anthropic.APITimeoutError:
        raise HTTPException(status_code=503, detail="Port resolution timed out — please try again")
    except Exception as e:
        logger.error("[geography] Port resolution failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Port resolution failed: {e}")

    return {
        "status": "OK",
        "already_exists": False,
        "candidate": candidate,
    }


@router.post("/ports/confirm")
async def confirm_port(
    body: PortConfirmRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Insert a resolved port into the ports table (AFU only)."""
    un_code = body.un_code.strip().upper()

    # Check for duplicate
    existing = conn.execute(text("SELECT un_code FROM ports WHERE un_code = :code"),
                            {"code": un_code}).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail=f"Port {un_code} already exists")

    country_code = body.country_code.upper()

    conn.execute(text("""
        INSERT INTO ports (un_code, name, country_code, port_type, has_terminals, terminals, lat, lng)
        VALUES (:un_code, :name, :country_code, :port_type, FALSE, '[]', :lat, :lng)
    """), {
        "un_code": un_code,
        "name": body.name,
        "country_code": country_code,
        "port_type": body.port_type.upper(),
        "lat": body.lat,
        "lng": body.lng,
    })

    _invalidate_port_cache()

    # Look up country name from countries table
    c_row = conn.execute(text(
        "SELECT name FROM countries WHERE country_code = :cc"
    ), {"cc": country_code}).fetchone()
    country_name = c_row[0] if c_row else body.country_name

    return {
        "status": "OK",
        "data": {
            "un_code": un_code,
            "name": body.name,
            "country_code": country_code,
            "country_name": country_name,
            "port_type": body.port_type.upper(),
            "has_terminals": False,
            "terminals": [],
            "lat": body.lat,
            "lng": body.lng,
        },
    }


# ---------------------------------------------------------------------------
# States
# ---------------------------------------------------------------------------

@router.get("/states")
async def list_states(
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    global _states_cache, _states_cache_ts

    now = time.monotonic()
    if _states_cache and (now - _states_cache_ts) < _PORT_CACHE_TTL:
        return {"status": "OK", "data": _states_cache}

    rows = conn.execute(text("""
        SELECT state_code, name, country_code, is_active
        FROM states WHERE is_active = TRUE
        ORDER BY name
    """)).fetchall()

    _states_cache = [
        {"state_code": r[0], "name": r[1], "country_code": r[2], "is_active": r[3]}
        for r in rows
    ]
    _states_cache_ts = now
    logger.info(f"[geography] States cache refreshed — {len(_states_cache)} states loaded")

    return {"status": "OK", "data": _states_cache}


@router.get("/states/{state_code}")
async def get_state(
    state_code: str,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    row = conn.execute(text("""
        SELECT state_code, name, country_code, is_active
        FROM states WHERE state_code = :code
    """), {"code": state_code}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"State {state_code} not found")

    return {"status": "OK", "data": {
        "state_code": row[0], "name": row[1], "country_code": row[2], "is_active": row[3],
    }}


# ---------------------------------------------------------------------------
# Areas (renamed from Haulage Areas)
# ---------------------------------------------------------------------------

@router.get("/haulage-areas")
async def list_haulage_areas(
    port_un_code: str = Query(...),
    container_sizes: str | None = Query(default=None),
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """Return areas that have at least one active haulage rate card for the given port."""
    where_clauses = [
        "hrc.port_un_code = :port",
        "hrc.is_active = TRUE",
        "a.is_active = TRUE",
    ]
    params: dict = {"port": port_un_code}

    if container_sizes:
        sizes = [s.strip() for s in container_sizes.split(",") if s.strip()]
        if sizes:
            where_clauses.append("(hrc.container_size = ANY(:sizes) OR hrc.container_size = 'wildcard')")
            params["sizes"] = sizes

    where = " AND ".join(where_clauses)
    rows = conn.execute(text(f"""
        SELECT DISTINCT
            a.area_id, a.area_code, a.area_name,
            a.state_code, a.lat, a.lng
        FROM areas a
        JOIN haulage_rate_cards hrc ON hrc.area_id = a.area_id
        WHERE {where}
        ORDER BY a.area_name
    """), params).fetchall()

    data = [
        {
            "area_id": r[0], "area_code": r[1], "area_name": r[2],
            "state_code": r[3],
            "lat": float(r[4]) if r[4] is not None else None,
            "lng": float(r[5]) if r[5] is not None else None,
        }
        for r in rows
    ]
    return {"status": "OK", "data": data}


@router.get("/areas")
async def list_areas(
    state_code: str | None = Query(default=None),
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    where_clauses = ["a.is_active = TRUE"]
    params: dict = {}
    if state_code:
        where_clauses.append("a.state_code = :sc")
        params["sc"] = state_code

    where = " AND ".join(where_clauses)
    rows = conn.execute(text(f"""
        SELECT a.area_id, a.area_code, a.area_name,
               a.state_code, a.lat, a.lng, a.is_active
        FROM areas a
        WHERE {where}
        ORDER BY a.area_name
    """), params).fetchall()

    data = [
        {
            "area_id": r[0], "area_code": r[1], "area_name": r[2],
            "state_code": r[3],
            "lat": float(r[4]) if r[4] is not None else None,
            "lng": float(r[5]) if r[5] is not None else None,
            "is_active": r[6],
        }
        for r in rows
    ]
    return {"status": "OK", "data": data}


@router.get("/areas/{area_id}")
async def get_area(
    area_id: int,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    row = conn.execute(text("""
        SELECT a.area_id, a.area_code, a.area_name,
               a.state_code, a.lat, a.lng, a.is_active
        FROM areas a
        WHERE a.area_id = :id
    """), {"id": area_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Area {area_id} not found")

    return {"status": "OK", "data": {
        "area_id": row[0], "area_code": row[1], "area_name": row[2],
        "state_code": row[3],
        "lat": float(row[4]) if row[4] is not None else None,
        "lng": float(row[5]) if row[5] is not None else None,
        "is_active": row[6],
    }}


class AreaCreate(BaseModel):
    area_code: str
    area_name: str
    state_code: str
    lat: float | None = None
    lng: float | None = None


class AreaUpdate(BaseModel):
    area_code: str | None = None
    area_name: str | None = None
    state_code: str | None = None
    lat: float | None = None
    lng: float | None = None


@router.post("/areas")
async def create_area(
    body: AreaCreate,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    area_code = body.area_code.strip().upper()

    row = conn.execute(text("""
        INSERT INTO areas (area_code, area_name, state_code, lat, lng)
        VALUES (:code, :name, :sc, :lat, :lng)
        RETURNING area_id
    """), {
        "code": area_code, "name": body.area_name,
        "sc": body.state_code, "lat": body.lat, "lng": body.lng,
    }).fetchone()

    return {"status": "OK", "data": {"area_id": row[0], "area_code": area_code}}


@router.patch("/areas/{area_id}")
async def update_area(
    area_id: int,
    body: AreaUpdate,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT area_id FROM areas WHERE area_id = :id"),
                            {"id": area_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"Area {area_id} not found")

    updates = []
    params: dict = {"id": area_id}

    for field in ["area_code", "area_name", "state_code", "lat", "lng"]:
        val = getattr(body, field, None)
        if val is not None:
            if field == "area_code":
                val = val.strip().upper()
            updates.append(f"{field} = :{field}")
            params[field] = val

    if not updates:
        return {"status": "OK"}

    conn.execute(text(f"UPDATE areas SET {', '.join(updates)} WHERE area_id = :id"), params)
    return {"status": "OK"}


@router.delete("/areas/{area_id}")
async def delete_area(
    area_id: int,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Soft delete — set is_active = FALSE."""
    existing = conn.execute(text("SELECT area_id FROM areas WHERE area_id = :id"),
                            {"id": area_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"Area {area_id} not found")

    conn.execute(text("UPDATE areas SET is_active = FALSE WHERE area_id = :id"),
                 {"id": area_id})
    return {"status": "OK"}


# ---------------------------------------------------------------------------
# Countries
# ---------------------------------------------------------------------------

_countries_cache: list[dict] = []
_countries_cache_ts: float = 0


def _invalidate_countries_cache():
    global _countries_cache, _countries_cache_ts
    _countries_cache = []
    _countries_cache_ts = 0


@router.get("/countries")
async def list_countries(
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """List all active countries, ordered by name."""
    global _countries_cache, _countries_cache_ts

    now = time.monotonic()
    if _countries_cache and (now - _countries_cache_ts) < _PORT_CACHE_TTL:
        return {"status": "OK", "data": _countries_cache}

    rows = conn.execute(text("""
        SELECT country_code, name, currency_code,
               tax_label, tax_rate, tax_applicable, is_active
        FROM countries WHERE is_active = TRUE
        ORDER BY name
    """)).fetchall()

    _countries_cache = [
        {
            "country_code": r[0],
            "name": r[1],
            "currency_code": r[2],
            "tax_label": r[3],
            "tax_rate": float(r[4]) if r[4] is not None else None,
            "tax_applicable": r[5],
            "is_active": r[6],
        }
        for r in rows
    ]
    _countries_cache_ts = now
    logger.info(f"[geography] Countries cache refreshed — {len(_countries_cache)} countries loaded")

    return {"status": "OK", "data": _countries_cache}


@router.get("/countries/{country_code}")
async def get_country(
    country_code: str,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """Get a single country by code."""
    row = conn.execute(text("""
        SELECT country_code, name, currency_code,
               tax_label, tax_rate, tax_applicable, is_active
        FROM countries WHERE country_code = :code
    """), {"code": country_code}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Country {country_code} not found")

    return {"status": "OK", "data": {
        "country_code": row[0],
        "name": row[1],
        "currency_code": row[2],
        "tax_label": row[3],
        "tax_rate": float(row[4]) if row[4] is not None else None,
        "tax_applicable": row[5],
        "is_active": row[6],
    }}


class CountryUpdate(BaseModel):
    currency_code: str | None = None
    tax_label: str | None = None
    tax_rate: float | None = None
    tax_applicable: bool | None = None
    is_active: bool | None = None


@router.patch("/countries/{country_code}")
async def update_country(
    country_code: str,
    body: CountryUpdate,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Update country tax/currency fields (AFU only). Name is not updatable."""
    existing = conn.execute(text("SELECT country_code FROM countries WHERE country_code = :code"),
                            {"code": country_code}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"Country {country_code} not found")

    updates = []
    params: dict = {"code": country_code}

    for field in ["currency_code", "tax_label", "tax_rate", "tax_applicable", "is_active"]:
        val = getattr(body, field, None)
        if val is not None:
            updates.append(f"{field} = :{field}")
            params[field] = val

    if not updates:
        return {"status": "OK"}

    conn.execute(text(f"UPDATE countries SET {', '.join(updates)} WHERE country_code = :code"), params)
    _invalidate_countries_cache()
    return {"status": "OK"}
