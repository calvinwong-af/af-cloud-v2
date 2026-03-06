"""
routers/geography.py — Geography endpoints (PostgreSQL).
Port, state, city, and area lookups + CRUD.
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

# States / cities caches — 10-minute TTL
_states_cache: list[dict] = []
_states_cache_ts: float = 0

_cities_cache: list[dict] = []
_cities_cache_ts: float = 0


def _invalidate_port_cache():
    global _port_cache, _port_cache_ts
    _port_cache = []
    _port_cache_ts = 0


def _invalidate_states_cache():
    global _states_cache, _states_cache_ts
    _states_cache = []
    _states_cache_ts = 0


def _invalidate_cities_cache():
    global _cities_cache, _cities_cache_ts
    _cities_cache = []
    _cities_cache_ts = 0


# ---------------------------------------------------------------------------
# Ports
# ---------------------------------------------------------------------------

def _load_ports(conn) -> list[dict]:
    """Query all ports from PostgreSQL and map to response shape."""
    rows = conn.execute(text("""
        SELECT un_code, name, country, country_code, port_type,
               has_terminals, terminals, lat, lng
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
        SELECT un_code, name, country, country_code, port_type,
               has_terminals, terminals, lat, lng
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
        "lat": float(row[7]) if row[7] is not None else None,
        "lng": float(row[8]) if row[8] is not None else None,
    }

    return {"status": "OK", "data": data}


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
    country: str
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
  "country": "Full country name",
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
        SELECT un_code, name, country, country_code, port_type, lat, lng
        FROM ports WHERE un_code = :code
    """), {"code": code}).fetchone()

    if row:
        return {
            "status": "OK",
            "already_exists": True,
            "candidate": {
                "un_code": row[0],
                "name": row[1],
                "country": row[2],
                "country_code": row[3],
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

    conn.execute(text("""
        INSERT INTO ports (un_code, name, country, country_code, port_type, has_terminals, terminals, lat, lng)
        VALUES (:un_code, :name, :country, :country_code, :port_type, FALSE, '[]', :lat, :lng)
    """), {
        "un_code": un_code,
        "name": body.name,
        "country": body.country,
        "country_code": body.country_code.upper(),
        "port_type": body.port_type.upper(),
        "lat": body.lat,
        "lng": body.lng,
    })

    _invalidate_port_cache()

    return {
        "status": "OK",
        "data": {
            "un_code": un_code,
            "name": body.name,
            "country": body.country,
            "country_code": body.country_code.upper(),
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
# Cities
# ---------------------------------------------------------------------------

@router.get("/cities")
async def list_cities(
    state_code: str | None = Query(default=None),
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    global _cities_cache, _cities_cache_ts

    # If filtering by state, skip cache
    if state_code:
        rows = conn.execute(text("""
            SELECT c.city_id, c.name, c.state_code, s.name AS state_name,
                   c.lat, c.lng, c.is_active
            FROM cities c JOIN states s ON c.state_code = s.state_code
            WHERE c.is_active = TRUE AND c.state_code = :sc
            ORDER BY c.name
        """), {"sc": state_code}).fetchall()
    else:
        now = time.monotonic()
        if _cities_cache and (now - _cities_cache_ts) < _PORT_CACHE_TTL:
            return {"status": "OK", "data": _cities_cache}

        rows = conn.execute(text("""
            SELECT c.city_id, c.name, c.state_code, s.name AS state_name,
                   c.lat, c.lng, c.is_active
            FROM cities c JOIN states s ON c.state_code = s.state_code
            WHERE c.is_active = TRUE
            ORDER BY c.name
        """)).fetchall()

    data = [
        {
            "city_id": r[0], "name": r[1], "state_code": r[2],
            "state_name": r[3],
            "lat": float(r[4]) if r[4] is not None else None,
            "lng": float(r[5]) if r[5] is not None else None,
            "is_active": r[6],
        }
        for r in rows
    ]

    if not state_code:
        _cities_cache = data
        _cities_cache_ts = time.monotonic()
        logger.info(f"[geography] Cities cache refreshed — {len(_cities_cache)} cities loaded")

    return {"status": "OK", "data": data}


@router.get("/cities/{city_id}")
async def get_city(
    city_id: int,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    row = conn.execute(text("""
        SELECT c.city_id, c.name, c.state_code, s.name AS state_name,
               c.lat, c.lng, c.is_active
        FROM cities c JOIN states s ON c.state_code = s.state_code
        WHERE c.city_id = :id
    """), {"id": city_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"City {city_id} not found")

    return {"status": "OK", "data": {
        "city_id": row[0], "name": row[1], "state_code": row[2],
        "state_name": row[3],
        "lat": float(row[4]) if row[4] is not None else None,
        "lng": float(row[5]) if row[5] is not None else None,
        "is_active": row[6],
    }}


class CityCreate(BaseModel):
    name: str
    state_code: str
    lat: float | None = None
    lng: float | None = None


class CityUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None
    lat: float | None = None
    lng: float | None = None


@router.post("/cities")
async def create_city(
    body: CityCreate,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    # Validate state exists
    state = conn.execute(text("SELECT state_code FROM states WHERE state_code = :sc"),
                         {"sc": body.state_code}).fetchone()
    if not state:
        raise HTTPException(status_code=400, detail=f"Invalid state_code: {body.state_code}")

    row = conn.execute(text("""
        INSERT INTO cities (name, state_code, lat, lng)
        VALUES (:name, :sc, :lat, :lng)
        RETURNING city_id
    """), {"name": body.name, "sc": body.state_code, "lat": body.lat, "lng": body.lng}).fetchone()

    _invalidate_cities_cache()
    return {"status": "OK", "data": {"city_id": row[0], "name": body.name}}


@router.patch("/cities/{city_id}")
async def update_city(
    city_id: int,
    body: CityUpdate,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT city_id FROM cities WHERE city_id = :id"),
                            {"id": city_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"City {city_id} not found")

    updates = []
    params: dict = {"id": city_id}
    if body.name is not None:
        updates.append("name = :name")
        params["name"] = body.name
    if body.is_active is not None:
        updates.append("is_active = :active")
        params["active"] = body.is_active
    if body.lat is not None:
        updates.append("lat = :lat")
        params["lat"] = body.lat
    if body.lng is not None:
        updates.append("lng = :lng")
        params["lng"] = body.lng

    if not updates:
        return {"status": "OK"}

    conn.execute(text(f"UPDATE cities SET {', '.join(updates)} WHERE city_id = :id"), params)
    _invalidate_cities_cache()
    return {"status": "OK"}


# ---------------------------------------------------------------------------
# Areas (renamed from Haulage Areas)
# ---------------------------------------------------------------------------

@router.get("/areas")
async def list_areas(
    port_un_code: str | None = Query(default=None),
    state_code: str | None = Query(default=None),
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    where_clauses = ["a.is_active = TRUE"]
    params: dict = {}
    if port_un_code:
        where_clauses.append("a.port_un_code = :port")
        params["port"] = port_un_code
    if state_code:
        where_clauses.append("a.state_code = :sc")
        params["sc"] = state_code

    where = " AND ".join(where_clauses)
    rows = conn.execute(text(f"""
        SELECT a.area_id, a.area_code, a.area_name, a.port_un_code,
               a.state_code, a.city_id, c.name AS city_name,
               a.lat, a.lng, a.is_active
        FROM areas a
        LEFT JOIN cities c ON a.city_id = c.city_id
        WHERE {where}
        ORDER BY a.area_name
    """), params).fetchall()

    data = [
        {
            "area_id": r[0], "area_code": r[1], "area_name": r[2],
            "port_un_code": r[3], "state_code": r[4], "city_id": r[5],
            "city_name": r[6],
            "lat": float(r[7]) if r[7] is not None else None,
            "lng": float(r[8]) if r[8] is not None else None,
            "is_active": r[9],
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
        SELECT a.area_id, a.area_code, a.area_name, a.port_un_code,
               a.state_code, a.city_id, c.name AS city_name,
               a.lat, a.lng, a.is_active
        FROM areas a
        LEFT JOIN cities c ON a.city_id = c.city_id
        WHERE a.area_id = :id
    """), {"id": area_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Area {area_id} not found")

    return {"status": "OK", "data": {
        "area_id": row[0], "area_code": row[1], "area_name": row[2],
        "port_un_code": row[3], "state_code": row[4], "city_id": row[5],
        "city_name": row[6],
        "lat": float(row[7]) if row[7] is not None else None,
        "lng": float(row[8]) if row[8] is not None else None,
        "is_active": row[9],
    }}


class AreaCreate(BaseModel):
    area_code: str
    area_name: str
    port_un_code: str
    state_code: str | None = None
    city_id: int | None = None
    lat: float | None = None
    lng: float | None = None


class AreaUpdate(BaseModel):
    area_code: str | None = None
    area_name: str | None = None
    port_un_code: str | None = None
    state_code: str | None = None
    city_id: int | None = None
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
        INSERT INTO areas (area_code, area_name, port_un_code, state_code, city_id, lat, lng)
        VALUES (:code, :name, :port, :sc, :city, :lat, :lng)
        RETURNING area_id
    """), {
        "code": area_code, "name": body.area_name,
        "port": body.port_un_code, "sc": body.state_code,
        "city": body.city_id, "lat": body.lat, "lng": body.lng,
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

    for field in ["area_code", "area_name", "port_un_code", "state_code", "city_id", "lat", "lng"]:
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
