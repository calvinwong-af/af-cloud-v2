"""
routers/pricing/local_charges.py — Local Charges rate endpoints (two-tier schema).

Tables:
  local_charge_cards  — card identity (port, direction, type, container, charge_code, etc.)
  local_charges       — rate rows (price, cost, effective_from/to) with rate_card_id FK
"""

import calendar
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

from core.auth import Claims, require_afu, require_afu_admin
from core.db import get_db

router = APIRouter()

# ---------------------------------------------------------------------------
# Validation constants
# ---------------------------------------------------------------------------

_VALID_TRADE_DIRECTIONS = {"IMPORT", "EXPORT"}
_VALID_SHIPMENT_TYPES = {"FCL", "LCL", "AIR", "CB", "ALL"}
_VALID_CONTAINER_SIZES = {"20", "40", "ALL"}
_VALID_CONTAINER_TYPES = {"GP", "HC", "RF", "FF", "OT", "FR", "PL", "ALL"}
_VALID_UOMS = {"CONTAINER", "CBM", "KG", "W/M", "CW_KG", "SET", "BL", "QTL", "RAIL_3KG"}
_VALID_DG_CLASS_CODES = {"NON-DG", "DG-2", "DG-3", "ALL"}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class LocalChargeCardUpdate(BaseModel):
    port_code: Optional[str] = None
    trade_direction: Optional[str] = None
    shipment_type: Optional[str] = None
    container_size: Optional[str] = None
    container_type: Optional[str] = None
    dg_class_code: Optional[str] = None
    charge_code: Optional[str] = None
    description: Optional[str] = None
    currency: Optional[str] = None
    uom: Optional[str] = None
    is_domestic: Optional[bool] = None
    is_international: Optional[bool] = None
    is_active: Optional[bool] = None


class LocalChargeCreate(BaseModel):
    # Card identity
    port_code: str
    trade_direction: str
    shipment_type: str = "ALL"
    container_size: str = "ALL"
    container_type: str = "ALL"
    dg_class_code: str = "NON-DG"
    charge_code: str
    description: str
    currency: str = "MYR"
    uom: str
    is_domestic: bool = False
    is_international: bool = True
    # Rate fields
    price: float
    cost: float
    effective_from: str
    effective_to: Optional[str] = None
    close_previous: bool = True


class LocalChargeRateUpdate(BaseModel):
    price: Optional[float] = None
    cost: Optional[float] = None
    effective_from: Optional[str] = None
    effective_to: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_CARD_SELECT = """
    SELECT id, rate_card_key, port_code, trade_direction, shipment_type,
           container_size, container_type, dg_class_code,
           charge_code, description, currency, uom,
           is_domestic, is_international, is_active,
           created_at, updated_at
    FROM local_charge_cards
"""

_RATE_SELECT = """
    SELECT id, rate_card_id, price, cost, effective_from, effective_to,
           created_at, updated_at
    FROM local_charges
"""


def _card_to_dict(r) -> dict:
    return {
        "id": r[0], "rate_card_key": r[1],
        "port_code": r[2], "trade_direction": r[3], "shipment_type": r[4],
        "container_size": r[5], "container_type": r[6], "dg_class_code": r[7],
        "charge_code": r[8], "description": r[9], "currency": r[10], "uom": r[11],
        "is_domestic": r[12], "is_international": r[13], "is_active": r[14],
        "created_at": r[15].isoformat() if r[15] else None,
        "updated_at": r[16].isoformat() if r[16] else None,
    }


def _rate_to_dict(r) -> dict:
    return {
        "id": r[0], "rate_card_id": r[1],
        "price": float(r[2]) if r[2] is not None else None,
        "cost": float(r[3]) if r[3] is not None else None,
        "effective_from": str(r[4]) if r[4] else None,
        "effective_to": str(r[5]) if r[5] else None,
        "created_at": r[6].isoformat() if r[6] else None,
        "updated_at": r[7].isoformat() if r[7] else None,
    }


def _build_card_key(port_code, trade_direction, shipment_type, container_size,
                    container_type, dg_class_code, charge_code, is_domestic, is_international) -> str:
    return f"{port_code}|{trade_direction}|{shipment_type}|{container_size}|{container_type}|{dg_class_code}|{charge_code}|{str(is_domestic).lower()}|{str(is_international).lower()}"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/ports")
