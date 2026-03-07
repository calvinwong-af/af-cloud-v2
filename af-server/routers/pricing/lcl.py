"""
routers/pricing/lcl.py — LCL rate card + rate endpoints.
"""

import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

from core.auth import Claims, require_afu, require_afu_admin
from core.db import get_db

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class LCLRateCardCreate(BaseModel):
    origin_port_code: str
    destination_port_code: str
    dg_class_code: str
    code: str
    description: str
    terminal_id: Optional[str] = None


class LCLRateCardUpdate(BaseModel):
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    terminal_id: Optional[str] = None


class LCLRateCreate(BaseModel):
    supplier_id: Optional[str] = None
    effective_from: date
    rate_status: str = "PUBLISHED"
    currency: str
    uom: str = "W/M"
    list_price: Optional[float] = None
    min_list_price: Optional[float] = None
    cost: Optional[float] = None
    min_cost: Optional[float] = None
    roundup_qty: int = 0
    lss: float = 0
    baf: float = 0
    ecrs: float = 0
    psc: float = 0


class LCLRateUpdate(BaseModel):
    supplier_id: Optional[str] = None
    effective_from: Optional[date] = None
    rate_status: Optional[str] = None
    currency: Optional[str] = None
    uom: Optional[str] = None
    list_price: Optional[float] = None
    min_list_price: Optional[float] = None
    cost: Optional[float] = None
    min_cost: Optional[float] = None
    roundup_qty: Optional[int] = None
    lss: Optional[float] = None
    baf: Optional[float] = None
    ecrs: Optional[float] = None
    psc: Optional[float] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row_to_rate_card(r) -> dict:
    return {
        "id": r[0],
        "rate_card_key": r[1],
        "origin_port_code": r[2],
        "destination_port_code": r[3],
        "dg_class_code": r[4],
        "code": r[5],
        "description": r[6],
        "is_active": r[7],
        "created_at": str(r[8]) if r[8] else None,
        "updated_at": str(r[9]) if r[9] else None,
        "terminal_id": r[10],
    }


def _row_to_rate(r) -> dict:
    return {
        "id": r[0],
        "rate_card_id": r[1],
        "supplier_id": r[2],
        "effective_from": str(r[3]) if r[3] else None,
        "rate_status": r[4],
        "currency": r[5],
        "uom": r[6],
        "list_price": float(r[7]) if r[7] is not None else None,
        "min_list_price": float(r[8]) if r[8] is not None else None,
        "cost": float(r[9]) if r[9] is not None else None,
        "min_cost": float(r[10]) if r[10] is not None else None,
        "roundup_qty": r[11],
        "lss": float(r[12]) if r[12] is not None else None,
        "baf": float(r[13]) if r[13] is not None else None,
        "ecrs": float(r[14]) if r[14] is not None else None,
        "psc": float(r[15]) if r[15] is not None else None,
        "created_at": str(r[16]) if r[16] else None,
        "updated_at": str(r[17]) if r[17] else None,
    }


_RATE_CARD_SELECT = """
    SELECT id, rate_card_key, origin_port_code, destination_port_code,
           dg_class_code, code, description, is_active, created_at, updated_at, terminal_id
    FROM lcl_rate_cards
"""

_RATE_SELECT = """
    SELECT id, rate_card_id, supplier_id, effective_from,
           rate_status::text, currency, uom,
           list_price, min_list_price, cost, min_cost,
           roundup_qty, lss, baf, ecrs, psc,
           created_at, updated_at
    FROM lcl_rates
"""

_VALID_RATE_STATUSES = {"PUBLISHED", "ON_REQUEST"}


# ---------------------------------------------------------------------------
# Rate Card endpoints
# ---------------------------------------------------------------------------

