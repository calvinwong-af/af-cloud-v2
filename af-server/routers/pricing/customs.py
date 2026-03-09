"""
routers/pricing/customs.py — Customs Clearance rate endpoints.
"""

import calendar
from collections import defaultdict
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
_VALID_UOMS = {"CONTAINER", "CBM", "KG", "W/M", "CW_KG", "SET", "BL"}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class CustomsRateCreate(BaseModel):
    port_code: str
    trade_direction: str
    shipment_type: str
    charge_code: str
    description: str
    price: float
    cost: float = 0.0
    currency: str = "MYR"
    uom: str
    is_domestic: bool = False
    effective_from: str
    effective_to: Optional[str] = None
    is_active: bool = True
    close_previous: bool = True


class CustomsRateUpdate(BaseModel):
    port_code: Optional[str] = None
    trade_direction: Optional[str] = None
    shipment_type: Optional[str] = None
    charge_code: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    cost: Optional[float] = None
    currency: Optional[str] = None
    uom: Optional[str] = None
    is_domestic: Optional[bool] = None
    effective_from: Optional[str] = None
    effective_to: Optional[str] = None
    is_active: Optional[bool] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row_to_dict(r) -> dict:
    return {
        "id": r[0],
        "port_code": r[1],
        "trade_direction": r[2],
        "shipment_type": r[3],
        "charge_code": r[4],
        "description": r[5],
        "price": float(r[6]) if r[6] is not None else None,
        "cost": float(r[7]) if r[7] is not None else None,
        "currency": r[8],
        "uom": r[9],
        "is_domestic": r[10],
        "effective_from": str(r[11]) if r[11] else None,
        "effective_to": str(r[12]) if r[12] else None,
        "is_active": r[13],
        "created_at": r[14].isoformat() if r[14] else None,
        "updated_at": r[15].isoformat() if r[15] else None,
    }


