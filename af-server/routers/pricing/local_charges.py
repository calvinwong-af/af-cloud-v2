"""
routers/pricing/local_charges.py — Local Charges (port-level) rate endpoints.
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
_VALID_CONTAINER_SIZES = {"20", "40", "ALL"}
_VALID_CONTAINER_TYPES = {"GP", "HC", "RF", "FF", "OT", "FR", "PL", "ALL"}
_VALID_UOMS = {"CONTAINER", "CBM", "KG", "W/M", "CW_KG", "SET", "BL", "QTL", "RAIL_3KG"}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class LocalChargeCreate(BaseModel):
    port_code: str
    trade_direction: str
    shipment_type: str = "ALL"
    container_size: str = "ALL"
    container_type: str = "ALL"
    charge_code: str
    description: str
    price: float
    cost: float
    currency: str = "MYR"
    uom: str
    is_domestic: bool = False
    paid_with_freight: bool = False
    effective_from: str
    effective_to: Optional[str] = None
    is_active: bool = True


class LocalChargeUpdate(BaseModel):
    port_code: Optional[str] = None
    trade_direction: Optional[str] = None
    shipment_type: Optional[str] = None
    container_size: Optional[str] = None
    container_type: Optional[str] = None
    charge_code: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    cost: Optional[float] = None
    currency: Optional[str] = None
    uom: Optional[str] = None
    is_domestic: Optional[bool] = None
    paid_with_freight: Optional[bool] = None
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
        "container_size": r[4],
        "container_type": r[5],
        "charge_code": r[6],
        "description": r[7],
        "price": float(r[8]) if r[8] is not None else None,
        "cost": float(r[9]) if r[9] is not None else None,
        "currency": r[10],
        "uom": r[11],
        "is_domestic": r[12],
        "paid_with_freight": r[13],
        "effective_from": str(r[14]) if r[14] else None,
        "effective_to": str(r[15]) if r[15] else None,
        "is_active": r[16],
        "created_at": r[17].isoformat() if r[17] else None,
        "updated_at": r[18].isoformat() if r[18] else None,
    }


_SELECT = """
    SELECT id, port_code, trade_direction, shipment_type, container_size, container_type,
           charge_code, description, price, cost, currency, uom,
           is_domestic, paid_with_freight,
           effective_from, effective_to, is_active, created_at, updated_at
    FROM local_charges