@router.get("/rate-cards")
async def list_lcl_rate_cards(
    origin_port_code: Optional[str] = Query(default=None),
    destination_port_code: Optional[str] = Query(default=None),
    dg_class_code: Optional[str] = Query(default=None),
    country_code: Optional[str] = Query(default=None),
    is_active: bool = Query(default=True),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    where = ["rc.is_active = :active"]
    params: dict = {"active": is_active}
    joins = ""

    if country_code:
        joins = """
            JOIN ports AS op ON op.un_code = rc.origin_port_code
            JOIN ports AS dp ON dp.un_code = rc.destination_port_code
        """
        where.append("(op.country_code = :country OR dp.country_code = :country)")
        params["country"] = country_code

    if origin_port_code:
        where.append("rc.origin_port_code = :origin")
        params["origin"] = origin_port_code
    if destination_port_code:
        where.append("rc.destination_port_code = :dest")
        params["dest"] = destination_port_code
    if dg_class_code:
        where.append("rc.dg_class_code = :dg")
        params["dg"] = dg_class_code

    rows = conn.execute(text(f"""
        SELECT rc.id, rc.rate_card_key, rc.origin_port_code, rc.destination_port_code,
               rc.dg_class_code, rc.code, rc.description, rc.is_active, rc.created_at, rc.updated_at, rc.terminal_id
        FROM lcl_rate_cards rc
        {joins}
        WHERE {' AND '.join(where)}
        ORDER BY rc.origin_port_code, rc.destination_port_code
    """), params).fetchall()

    cards = [_row_to_rate_card(r) for r in rows]

    # Attach latest price reference rate (supplier_id IS NULL) for each card
    if cards:
        card_ids = [c["id"] for c in cards]
        price_rows = conn.execute(text(f"""
            SELECT DISTINCT ON (rate_card_id)
                   rate_card_id, list_price, currency, effective_from
            FROM lcl_rates
            WHERE rate_card_id = ANY(:ids) AND supplier_id IS NULL
            ORDER BY rate_card_id, effective_from DESC
        """), {"ids": card_ids}).fetchall()

        price_map = {r[0]: {
            "list_price": float(r[1]) if r[1] is not None else None,
            "currency": r[2],
            "effective_from": str(r[3]) if r[3] else None,
        } for r in price_rows}

        for c in cards:
            c["latest_price_ref"] = price_map.get(c["id"])

    return {"status": "OK", "data": cards}


@router.get("/rate-cards/{card_id}")
async def get_lcl_rate_card(
    card_id: int,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    row = conn.execute(text(f"""
        {_RATE_CARD_SELECT}
        WHERE id = :id
    """), {"id": card_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"LCL rate card {card_id} not found")

    card = _row_to_rate_card(row)

    rate_rows = conn.execute(text(f"""
        {_RATE_SELECT}
        WHERE rate_card_id = :id
        ORDER BY supplier_id NULLS FIRST, effective_from DESC
    """), {"id": card_id}).fetchall()

    rates_by_supplier: dict[str | None, list] = {}
    for rr in rate_rows:
        rate = _row_to_rate(rr)
        key = rate["supplier_id"]
        if key not in rates_by_supplier:
            rates_by_supplier[key] = []
        rates_by_supplier[key].append(rate)

    card["rates_by_supplier"] = rates_by_supplier

    return {"status": "OK", "data": card}


@router.post("/rate-cards")
async def create_lcl_rate_card(
    body: LCLRateCardCreate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    origin = body.origin_port_code.strip().upper()
    dest = body.destination_port_code.strip().upper()

    if origin == dest:
        raise HTTPException(status_code=400, detail="Origin and destination must be different")

    dg = body.dg_class_code.strip().upper()
    rate_card_key = f"{origin}:{dest}:{dg}"

    existing = conn.execute(text(
        "SELECT id FROM lcl_rate_cards WHERE rate_card_key = :key"
    ), {"key": rate_card_key}).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail=f"Rate card {rate_card_key} already exists")

    # Validate terminal_id belongs to destination port
    if body.terminal_id:
        terminal = conn.execute(text(
            "SELECT port_un_code FROM port_terminals WHERE terminal_id = :tid"
        ), {"tid": body.terminal_id}).fetchone()
        if not terminal:
            raise HTTPException(status_code=400, detail=f"Terminal {body.terminal_id} not found")
        if terminal[0] != dest:
            raise HTTPException(status_code=400,
                                detail=f"Terminal {body.terminal_id} belongs to port {terminal[0]}, not {dest}")

    row = conn.execute(text("""
        INSERT INTO lcl_rate_cards
            (rate_card_key, origin_port_code, destination_port_code,
             dg_class_code, code, description, terminal_id)
        VALUES (:key, :origin, :dest, :dg, :code, :desc, :terminal_id)
        RETURNING id, created_at
    """), {
        "key": rate_card_key, "origin": origin, "dest": dest,
        "dg": dg, "code": body.code, "desc": body.description,
        "terminal_id": body.terminal_id,
    }).fetchone()

    return {"status": "OK", "data": {
        "id": row[0], "rate_card_key": rate_card_key,
        "origin_port_code": origin, "destination_port_code": dest,
        "dg_class_code": dg,
        "code": body.code, "description": body.description,
        "terminal_id": body.terminal_id,
        "is_active": True, "created_at": str(row[1]),
    }}


@router.patch("/rate-cards/{card_id}")
async def update_lcl_rate_card(
    card_id: int,
    body: LCLRateCardUpdate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM lcl_rate_cards WHERE id = :id"),
                            {"id": card_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"LCL rate card {card_id} not found")

    updates = []
    params: dict = {"id": card_id}

    if body.code is not None:
        updates.append("code = :code")
        params["code"] = body.code
    if body.description is not None:
        updates.append("description = :desc")
        params["desc"] = body.description
    if body.is_active is not None:
        updates.append("is_active = :active")
        params["active"] = body.is_active
    if body.terminal_id is not None:
        updates.append("terminal_id = :terminal_id")
        params["terminal_id"] = body.terminal_id

    if not updates:
        return {"status": "OK", "msg": "No changes"}

    updates.append("updated_at = NOW()")
    conn.execute(text(f"UPDATE lcl_rate_cards SET {', '.join(updates)} WHERE id = :id"), params)

    return {"status": "OK", "msg": "Rate card updated"}


# ---------------------------------------------------------------------------
# Rate endpoints
# ---------------------------------------------------------------------------

@router.get("/rate-cards/{card_id}/rates")
async def list_lcl_rates(
    card_id: int,
    supplier_id: Optional[str] = Query(default=None),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    card = conn.execute(text("SELECT id FROM lcl_rate_cards WHERE id = :id"),
                        {"id": card_id}).fetchone()
    if not card:
        raise HTTPException(status_code=404, detail=f"LCL rate card {card_id} not found")

    where = "rate_card_id = :card_id"
    params: dict = {"card_id": card_id}

    if supplier_id is not None:
        if supplier_id == "":
            where += " AND supplier_id IS NULL"
        else:
            where += " AND supplier_id = :supplier"
            params["supplier"] = supplier_id

    rows = conn.execute(text(f"""
        {_RATE_SELECT}
        WHERE {where}
        ORDER BY effective_from DESC
    """), params).fetchall()

    return {"status": "OK", "data": [_row_to_rate(r) for r in rows]}


@router.post("/rate-cards/{card_id}/rates")
async def create_lcl_rate(
    card_id: int,
    body: LCLRateCreate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    card = conn.execute(text("SELECT id FROM lcl_rate_cards WHERE id = :id"),
                        {"id": card_id}).fetchone()
    if not card:
        raise HTTPException(status_code=404, detail=f"LCL rate card {card_id} not found")

    if body.rate_status not in _VALID_RATE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid rate_status: {body.rate_status}")

    row = conn.execute(text("""
        INSERT INTO lcl_rates
            (rate_card_id, supplier_id, effective_from, rate_status,
             currency, uom, list_price, min_list_price, cost, min_cost,
             roundup_qty, lss, baf, ecrs, psc)
        VALUES
            (:card_id, :supplier, :eff, :status::rate_status,
             :currency, :uom, :list_price, :min_list_price, :cost, :min_cost,
             :roundup_qty, :lss, :baf, :ecrs, :psc)
        RETURNING id, created_at
    """), {
        "card_id": card_id, "supplier": body.supplier_id,
        "eff": body.effective_from, "status": body.rate_status,
        "currency": body.currency, "uom": body.uom,
        "list_price": body.list_price, "min_list_price": body.min_list_price,
        "cost": body.cost, "min_cost": body.min_cost,
        "roundup_qty": body.roundup_qty,
        "lss": body.lss, "baf": body.baf, "ecrs": body.ecrs, "psc": body.psc,
    }).fetchone()

    return {"status": "OK", "data": {
        "id": row[0], "rate_card_id": card_id,
        "created_at": str(row[1]),
    }}


@router.patch("/rates/{rate_id}")
async def update_lcl_rate(
    rate_id: int,
    body: LCLRateUpdate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM lcl_rates WHERE id = :id"),
                            {"id": rate_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"LCL rate {rate_id} not found")

    updates = []
    params: dict = {"id": rate_id}

    field_map = {
        "supplier_id": "supplier_id",
        "effective_from": "effective_from",
        "currency": "currency",
        "uom": "uom",
        "list_price": "list_price",
        "min_list_price": "min_list_price",
        "cost": "cost",
        "min_cost": "min_cost",
        "roundup_qty": "roundup_qty",
        "lss": "lss",
        "baf": "baf",
        "ecrs": "ecrs",
        "psc": "psc",
    }

    for field, col in field_map.items():
        val = getattr(body, field, None)
        if val is not None:
            updates.append(f"{col} = :{field}")
            params[field] = val

    if body.rate_status is not None:
        if body.rate_status not in _VALID_RATE_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid rate_status: {body.rate_status}")
        updates.append("rate_status = :rate_status::rate_status")
        params["rate_status"] = body.rate_status

    if not updates:
        return {"status": "OK", "msg": "No changes"}

    updates.append("updated_at = NOW()")
    conn.execute(text(f"UPDATE lcl_rates SET {', '.join(updates)} WHERE id = :id"), params)

    return {"status": "OK", "msg": "Rate updated"}


@router.delete("/rates/{rate_id}")
async def delete_lcl_rate(
    rate_id: int,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM lcl_rates WHERE id = :id"),
                            {"id": rate_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"LCL rate {rate_id} not found")

    conn.execute(text("DELETE FROM lcl_rates WHERE id = :id"), {"id": rate_id})

    return {"status": "OK", "msg": "Rate deleted"}