_SELECT = """
    SELECT id, port_code, trade_direction, shipment_type,
           charge_code, description, price, cost, currency, uom,
           is_domestic, effective_from, effective_to, is_active, created_at, updated_at
    FROM customs_rates
"""


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/ports")
async def list_customs_ports(
    country_code: Optional[str] = Query(default=None),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Return distinct port_code values from customs_rates, optionally filtered by country."""
    params: dict = {}
    where = "cr.is_active = TRUE"
    if country_code:
        where += " AND p.country_code = :cc"
        params["cc"] = country_code.upper()

    rows = conn.execute(text(f"""
        SELECT DISTINCT cr.port_code
        FROM customs_rates cr
        JOIN ports p ON p.un_code = cr.port_code
        WHERE {where}
        ORDER BY cr.port_code
    """), params).fetchall()

    return {"status": "OK", "data": [r[0] for r in rows]}


@router.get("/cards")
async def list_customs_cards(
    port_code: str = Query(...),
    trade_direction: Optional[str] = Query(default=None),
    shipment_type: Optional[str] = Query(default=None),
    is_active: bool = Query(default=True),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Return customs rates grouped as virtual card objects with time_series."""
    if not port_code:
        raise HTTPException(status_code=400, detail="port_code is required")

    if trade_direction and trade_direction not in _VALID_TRADE_DIRECTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid trade_direction: {trade_direction}")
    if shipment_type and shipment_type not in _VALID_SHIPMENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid shipment_type: {shipment_type}")

    where = ["port_code = :port"]
    params: dict = {"port": port_code}

    if is_active:
        where.append("is_active = :active")
        params["active"] = True

    if trade_direction:
        where.append("trade_direction = :direction")
        params["direction"] = trade_direction
    if shipment_type:
        where.append("shipment_type = :stype")
        params["stype"] = shipment_type

    rows = conn.execute(text(f"""
        {_SELECT}
        WHERE {' AND '.join(where)}
        ORDER BY trade_direction, shipment_type, charge_code, effective_from DESC
    """), params).fetchall()

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

    # Group rows into cards
    cards_map: dict = defaultdict(list)
    for r in rows:
        row = _row_to_dict(r)
        card_key = f"{row['port_code']}|{row['trade_direction']}|{row['shipment_type']}|{row['charge_code']}|{str(row['is_domestic']).lower()}"
        cards_map[card_key].append(row)

    result = []
    for card_key, rate_rows in cards_map.items():
        latest = rate_rows[0]  # sorted by effective_from DESC

        # Build time_series
        ts = []
        for mb in month_buckets:
            mb_first = mb["first"]
            mb_last = mb["last"]
            active_rows = []
            for rr in rate_rows:
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

        result.append({
            "card_key": card_key,
            "port_code": latest["port_code"],
            "trade_direction": latest["trade_direction"],
            "shipment_type": latest["shipment_type"],
            "charge_code": latest["charge_code"],
            "description": latest["description"],
            "uom": latest["uom"],
            "currency": latest["currency"],
            "is_domestic": latest["is_domestic"],
            "is_active": latest["is_active"],
            "time_series": ts,
            "latest_effective_from": latest["effective_from"],
            "latest_effective_to": latest["effective_to"],
        })

    return {"status": "OK", "data": result}


@router.get("/rates")
async def list_customs_rates(
    port_code: Optional[str] = Query(default=None),
    trade_direction: Optional[str] = Query(default=None),
    shipment_type: Optional[str] = Query(default=None),
    is_active: bool = Query(default=True),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    where = ["is_active = :active"]
    params: dict = {"active": is_active}

    if port_code:
        where.append("port_code = :port")
        params["port"] = port_code
    if trade_direction:
        if trade_direction not in _VALID_TRADE_DIRECTIONS:
            raise HTTPException(status_code=400, detail=f"Invalid trade_direction: {trade_direction}")
        where.append("trade_direction = :direction")
        params["direction"] = trade_direction
    if shipment_type:
        if shipment_type not in _VALID_SHIPMENT_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid shipment_type: {shipment_type}")
        where.append("shipment_type = :stype")
        params["stype"] = shipment_type

    rows = conn.execute(text(f"""
        {_SELECT}
        WHERE {' AND '.join(where)}
        ORDER BY port_code, trade_direction, shipment_type, charge_code
    """), params).fetchall()

    return {"status": "OK", "data": [_row_to_dict(r) for r in rows]}


@router.get("/rates/{rate_id}")
async def get_customs_rate(
    rate_id: int,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    row = conn.execute(text(f"""
        {_SELECT}
        WHERE id = :id
    """), {"id": rate_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Customs rate not found")

    return {"status": "OK", "data": _row_to_dict(row)}


@router.post("/rates")
async def create_customs_rate(
    body: CustomsRateCreate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    if body.trade_direction not in _VALID_TRADE_DIRECTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid trade_direction: {body.trade_direction}")
    if body.shipment_type not in _VALID_SHIPMENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid shipment_type: {body.shipment_type}")
    if body.uom not in _VALID_UOMS:
        raise HTTPException(status_code=400, detail=f"Invalid uom: {body.uom}")

    # Date range sanity check
    if body.effective_to and body.effective_to < body.effective_from:
        raise HTTPException(status_code=400, detail="effective_to cannot be before effective_from")

    # Check uniqueness
    existing = conn.execute(text("""
        SELECT id FROM customs_rates
        WHERE port_code = :port AND trade_direction = :direction
          AND shipment_type = :stype AND charge_code = :charge
          AND is_domestic = :domestic AND effective_from = :eff_from
    """), {
        "port": body.port_code,
        "direction": body.trade_direction,
        "stype": body.shipment_type,
        "charge": body.charge_code,
        "domestic": body.is_domestic,
        "eff_from": body.effective_from,
    }).fetchone()

    if existing:
        raise HTTPException(status_code=409, detail="Duplicate customs rate entry")

    now = datetime.now(timezone.utc).isoformat()
    result = conn.execute(text("""
        INSERT INTO customs_rates (port_code, trade_direction, shipment_type,
                                   charge_code, description, price, cost, currency, uom,
                                   is_domestic, effective_from, effective_to, is_active,
                                   created_at, updated_at)
        VALUES (:port, :direction, :stype,
                :charge, :description, :price, :cost, :currency, :uom,
                :domestic, :eff_from, :eff_to, :active, :now, :now)
        RETURNING id
    """), {
        "port": body.port_code,
        "direction": body.trade_direction,
        "stype": body.shipment_type,
        "charge": body.charge_code,
        "description": body.description,
        "price": body.price,
        "cost": body.cost,
        "currency": body.currency,
        "uom": body.uom,
        "domestic": body.is_domestic,
        "eff_from": body.effective_from,
        "eff_to": body.effective_to,
        "active": body.is_active,
        "now": now,
    })
    new_id = result.fetchone()[0]

    # Auto-close previous open-ended row for the same card key
    if body.close_previous:
        conn.execute(text("""
            UPDATE customs_rates
            SET effective_to = (CAST(:eff_from AS date) - INTERVAL '1 day')::date,
                updated_at = :now
            WHERE port_code = :port
              AND trade_direction = :direction
              AND shipment_type = :stype
              AND charge_code = :charge
              AND is_domestic = :domestic
              AND effective_to IS NULL
              AND id != :new_id
        """), {
            "eff_from": body.effective_from,
            "now": now,
            "port": body.port_code,
            "direction": body.trade_direction,
            "stype": body.shipment_type,
            "charge": body.charge_code,
            "domestic": body.is_domestic,
            "new_id": new_id,
        })

    conn.commit()

    return {"status": "OK", "data": {"id": new_id}}


@router.patch("/rates/{rate_id}")
async def update_customs_rate(
    rate_id: int,
    body: CustomsRateUpdate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM customs_rates WHERE id = :id"), {"id": rate_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Customs rate not found")

    field_map = {
        "port_code": "port_code",
        "trade_direction": "trade_direction",
        "shipment_type": "shipment_type",
        "charge_code": "charge_code",
        "description": "description",
        "price": "price",
        "cost": "cost",
        "currency": "currency",
        "uom": "uom",
        "is_domestic": "is_domestic",
        "effective_from": "effective_from",
        "effective_to": "effective_to",
        "is_active": "is_active",
    }

    updates = []
    params: dict = {"id": rate_id}
    provided = body.__fields_set__

    for field, col in field_map.items():
        if field in provided:
            val = getattr(body, field)
            if field == "trade_direction" and val is not None and val not in _VALID_TRADE_DIRECTIONS:
                raise HTTPException(status_code=400, detail=f"Invalid trade_direction: {val}")
            if field == "shipment_type" and val is not None and val not in _VALID_SHIPMENT_TYPES:
                raise HTTPException(status_code=400, detail=f"Invalid shipment_type: {val}")
            if field == "uom" and val is not None and val not in _VALID_UOMS:
                raise HTTPException(status_code=400, detail=f"Invalid uom: {val}")
            updates.append(f"{col} = :{field}")
            params[field] = val

    if not updates:
        return {"status": "OK", "data": {"msg": "No fields to update"}}

    # Date range sanity check — resolve final effective_from/to across provided + existing values
    eff_from_final = params.get("effective_from")
    eff_to_final = params.get("effective_to")
    if "effective_from" not in provided or "effective_to" not in provided:
        row = conn.execute(text("SELECT effective_from, effective_to FROM customs_rates WHERE id = :id"), {"id": rate_id}).fetchone()
        if row:
            if "effective_from" not in provided:
                eff_from_final = str(row[0]) if row[0] else None
            if "effective_to" not in provided:
                eff_to_final = str(row[1]) if row[1] else None
    if eff_from_final and eff_to_final and eff_to_final < eff_from_final:
        raise HTTPException(status_code=400, detail="effective_to cannot be before effective_from")

    updates.append("updated_at = :now")
    params["now"] = datetime.now(timezone.utc).isoformat()

    conn.execute(text(f"UPDATE customs_rates SET {', '.join(updates)} WHERE id = :id"), params)
    conn.commit()

    return {"status": "OK", "data": {"msg": "Updated"}}


@router.delete("/rates/{rate_id}")
async def delete_customs_rate(
    rate_id: int,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM customs_rates WHERE id = :id"), {"id": rate_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Customs rate not found")

    conn.execute(text("DELETE FROM customs_rates WHERE id = :id"), {"id": rate_id})
    conn.commit()

    return {"status": "OK", "data": {"msg": "Deleted"}}
