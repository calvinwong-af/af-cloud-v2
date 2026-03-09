"""
routers/pricing/customs.py — Customs Clearance rate endpoints.
"""

from datetime import datetime, timezone
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
_VALID_SHIPMENT_TYPES = {"FCL", "LCL", "AIR", "CB"}
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
    amount: float
    currency: str = "MYR"
    uom: str
    effective_from: str
    effective_to: Optional[str] = None
    is_active: bool = True


class CustomsRateUpdate(BaseModel):
    port_code: Optional[str] = None
    trade_direction: Optional[str] = None
    shipment_type: Optional[str] = None
    charge_code: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    uom: Optional[str] = None
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
        "amount": float(r[6]) if r[6] is not None else None,
        "currency": r[7],
        "uom": r[8],
        "effective_from": str(r[9]) if r[9] else None,
        "effective_to": str(r[10]) if r[10] else None,
        "is_active": r[11],
        "created_at": r[12].isoformat() if r[12] else None,
        "updated_at": r[13].isoformat() if r[13] else None,
    }


_SELECT = """
    SELECT id, port_code, trade_direction, shipment_type,
           charge_code, description, amount, currency, uom,
           effective_from, effective_to, is_active, created_at, updated_at
    FROM customs_rates
"""


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

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

    # Check uniqueness
    existing = conn.execute(text("""
        SELECT id FROM customs_rates
        WHERE port_code = :port AND trade_direction = :direction
          AND shipment_type = :stype AND charge_code = :charge
          AND effective_from = :eff_from
    """), {
        "port": body.port_code,
        "direction": body.trade_direction,
        "stype": body.shipment_type,
        "charge": body.charge_code,
        "eff_from": body.effective_from,
    }).fetchone()

    if existing:
        raise HTTPException(status_code=409, detail="Duplicate customs rate entry")

    now = datetime.now(timezone.utc).isoformat()
    result = conn.execute(text("""
        INSERT INTO customs_rates (port_code, trade_direction, shipment_type,
                                   charge_code, description, amount, currency, uom,
                                   effective_from, effective_to, is_active, created_at, updated_at)
        VALUES (:port, :direction, :stype,
                :charge, :description, :amount, :currency, :uom,
                :eff_from, :eff_to, :active, :now, :now)
        RETURNING id
    """), {
        "port": body.port_code,
        "direction": body.trade_direction,
        "stype": body.shipment_type,
        "charge": body.charge_code,
        "description": body.description,
        "amount": body.amount,
        "currency": body.currency,
        "uom": body.uom,
        "eff_from": body.effective_from,
        "eff_to": body.effective_to,
        "active": body.is_active,
        "now": now,
    })
    new_id = result.fetchone()[0]
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
        "amount": "amount",
        "currency": "currency",
        "uom": "uom",
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