async def list_local_charge_ports(
    country_code: Optional[str] = Query(default=None),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Return distinct port_code values from local_charge_cards, optionally filtered by country."""
    params: dict = {}
    where = "lcc.is_active = TRUE"
    if country_code:
        where += " AND p.country_code = :cc"
        params["cc"] = country_code.upper()

    rows = conn.execute(text(f"""
        SELECT DISTINCT lcc.port_code
        FROM local_charge_cards lcc
        JOIN ports p ON p.un_code = lcc.port_code
        WHERE {where}
        ORDER BY lcc.port_code
    """), params).fetchall()

    return {"status": "OK", "data": [r[0] for r in rows]}


@router.get("/cards")
async def list_local_charge_cards(
    port_code: str = Query(...),
    trade_direction: Optional[str] = Query(default=None),
    shipment_type: Optional[str] = Query(default=None),
    is_active: bool = Query(default=True),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Return local charge cards with time_series built from rate rows."""
    if not port_code:
        raise HTTPException(status_code=400, detail="port_code is required")

    if trade_direction and trade_direction not in _VALID_TRADE_DIRECTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid trade_direction: {trade_direction}")
    if shipment_type and shipment_type not in _VALID_SHIPMENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid shipment_type: {shipment_type}")

    # Fetch cards
    card_where = ["port_code = :port"]
    params: dict = {"port": port_code}

    if is_active:
        card_where.append("is_active = TRUE")

    if trade_direction:
        card_where.append("trade_direction = :direction")
        params["direction"] = trade_direction
    if shipment_type:
        card_where.append("shipment_type = :stype")
        params["stype"] = shipment_type

    card_rows = conn.execute(text(f"""
        {_CARD_SELECT}
        WHERE {' AND '.join(card_where)}
        ORDER BY trade_direction, shipment_type, container_size, container_type, charge_code
    """), params).fetchall()

    if not card_rows:
        return {"status": "OK", "data": []}

    card_ids = [r[0] for r in card_rows]

    # Fetch all rate rows for these cards
    rate_rows = conn.execute(text(f"""
        {_RATE_SELECT}
        WHERE rate_card_id = ANY(:card_ids)
        ORDER BY rate_card_id, effective_from DESC
    """), {"card_ids": card_ids}).fetchall()

    # Group rate rows by card_id
    rates_by_card: dict = {}
    for r in rate_rows:
        rates_by_card.setdefault(r[1], []).append(_rate_to_dict(r))

    # Generate month buckets: 9 historical + current + 2 future = 12
    today = date.today()
    month_buckets = []
    for offset in range(-9, 3):
        m = today.month + offset
        y = today.year
        while m < 1:
            m += 12
            y -= 1
        while m > 12:
            m -= 12
            y += 1
        first = date(y, m, 1)
        last_day = calendar.monthrange(y, m)[1]
        last = date(y, m, last_day)
        month_buckets.append({
            "month_key": f"{y}-{str(m).zfill(2)}",
            "first": first,
            "last": last,
        })

    result = []
    for cr in card_rows:
        card = _card_to_dict(cr)
        card_rate_rows = rates_by_card.get(card["id"], [])

        # Build time_series
        ts = []
        for mb in month_buckets:
            mb_first = mb["first"]
            mb_last = mb["last"]
            active_rows = []
            for rr in card_rate_rows:
                eff_from = date.fromisoformat(rr["effective_from"]) if rr["effective_from"] else None
                eff_to = date.fromisoformat(rr["effective_to"]) if rr["effective_to"] else None
                if eff_from is None:
                    continue
                if eff_from > mb_last:
                    continue
                if eff_to is not None and eff_to < mb_first:
                    continue
                active_rows.append(rr)
            if not active_rows:
                continue
            best = max(active_rows, key=lambda x: x["effective_from"])
            ts.append({
                "month_key": mb["month_key"],
                "price": best["price"],
                "cost": best["cost"],
                "rate_id": best["id"],
            })

        # Find latest rate for effective_from/to display
        latest_rate = card_rate_rows[0] if card_rate_rows else None

        result.append({
            "card_id": card["id"],
            "card_key": card["rate_card_key"],
            "port_code": card["port_code"],
            "trade_direction": card["trade_direction"],
            "shipment_type": card["shipment_type"],
            "container_size": card["container_size"],
            "container_type": card["container_type"],
            "dg_class_code": card["dg_class_code"],
            "charge_code": card["charge_code"],
            "description": card["description"],
            "uom": card["uom"],
            "currency": card["currency"],
            "is_domestic": card["is_domestic"],
            "is_international": card["is_international"],
            "is_active": card["is_active"],
            "time_series": ts,
            "latest_effective_from": latest_rate["effective_from"] if latest_rate else None,
            "latest_effective_to": latest_rate["effective_to"] if latest_rate else None,
        })

    return {"status": "OK", "data": result}


@router.get("/rates/{rate_id}")
async def get_local_charge(
    rate_id: int,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Fetch a single rate row joined with its card."""
    row = conn.execute(text("""
        SELECT lc.id, lc.rate_card_id, lc.price, lc.cost,
               lc.effective_from, lc.effective_to, lc.created_at, lc.updated_at,
               lcc.port_code, lcc.trade_direction, lcc.shipment_type,
               lcc.container_size, lcc.container_type, lcc.dg_class_code,
               lcc.charge_code, lcc.description, lcc.currency, lcc.uom,
               lcc.is_domestic, lcc.is_international, lcc.is_active
        FROM local_charges lc
        JOIN local_charge_cards lcc ON lcc.id = lc.rate_card_id
        WHERE lc.id = :id
    """), {"id": rate_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Local charge not found")

    return {"status": "OK", "data": {
        "id": row[0],
        "rate_card_id": row[1],
        "price": float(row[2]) if row[2] is not None else None,
        "cost": float(row[3]) if row[3] is not None else None,
        "effective_from": str(row[4]) if row[4] else None,
        "effective_to": str(row[5]) if row[5] else None,
        "created_at": row[6].isoformat() if row[6] else None,
        "updated_at": row[7].isoformat() if row[7] else None,
        "port_code": row[8],
        "trade_direction": row[9],
        "shipment_type": row[10],
        "container_size": row[11],
        "container_type": row[12],
        "dg_class_code": row[13],
        "charge_code": row[14],
        "description": row[15],
        "currency": row[16],
        "uom": row[17],
        "is_domestic": row[18],
        "is_international": row[19],
        "is_active": row[20],
    }}


@router.post("/rates")
async def create_local_charge(
    body: LocalChargeCreate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    if body.trade_direction not in _VALID_TRADE_DIRECTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid trade_direction: {body.trade_direction}")
    if body.shipment_type not in _VALID_SHIPMENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid shipment_type: {body.shipment_type}")
    if body.container_size not in _VALID_CONTAINER_SIZES:
        raise HTTPException(status_code=400, detail=f"Invalid container_size: {body.container_size}")
    if body.container_type not in _VALID_CONTAINER_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid container_type: {body.container_type}")
    if body.uom not in _VALID_UOMS:
        raise HTTPException(status_code=400, detail=f"Invalid uom: {body.uom}")
    if body.dg_class_code not in _VALID_DG_CLASS_CODES:
        raise HTTPException(status_code=400, detail=f"Invalid dg_class_code: {body.dg_class_code}")

    if body.effective_to and body.effective_to < body.effective_from:
        raise HTTPException(status_code=400, detail="effective_to cannot be before effective_from")

    now = datetime.now(timezone.utc).isoformat()
    card_key = _build_card_key(
        body.port_code, body.trade_direction, body.shipment_type,
        body.container_size, body.container_type, body.dg_class_code,
        body.charge_code, body.is_domestic, body.is_international,
    )

    # Find or create card
    card_row = conn.execute(text(
        "SELECT id FROM local_charge_cards WHERE rate_card_key = :key"
    ), {"key": card_key}).fetchone()

    if card_row:
        card_id = card_row[0]
        # Update card-level fields if they differ
        conn.execute(text("""
            UPDATE local_charge_cards
            SET description = :desc, currency = :cur, uom = :uom, updated_at = :now
            WHERE id = :id
        """), {"desc": body.description, "cur": body.currency, "uom": body.uom,
               "now": now, "id": card_id})
    else:
        card_row = conn.execute(text("""
            INSERT INTO local_charge_cards (
                rate_card_key, port_code, trade_direction, shipment_type,
                container_size, container_type, dg_class_code,
                charge_code, description, currency, uom,
                is_domestic, is_international, is_active,
                created_at, updated_at
            ) VALUES (
                :key, :port, :direction, :stype,
                :csize, :ctype, :dg_class,
                :charge, :desc, :cur, :uom,
                :domestic, :is_intl, TRUE,
                :now, :now
            ) RETURNING id
        """), {
            "key": card_key, "port": body.port_code, "direction": body.trade_direction,
            "stype": body.shipment_type, "csize": body.container_size,
            "ctype": body.container_type, "dg_class": body.dg_class_code,
            "charge": body.charge_code, "desc": body.description,
            "cur": body.currency, "uom": body.uom,
            "domestic": body.is_domestic, "is_intl": body.is_international, "now": now,
        }).fetchone()
        card_id = card_row[0]

    # Check for duplicate rate row
    existing = conn.execute(text("""
        SELECT id FROM local_charges
        WHERE rate_card_id = :card_id AND effective_from = :eff_from
    """), {"card_id": card_id, "eff_from": body.effective_from}).fetchone()

    if existing:
        raise HTTPException(status_code=409, detail="Duplicate local charge entry")

    # Insert rate row
    result = conn.execute(text("""
        INSERT INTO local_charges (rate_card_id, price, cost,
                                   effective_from, effective_to,
                                   created_at, updated_at)
        VALUES (:card_id, :price, :cost, :eff_from, :eff_to, :now, :now)
        RETURNING id
    """), {
        "card_id": card_id,
        "price": body.price, "cost": body.cost,
        "eff_from": body.effective_from, "eff_to": body.effective_to,
        "now": now,
    })
    new_id = result.fetchone()[0]

    # Auto-close previous open-ended rate rows for the same card
    if body.close_previous:
        conn.execute(text("""
            UPDATE local_charges
            SET effective_to = (CAST(:eff_from AS date) - INTERVAL '1 day')::date,
                updated_at = :now
            WHERE rate_card_id = :card_id
              AND effective_to IS NULL
              AND id != :new_id
        """), {
            "eff_from": body.effective_from, "now": now,
            "card_id": card_id, "new_id": new_id,
        })

    conn.commit()

    return {"status": "OK", "data": {"id": new_id}}


@router.patch("/cards/{card_id}")
async def update_local_charge_card(
    card_id: int,
    body: LocalChargeCardUpdate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    """Update card-level fields on a local_charge_cards row."""
    existing = conn.execute(text(
        "SELECT id, port_code, trade_direction, shipment_type, container_size, "
        "container_type, dg_class_code, charge_code, is_domestic, is_international "
        "FROM local_charge_cards WHERE id = :id"
    ), {"id": card_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Local charge card not found")

    _VALIDATORS = {
        "trade_direction": (_VALID_TRADE_DIRECTIONS, "Invalid trade_direction"),
        "shipment_type": (_VALID_SHIPMENT_TYPES, "Invalid shipment_type"),
        "container_size": (_VALID_CONTAINER_SIZES, "Invalid container_size"),
        "container_type": (_VALID_CONTAINER_TYPES, "Invalid container_type"),
        "uom": (_VALID_UOMS, "Invalid uom"),
        "dg_class_code": (_VALID_DG_CLASS_CODES, "Invalid dg_class_code"),
    }

    provided = body.__fields_set__
    updates = []
    params: dict = {"id": card_id}

    for field in provided:
        val = getattr(body, field)
        if field in _VALIDATORS:
            valid_set, msg = _VALIDATORS[field]
            if val is not None and val not in valid_set:
                raise HTTPException(status_code=400, detail=f"{msg}: {val}")
        updates.append(f"{field} = :{field}")
        params[field] = val

    if not updates:
        return {"status": "OK", "data": {"msg": "No fields to update"}}

    # Rebuild rate_card_key if any key-forming field changed
    _KEY_FIELDS = {
        "port_code", "trade_direction", "shipment_type", "container_size",
        "container_type", "dg_class_code", "charge_code", "is_domestic", "is_international",
    }
    if provided & _KEY_FIELDS:
        key_vals = {
            "port_code": params.get("port_code", existing[1]),
            "trade_direction": params.get("trade_direction", existing[2]),
            "shipment_type": params.get("shipment_type", existing[3]),
            "container_size": params.get("container_size", existing[4]),
            "container_type": params.get("container_type", existing[5]),
            "dg_class_code": params.get("dg_class_code", existing[6]),
            "charge_code": params.get("charge_code", existing[7]),
            "is_domestic": params.get("is_domestic", existing[8]),
            "is_international": params.get("is_international", existing[9]),
        }
        new_key = _build_card_key(**key_vals)
        updates.append("rate_card_key = :new_key")
        params["new_key"] = new_key

    updates.append("updated_at = :now")
    params["now"] = datetime.now(timezone.utc).isoformat()

    conn.execute(text(
        f"UPDATE local_charge_cards SET {', '.join(updates)} WHERE id = :id"
    ), params)
    conn.commit()

    return {"status": "OK", "data": {"msg": "Updated"}}


@router.patch("/rates/{rate_id}")
async def update_local_charge_rate(
    rate_id: int,
    body: LocalChargeRateUpdate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    """Update rate-level fields on a local_charges row."""
    existing = conn.execute(text(
        "SELECT id FROM local_charges WHERE id = :id"
    ), {"id": rate_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Local charge not found")

    provided = body.__fields_set__
    updates = []
    params: dict = {"id": rate_id}

    for field in provided:
        val = getattr(body, field)
        updates.append(f"{field} = :{field}")
        params[field] = val

    if not updates:
        return {"status": "OK", "data": {"msg": "No fields to update"}}

    # Date range sanity check
    eff_from_final = params.get("effective_from")
    eff_to_final = params.get("effective_to")
    if "effective_from" not in provided or "effective_to" not in provided:
        row = conn.execute(text(
            "SELECT effective_from, effective_to FROM local_charges WHERE id = :id"
        ), {"id": rate_id}).fetchone()
        if row:
            if "effective_from" not in provided:
                eff_from_final = str(row[0]) if row[0] else None
            if "effective_to" not in provided:
                eff_to_final = str(row[1]) if row[1] else None
    if eff_from_final and eff_to_final and eff_to_final < eff_from_final:
        raise HTTPException(status_code=400, detail="effective_to cannot be before effective_from")

    updates.append("updated_at = :now")
    params["now"] = datetime.now(timezone.utc).isoformat()

    conn.execute(text(
        f"UPDATE local_charges SET {', '.join(updates)} WHERE id = :id"
    ), params)
    conn.commit()

    return {"status": "OK", "data": {"msg": "Updated"}}


@router.delete("/rates/{rate_id}")
async def delete_local_charge(
    rate_id: int,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM local_charges WHERE id = :id"), {"id": rate_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Local charge not found")

    conn.execute(text("DELETE FROM local_charges WHERE id = :id"), {"id": rate_id})
    conn.commit()

    return {"status": "OK", "data": {"msg": "Deleted"}}


@router.delete("/rates/card/{card_key:path}")
async def delete_local_charge_card(
    card_key: str,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    """Delete all rate rows for a card, then delete the card row itself."""
    card_row = conn.execute(text(
        "SELECT id FROM local_charge_cards WHERE rate_card_key = :key"
    ), {"key": card_key}).fetchone()

    if not card_row:
        raise HTTPException(status_code=404, detail="No card found for this key")

    card_id = card_row[0]

    # Delete all rate rows first (FK constraint)
    result = conn.execute(text(
        "DELETE FROM local_charges WHERE rate_card_id = :card_id"
    ), {"card_id": card_id})
    rate_count = result.rowcount

    # Delete the card row
    conn.execute(text(
        "DELETE FROM local_charge_cards WHERE id = :card_id"
    ), {"card_id": card_id})
    conn.commit()

    return {"status": "OK", "data": {"msg": f"Deleted card and {rate_count} rate(s)"}}
