"""
routers/pricing/lcl.py — LCL rate card + rate endpoints.
"""

import json
import logging
from datetime import date
from typing import Optional

from dateutil.relativedelta import relativedelta

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
    effective_to: Optional[date] = None
    rate_status: str = "PUBLISHED"
    currency: str
    uom: str = "W/M"
    list_price: Optional[float] = None
    cost: Optional[float] = None
    min_quantity: Optional[float] = None
    roundup_qty: int = 0
    surcharges: Optional[list] = None


class LCLRateUpdate(BaseModel):
    supplier_id: Optional[str] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    rate_status: Optional[str] = None
    currency: Optional[str] = None
    uom: Optional[str] = None
    list_price: Optional[float] = None
    cost: Optional[float] = None
    min_quantity: Optional[float] = None
    roundup_qty: Optional[int] = None
    surcharges: Optional[list] = None


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
        "cost": float(r[8]) if r[8] is not None else None,
        "min_quantity": float(r[9]) if r[9] is not None else None,
        "roundup_qty": r[10],
        "lss": float(r[11]) if r[11] is not None else None,
        "baf": float(r[12]) if r[12] is not None else None,
        "ecrs": float(r[13]) if r[13] is not None else None,
        "psc": float(r[14]) if r[14] is not None else None,
        "created_at": str(r[15]) if r[15] else None,
        "updated_at": str(r[16]) if r[16] else None,
        "effective_to": str(r[17]) if r[17] else None,
        "surcharges": r[18] if r[18] is not None else None,
    }


def _surcharge_total(surcharges) -> float:
    """Sum all surcharge amounts. Returns 0.0 if surcharges is None or empty."""
    if not surcharges:
        return 0.0
    return sum(float(s.get('amount', 0) or 0) for s in surcharges)


_RATE_CARD_SELECT = """
    SELECT id, rate_card_key, origin_port_code, destination_port_code,
           dg_class_code, code, description, is_active, created_at, updated_at, terminal_id
    FROM lcl_rate_cards
"""

_RATE_SELECT = """
    SELECT id, rate_card_id, supplier_id, effective_from,
           rate_status::text, currency, uom,
           list_price, cost, min_quantity,
           roundup_qty, lss, baf, ecrs, psc,
           created_at, updated_at, effective_to, surcharges
    FROM lcl_rates
"""

_VALID_RATE_STATUSES = {"PUBLISHED", "ON_REQUEST", "DRAFT", "REJECTED"}


# ---------------------------------------------------------------------------
# Rate Card endpoints
# ---------------------------------------------------------------------------