"""


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/ports")
async def list_local_charge_ports(
    country_code: Optional[str] = Query(default=None),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Return distinct port_code values from local_charges, optionally filtered by country."""
    params: dict = {}
    where = "lc.is_active = TRUE"
    if country_code:
        where += " AND p.country_code = :cc"
        params["cc"] = country_code.upper()

    rows = conn.execute(text(f"""
        SELECT DISTINCT lc.port_code
        FROM local_charges lc
        JOIN ports p ON p.un_code = lc.port_code
        WHERE {where}
        ORDER BY lc.port_code
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
    """Return local charges grouped as virtual card objects with time_series."""
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
        ORDER BY trade_direction, shipment_type, container_size, container_type, charge_code, effective_from DESC
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
        card_key = f"{row['port_code']}|{row['trade_direction']}|{row['shipment_type']}|{row['container_size']}|{row['container_type']}|{row['charge_code']}|{str(row['is_domestic']).lower()}"
        cards_map[card_key].append(row)

    result = []
    for card_key, rate_rows in cards_map.items():
        # Use the latest row for card metadata
        latest = rate_rows[0]  # sorted by effective_from DESC

        # Build time_series
        ts = []
        for mb in month_buckets:
            mb_first = mb["first"]
            mb_last = mb["last"]
            # Find rows active in this month
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
            # Take the one with the latest effective_from
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
            "container_size": latest["container_size"],
            "container_type": latest["container_type"],
            "charge_code": latest["charge_code"],
            "description": latest["description"],
            "uom": latest["uom"],
            "currency": latest["currency"],
            "is_domestic": latest["is_domestic"],
            "paid_with_freight": latest["paid_with_freight"],
            "is_active": latest["is_active"],
            "time_series": ts,
            "latest_effective_from": latest["effective_from"],
            "latest_effective_to": latest["effective_to"],
        })

    return {"status": "OK", "data": result}


@router.get("/rates")
async def list_local_charges(
    port_code: Optional[str] = Query(default=None),
    trade_direction: Optional[str] = Query(default=None),
    shipment_type: Optional[str] = Query(default=None),
    is_domestic: Optional[bool] = Query(default=None),
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
    if is_domestic is not None:
        where.append("is_domestic = :domestic")
        params["domestic"] = is_domestic

    rows = conn.execute(text(f"""
        {_SELECT}
        WHERE {' AND '.join(where)}
        ORDER BY port_code, trade_direction, shipment_type, container_size, container_type, charge_code
    """), params).fetchall()

    return {"status": "OK", "data": [_row_to_dict(r) for r in rows]}


@router.get("/rates/{rate_id}")
async def get_local_charge(
    rate_id: int,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    row = conn.execute(text(f"""
        {_SELECT}
        WHERE id = :id
    """), {"id": rate_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Local charge not found")

    return {"status": "OK", "data": _row_to_dict(row)}


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

    # Check uniqueness
    existing = conn.execute(text("""
        SELECT id FROM local_charges
        WHERE port_code = :port AND trade_direction = :direction
          AND shipment_type = :stype AND container_size = :csize AND container_type = :ctype
          AND charge_code = :charge AND is_domestic = :domestic
          AND effective_from = :eff_from
    """), {
        "port": body.port_code,
        "direction": body.trade_direction,
        "stype": body.shipment_type,
        "csize": body.container_size,
        "ctype": body.container_type,
        "charge": body.charge_code,
        "domestic": body.is_domestic,
        "eff_from": body.effective_from,
    }).fetchone()

    if existing:
        raise HTTPException(status_code=409, detail="Duplicate local charge entry")

    now = datetime.now(timezone.utc).isoformat()
    result = conn.execute(text("""
        INSERT INTO local_charges (port_code, trade_direction, shipment_type,
                                   container_size, container_type,
                                   charge_code, description, price, cost, currency, uom,
                                   is_domestic, paid_with_freight,
                                   effective_from, effective_to, is_active, created_at, updated_at)
        VALUES (:port, :direction, :stype,
                :csize, :ctype,
                :charge, :description, :price, :cost, :currency, :uom,
                :domestic, :pwf,
                :eff_from, :eff_to, :active, :now, :now)
        RETURNING id
    """), {
        "port": body.port_code,
        "direction": body.trade_direction,
        "stype": body.shipment_type,
        "csize": body.container_size,
        "ctype": body.container_type,
        "charge": body.charge_code,
        "description": body.description,
        "price": body.price,
        "cost": body.cost,
        "currency": body.currency,
        "uom": body.uom,
        "domestic": body.is_domestic,
        "pwf": body.paid_with_freight,
        "eff_from": body.effective_from,
        "eff_to": body.effective_to,
        "active": body.is_active,
        "now": now,
    })
    new_id = result.fetchone()[0]
    conn.commit()

    return {"status": "OK", "data": {"id": new_id}}


@router.patch("/rates/{rate_id}")
async def update_local_charge(
    rate_id: int,
    body: LocalChargeUpdate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM local_charges WHERE id = :id"), {"id": rate_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Local charge not found")

    field_map = {
        "port_code": "port_code",
        "trade_direction": "trade_direction",
        "shipment_type": "shipment_type",
        "container_size": "container_size",
        "container_type": "container_type",
        "charge_code": "charge_code",
        "description": "description",
        "price": "price",
        "cost": "cost",
        "currency": "currency",
        "uom": "uom",
        "is_domestic": "is_domestic",
        "paid_with_freight": "paid_with_freight",
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
            if field == "container_size" and val is not None and val not in _VALID_CONTAINER_SIZES:
                raise HTTPException(status_code=400, detail=f"Invalid container_size: {val}")
            if field == "container_type" and val is not None and val not in _VALID_CONTAINER_TYPES:
                raise HTTPException(status_code=400, detail=f"Invalid container_type: {val}")
            if field == "uom" and val is not None and val not in _VALID_UOMS:
                raise HTTPException(status_code=400, detail=f"Invalid uom: {val}")
            updates.append(f"{col} = :{field}")
            params[field] = val

    if not updates:
        return {"status": "OK", "data": {"msg": "No fields to update"}}

    updates.append("updated_at = :now")
    params["now"] = datetime.now(timezone.utc).isoformat()

    conn.execute(text(f"UPDATE local_charges SET {', '.join(updates)} WHERE id = :id"), params)
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