@router.get("/origins")
async def list_lcl_origins(
    country_code: Optional[str] = Query(default=None),
    is_active: bool = Query(default=True),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    where = ["rc.is_active = :active"]
    params: dict = {"active": is_active}
    joins = ""

    if country_code:
        joins = "JOIN ports AS op ON op.un_code = rc.origin_port_code"
        where.append("op.country_code = :country")
        params["country"] = country_code

    rows = conn.execute(text(f"""
        SELECT DISTINCT rc.origin_port_code
        FROM lcl_rate_cards rc
        {joins}
        WHERE {' AND '.join(where)}
        ORDER BY rc.origin_port_code
    """), params).fetchall()

    return {"status": "OK", "data": [r[0] for r in rows]}


@router.get("/rate-cards")
async def list_lcl_rate_cards(
    origin_port_code: Optional[str] = Query(default=None),
    destination_port_code: Optional[str] = Query(default=None),
    dg_class_code: Optional[str] = Query(default=None),
    country_code: Optional[str] = Query(default=None),
    is_active: bool = Query(default=True),
    alerts_only: bool = Query(default=False),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    where = ["rc.is_active = :active"]
    params: dict = {"active": is_active}
    joins = ""

    if country_code:
        joins = "JOIN ports AS op ON op.un_code = rc.origin_port_code"
        where.append("op.country_code = :country")
        params["country"] = country_code

    if origin_port_code and not alerts_only:
        where.append("rc.origin_port_code = :origin")
        params["origin"] = origin_port_code
    if destination_port_code:
        where.append("rc.destination_port_code = :dest")
        params["dest"] = destination_port_code
    if dg_class_code:
        where.append("rc.dg_class_code = :dg")
        params["dg"] = dg_class_code

    if alerts_only:
        where.append("""(
            (
                EXISTS (SELECT 1 FROM lcl_rates r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NOT NULL AND r.rate_status = 'PUBLISHED' AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE))
                AND (SELECT MIN(r2.cost) FROM lcl_rates r2 WHERE r2.rate_card_id = rc.id AND r2.supplier_id IS NOT NULL AND r2.rate_status = 'PUBLISHED' AND r2.effective_from <= CURRENT_DATE AND (r2.effective_to IS NULL OR r2.effective_to >= CURRENT_DATE) AND r2.cost IS NOT NULL)
                    > (SELECT r3.list_price FROM lcl_rates r3 WHERE r3.rate_card_id = rc.id AND r3.supplier_id IS NULL AND r3.rate_status = 'PUBLISHED' AND r3.effective_from <= CURRENT_DATE AND (r3.effective_to IS NULL OR r3.effective_to >= CURRENT_DATE) ORDER BY r3.effective_from DESC LIMIT 1)
            )
            OR
            (
                EXISTS (SELECT 1 FROM lcl_rates r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NOT NULL AND r.rate_status = 'PUBLISHED' AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE) AND r.cost IS NOT NULL)
                AND NOT EXISTS (SELECT 1 FROM lcl_rates r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NULL AND r.rate_status = 'PUBLISHED' AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE) AND r.list_price IS NOT NULL)
            )
            OR
            (
                (SELECT MAX(r.effective_from) FROM lcl_rates r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NOT NULL AND r.rate_status = 'PUBLISHED')
                > (SELECT MAX(r.effective_from) FROM lcl_rates r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NULL AND r.rate_status = 'PUBLISHED')
            )
        )""")

    terminal_join = "LEFT JOIN port_terminals pt ON pt.terminal_id = rc.terminal_id"
    rows = conn.execute(text(f"""
        SELECT rc.id, rc.rate_card_key, rc.origin_port_code, rc.destination_port_code,
               rc.dg_class_code, rc.code, rc.description, rc.is_active, rc.created_at, rc.updated_at,
               rc.terminal_id, pt.name AS terminal_name
        FROM lcl_rate_cards rc
        {terminal_join}
        {joins}
        WHERE {' AND '.join(where)}
        ORDER BY rc.origin_port_code, rc.destination_port_code
    """), params).fetchall()

    cards = []
    for r in rows:
        card = _row_to_rate_card(r)
        card["terminal_name"] = r[11] if len(r) > 11 else None
        cards.append(card)

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

        # Attach pending DRAFT count per card
        draft_rows = conn.execute(text("""
            SELECT rate_card_id, COUNT(*) AS cnt
            FROM lcl_rates
            WHERE rate_card_id = ANY(:ids) AND rate_status = 'DRAFT'
            GROUP BY rate_card_id
        """), {"ids": card_ids}).fetchall()

        draft_map = {r[0]: r[1] for r in draft_rows}
        for c in cards:
            c["pending_draft_count"] = draft_map.get(c["id"], 0)

        # Build 9-month time series per card (6 past + current + 2 forward)
        today = date.today()
        months = [(today + relativedelta(months=i - 6)).replace(day=1) for i in range(9)]
        month_start = months[0]
        month_end = (months[-1] + relativedelta(months=1))

        ts_rows = conn.execute(text("""
            SELECT id, rate_card_id, supplier_id, effective_from,
                   rate_status::text, currency, list_price, cost, min_quantity,
                   effective_to, surcharges
            FROM lcl_rates
            WHERE rate_card_id = ANY(:ids)
              AND effective_from < :m_end
              AND (effective_to IS NULL OR effective_to >= :m_start)
              AND rate_status IN ('PUBLISHED', 'DRAFT')
        """), {"ids": card_ids, "m_start": month_start, "m_end": month_end}).fetchall()

        # Seed carry-forward: fetch the most recent rate BEFORE the window for each card
        seed_price_rows = conn.execute(text("""
            SELECT DISTINCT ON (rate_card_id)
                   rate_card_id, list_price, currency, rate_status::text, effective_to, surcharges
            FROM lcl_rates
            WHERE rate_card_id = ANY(:ids)
              AND supplier_id IS NULL
              AND effective_from < :m_start
              AND rate_status IN ('PUBLISHED', 'DRAFT')
            ORDER BY rate_card_id, effective_from DESC
        """), {"ids": card_ids, "m_start": month_start}).fetchall()

        seed_cost_rows = conn.execute(text("""
            SELECT DISTINCT ON (rate_card_id, supplier_id)
                   rate_card_id, supplier_id, cost, min_quantity, effective_to, surcharges
            FROM lcl_rates
            WHERE rate_card_id = ANY(:ids)
              AND supplier_id IS NOT NULL
              AND effective_from < :m_start
              AND rate_status = 'PUBLISHED'
              AND cost IS NOT NULL
            ORDER BY rate_card_id, supplier_id, effective_from DESC
        """), {"ids": card_ids, "m_start": month_start}).fetchall()

        seed_price_map = {r[0]: {
            "list_price": float(r[1]) if r[1] is not None else None,
            "currency": r[2],
            "rate_status": r[3],
            "_eff": None,
            "_eff_to": r[4],
            "_surcharges": r[5],
        } for r in seed_price_rows}

        # seed_supplier_costs: { card_id: { supplier_id: { cost, min_quantity, eff_to, surcharges } } }
        seed_supplier_costs: dict[int, dict[str, dict]] = {}
        for r in seed_cost_rows:
            card_id_s, supplier_id_s, cost_s, min_qty_s, eff_to_s, surcharges_s = r
            if card_id_s not in seed_supplier_costs:
                seed_supplier_costs[card_id_s] = {}
            seed_supplier_costs[card_id_s][supplier_id_s] = {
                "cost": float(cost_s),
                "min_quantity": float(min_qty_s) if min_qty_s is not None else None,
                "eff_to": eff_to_s,
                "surcharges": surcharges_s,
            }

        from collections import defaultdict
        price_ref_map: dict[tuple[int, str], dict] = {}
        cost_map: dict[tuple[int, str], list[tuple[float, list | None]]] = defaultdict(list)
        cost_map_by_supplier: dict[tuple[int, str], dict[str, tuple]] = defaultdict(dict)

        for r in ts_rows:
            rid, rc_id, supplier_id, eff_from, r_status, currency, lp, cost_val, min_qty, eff_to, surcharges_json = r
            mk = f"{eff_from.year}-{eff_from.month:02d}"
            key = (rc_id, mk)

            if supplier_id is None:
                existing = price_ref_map.get(key)
                if existing is None or eff_from > existing["_eff"]:
                    price_ref_map[key] = {
                        "list_price": float(lp) if lp is not None else None,
                        "currency": currency,
                        "rate_status": r_status,
                        "_eff": eff_from,
                        "_eff_to": eff_to,
                        "_surcharges": surcharges_json,
                    }
            elif r_status == "PUBLISHED":
                if cost_val is not None:
                    cost_map[key].append((float(cost_val), surcharges_json))
                    cost_map_by_supplier[key][supplier_id] = (float(cost_val), min_qty, eff_to, surcharges_json)

        current_month_key = f"{today.year}-{today.month:02d}"
        month_keys = [f"{m.year}-{m.month:02d}" for m in months]
        for c in cards:
            cid = c["id"]
            ts = []
            last_pr: dict | None = seed_price_map.get(cid)
            # Per-supplier carry-forward for cost
            active_supplier_costs: dict[str, dict] = dict(seed_supplier_costs.get(cid, {}))
            for mk in month_keys:
                key = (cid, mk)
                pr = price_ref_map.get(key)
                cost_entries = cost_map.get(key)

                is_future = mk > current_month_key

                if pr is not None:
                    last_pr = pr

                month_start_d = date(int(mk[:4]), int(mk[5:7]), 1)

                # Update per-supplier carry-forward with any new window entries
                supplier_updates = cost_map_by_supplier.get(key, {})
                for sup_id, (c_val, mq_val, c_eff_to, c_surcharges) in supplier_updates.items():
                    active_supplier_costs[sup_id] = {
                        "cost": c_val,
                        "min_quantity": float(mq_val) if mq_val is not None else None,
                        "eff_to": c_eff_to,
                        "surcharges": c_surcharges,
                    }

                # Expire suppliers whose effective_to has passed
                active_supplier_costs = {
                    sup_id: entry
                    for sup_id, entry in active_supplier_costs.items()
                    if entry["eff_to"] is None or entry["eff_to"] >= month_start_d
                }

                # Derive best cost across all active suppliers
                if active_supplier_costs:
                    best_sup = min(
                        active_supplier_costs.values(),
                        key=lambda e: e["cost"] + _surcharge_total(e["surcharges"])
                    )
                    last_cost = best_sup["cost"]
                    last_min_quantity = best_sup["min_quantity"]
                    last_cost_surcharges = best_sup["surcharges"]
                else:
                    last_cost = None
                    last_min_quantity = None
                    last_cost_surcharges = None

                # Expiry: stop carry-forward for expired price ref
                if last_pr is not None:
                    pr_eff_to = last_pr.get("_eff_to")
                    if pr_eff_to is not None and pr_eff_to < month_start_d:
                        last_pr = None

                if is_future:
                    pr_sc = _surcharge_total(pr.get("_surcharges")) if pr else 0.0
                    best_cost_entry = min(cost_entries, key=lambda e: e[0] + _surcharge_total(e[1])) if cost_entries else None
                    cost_sc = _surcharge_total(best_cost_entry[1]) if best_cost_entry else 0.0
                    has_any = pr is not None or bool(cost_entries)
                    ts.append({
                        "month_key": mk,
                        "list_price": pr["list_price"] if pr else None,
                        "cost": best_cost_entry[0] if best_cost_entry else None,
                        "min_quantity": last_min_quantity,
                        "currency": pr["currency"] if pr else None,
                        "rate_status": pr["rate_status"] if pr else None,
                        "list_surcharge_total": pr_sc,
                        "cost_surcharge_total": cost_sc,
                        "surcharge_total": pr_sc,
                        "has_surcharges": (pr_sc > 0 or cost_sc > 0) and has_any,
                    })
                else:
                    pr_sc = _surcharge_total(last_pr.get("_surcharges")) if last_pr else 0.0
                    cost_sc = _surcharge_total(last_cost_surcharges) if last_cost is not None else 0.0
                    has_any = last_pr is not None or last_cost is not None
                    ts.append({
                        "month_key": mk,
                        "list_price": last_pr["list_price"] if last_pr else None,
                        "cost": last_cost,
                        "min_quantity": last_min_quantity,
                        "currency": last_pr["currency"] if last_pr else None,
                        "rate_status": last_pr["rate_status"] if last_pr else None,
                        "list_surcharge_total": pr_sc,
                        "cost_surcharge_total": cost_sc,
                        "surcharge_total": pr_sc,
                        "has_surcharges": (pr_sc > 0 or cost_sc > 0) and has_any,
                    })
            c["time_series"] = ts

        # Attach latest effective_from per supplier type for alert scenario 3
        date_meta_rows = conn.execute(text("""
            SELECT
                rate_card_id,
                MAX(CASE WHEN supplier_id IS NULL THEN effective_from END) AS latest_list_price_from,
                MAX(CASE WHEN supplier_id IS NOT NULL AND rate_status = 'PUBLISHED' THEN effective_from END) AS latest_cost_from
            FROM lcl_rates
            WHERE rate_card_id = ANY(:ids)
              AND rate_status IN ('PUBLISHED', 'DRAFT')
            GROUP BY rate_card_id
        """), {"ids": card_ids}).fetchall()

        date_meta_map = {r[0]: {"latest_list_price_from": r[1], "latest_cost_from": r[2]} for r in date_meta_rows}
        for c in cards:
            meta = date_meta_map.get(c["id"], {})
            c["latest_list_price_from"] = str(meta["latest_list_price_from"]) if meta.get("latest_list_price_from") else None
            c["latest_cost_from"] = str(meta["latest_cost_from"]) if meta.get("latest_cost_from") else None

    return {"status": "OK", "data": cards}


@router.get("/rate-cards/{card_id}")
async def get_lcl_rate_card(
    card_id: int,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    row = conn.execute(text("""
        SELECT rc.id, rc.rate_card_key, rc.origin_port_code, rc.destination_port_code,
               rc.dg_class_code, rc.code, rc.description, rc.is_active, rc.created_at, rc.updated_at,
               rc.terminal_id, pt.name AS terminal_name
        FROM lcl_rate_cards rc
        LEFT JOIN port_terminals pt ON pt.terminal_id = rc.terminal_id
        WHERE rc.id = :id
    """), {"id": card_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"LCL rate card {card_id} not found")

    card = _row_to_rate_card(row)
    card["terminal_name"] = row[11] if len(row) > 11 else None

    # Seed + window pattern: only fetch rates relevant to the display range
    MIGRATION_FLOOR = date(2024, 1, 1)

    # Fetch all rates within the display window
    window_rows = conn.execute(text(f"""
        {_RATE_SELECT}
        WHERE rate_card_id = :id
          AND effective_from >= :floor
        ORDER BY supplier_id NULLS FIRST, effective_from DESC
    """), {"id": card_id, "floor": MIGRATION_FLOOR}).fetchall()

    # Fetch one seed record per supplier before the floor (carry-forward)
    seed_rows = conn.execute(text("""
        SELECT DISTINCT ON (supplier_id)
            id, rate_card_id, supplier_id, effective_from,
            rate_status::text, currency, uom,
            list_price, cost, min_quantity,
            roundup_qty, lss, baf, ecrs, psc,
            created_at, updated_at, effective_to, surcharges
        FROM lcl_rates
        WHERE rate_card_id = :id
          AND effective_from < :floor
          AND rate_status IN ('PUBLISHED', 'DRAFT')
        ORDER BY supplier_id NULLS FIRST, effective_from DESC
    """), {"id": card_id, "floor": MIGRATION_FLOOR}).fetchall()

    # Merge: always include seed records — frontend getDominantRate handles
    # multiple records per supplier by sorting DESC and picking the correct one
    # per month. Excluding seeds when window records exist causes gaps in the
    # sparkline for months before the latest rate's effective_from.
    rate_rows = list(window_rows) + list(seed_rows)

    rates_by_supplier: dict[str | None, list] = {}
    for rr in rate_rows:
        rate = _row_to_rate(rr)
        key = rate["supplier_id"]
        if key not in rates_by_supplier:
            rates_by_supplier[key] = []
        rates_by_supplier[key].append(rate)

    card["rates_by_supplier"] = rates_by_supplier

    # Latest effective_from per supplier type for alert scenario 3
    date_meta = conn.execute(text("""
        SELECT
            MAX(CASE WHEN supplier_id IS NULL THEN effective_from END),
            MAX(CASE WHEN supplier_id IS NOT NULL AND rate_status = 'PUBLISHED' THEN effective_from END)
        FROM lcl_rates
        WHERE rate_card_id = :id
    """), {"id": card_id}).fetchone()
    card["latest_list_price_from"] = str(date_meta[0]) if date_meta and date_meta[0] else None
    card["latest_cost_from"] = str(date_meta[1]) if date_meta and date_meta[1] else None

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
            (rate_card_id, supplier_id, effective_from, effective_to, rate_status,
             currency, uom, list_price, cost, min_quantity,
             roundup_qty, surcharges)
        VALUES
            (:card_id, :supplier, :eff, :eff_to, CAST(:status AS rate_status),
             :currency, :uom, :list_price, :cost, :min_quantity,
             :roundup_qty, :surcharges)
        RETURNING id, created_at
    """), {
        "card_id": card_id, "supplier": body.supplier_id,
        "eff": body.effective_from, "eff_to": body.effective_to, "status": body.rate_status,
        "currency": body.currency, "uom": body.uom,
        "list_price": body.list_price,
        "cost": body.cost, "min_quantity": body.min_quantity,
        "roundup_qty": body.roundup_qty,
        "surcharges": json.dumps(body.surcharges) if body.surcharges else None,
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
        "cost": "cost",
        "min_quantity": "min_quantity",
        "roundup_qty": "roundup_qty",
    }

    for field, col in field_map.items():
        val = getattr(body, field, None)
        if val is not None:
            updates.append(f"{col} = :{field}")
            params[field] = val

    # effective_to can be explicitly set to NULL, so handle separately
    if body.effective_to is not None:
        updates.append("effective_to = :effective_to")
        params["effective_to"] = body.effective_to

    if body.rate_status is not None:
        if body.rate_status not in _VALID_RATE_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid rate_status: {body.rate_status}")
        updates.append("rate_status = CAST(:rate_status AS rate_status)")
        params["rate_status"] = body.rate_status

    # surcharges can be set to None to clear — use __fields_set__ (Pydantic v1)
    if "surcharges" in body.__fields_set__:
        updates.append("surcharges = :surcharges")
        params["surcharges"] = json.dumps(body.surcharges) if body.surcharges else None

    if not updates:
        return {"status": "OK", "msg": "No changes"}

    updates.append("updated_at = NOW()")
    conn.execute(text(f"UPDATE lcl_rates SET {', '.join(updates)} WHERE id = :id"), params)

    return {"status": "OK", "msg": "Rate updated"}


@router.post("/rates/{rate_id}/publish")
async def publish_lcl_rate(
    rate_id: int,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    """Transition a DRAFT rate to PUBLISHED. Admin only."""
    row = conn.execute(text(
        "SELECT id, rate_status::text FROM lcl_rates WHERE id = :id"
    ), {"id": rate_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"LCL rate {rate_id} not found")
    if row[1] != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Rate is not in DRAFT status (current: {row[1]})")

    conn.execute(text(
        "UPDATE lcl_rates SET rate_status = 'PUBLISHED'::rate_status, updated_at = NOW() WHERE id = :id"
    ), {"id": rate_id})

    return {"status": "OK", "msg": "Rate published"}


@router.post("/rates/{rate_id}/reject")
async def reject_lcl_rate(
    rate_id: int,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    """Transition a DRAFT rate to REJECTED. Admin only."""
    row = conn.execute(text(
        "SELECT id, rate_status::text FROM lcl_rates WHERE id = :id"
    ), {"id": rate_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"LCL rate {rate_id} not found")
    if row[1] != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Rate is not in DRAFT status (current: {row[1]})")

    conn.execute(text(
        "UPDATE lcl_rates SET rate_status = 'REJECTED'::rate_status, updated_at = NOW() WHERE id = :id"
    ), {"id": rate_id})

    return {"status": "OK", "msg": "Rate rejected"}


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
