"""
routers/pricing/haulage.py — Haulage rate card + rate endpoints.
"""

import json
import logging
from datetime import date, timedelta
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

class HaulageRateCardCreate(BaseModel):
    port_un_code: str
    terminal_id: Optional[str] = None
    area_id: int
    container_size: str  # '20' | '40' | '40HC' | 'wildcard'
    include_depot_gate_fee: bool = False
    side_loader_available: bool = False


class HaulageRateCardUpdate(BaseModel):
    include_depot_gate_fee: Optional[bool] = None
    side_loader_available: Optional[bool] = None
    is_active: Optional[bool] = None


class HaulageRateCreate(BaseModel):
    supplier_id: Optional[str] = None
    effective_from: date
    effective_to: Optional[date] = None
    rate_status: str = "PUBLISHED"
    currency: str
    uom: str = "CONTAINER"
    list_price: Optional[float] = None
    cost: Optional[float] = None
    min_list_price: Optional[float] = None
    min_cost: Optional[float] = None
    surcharges: Optional[list] = None
    side_loader_surcharge: Optional[float] = None
    roundup_qty: int = 0
    close_previous: bool = False


class HaulageRateUpdate(BaseModel):
    supplier_id: Optional[str] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    rate_status: Optional[str] = None
    currency: Optional[str] = None
    uom: Optional[str] = None
    list_price: Optional[float] = None
    cost: Optional[float] = None
    min_list_price: Optional[float] = None
    min_cost: Optional[float] = None
    surcharges: Optional[list] = None
    side_loader_surcharge: Optional[float] = None
    roundup_qty: Optional[int] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_VALID_CONTAINER_SIZES = ("20", "40", "40HC", "wildcard")

def _row_to_rate_card(r) -> dict:
    return {
        "id": r[0],
        "rate_card_key": r[1],
        "port_un_code": r[2],
        "area_id": r[3],
        "container_size": r[4],
        "include_depot_gate_fee": r[5],
        "side_loader_available": r[6],
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
        "min_list_price": float(r[9]) if r[9] is not None else None,
        "min_cost": float(r[10]) if r[10] is not None else None,
        "roundup_qty": r[11],
        "created_at": str(r[12]) if r[12] else None,
        "updated_at": str(r[13]) if r[13] else None,
        "effective_to": str(r[14]) if r[14] else None,
        "surcharges": r[15] if r[15] is not None else None,
        "side_loader_surcharge": float(r[16]) if r[16] is not None else None,
    }


def _surcharge_total(surcharges) -> float:
    if not surcharges:
        return 0.0
    return sum(float(s.get('amount', 0) or 0) for s in surcharges)


_RATE_SELECT = """
    SELECT id, rate_card_id, supplier_id, effective_from,
           rate_status::text, currency, uom,
           list_price, cost, min_list_price, min_cost,
           roundup_qty,
           created_at, updated_at, effective_to, surcharges,
           side_loader_surcharge
    FROM haulage_rates
"""

_VALID_RATE_STATUSES = {"PUBLISHED", "ON_REQUEST", "DRAFT", "REJECTED"}


# ---------------------------------------------------------------------------
# Haulage-specific reference data endpoints
# ---------------------------------------------------------------------------

@router.get("/areas")
async def list_haulage_areas(
    port_un_code: Optional[str] = Query(default=None),
    is_active: bool = Query(default=True),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    where = []
    params: dict = {}
    port_join = ""

    if is_active:
        where.append("a.is_active = true")

    if port_un_code:
        port_join = """
            JOIN (
                SELECT DISTINCT area_id
                FROM haulage_rate_cards
                WHERE port_un_code = :port AND is_active = true
            ) rc ON rc.area_id = a.area_id"""
        params["port"] = port_un_code

    where_clause = f"WHERE {' AND '.join(where)}" if where else ""

    rows = conn.execute(text(f"""
        SELECT a.area_id, a.area_code, a.area_name,
               s.state_code, s.name AS state_name
        FROM areas a
        {port_join}
        LEFT JOIN states s ON s.state_code = a.state_code
        {where_clause}
        ORDER BY a.area_name
    """), params).fetchall()

    return {"status": "OK", "data": [
        {
            "area_id": r[0], "area_code": r[1], "area_name": r[2],
            "state_code": r[3], "state_name": r[4],
        } for r in rows
    ]}


@router.get("/container-sizes")
async def list_container_sizes(
    claims: Claims = Depends(require_afu),
):
    return {"status": "OK", "data": [
        {"container_size": "20", "label": "20ft"},
        {"container_size": "40", "label": "40ft"},
        {"container_size": "40HC", "label": "40HC"},
        {"container_size": "wildcard", "label": "All Sizes"},
    ]}


# ---------------------------------------------------------------------------
# Rate Card endpoints
# ---------------------------------------------------------------------------

@router.get("/ports")
async def list_haulage_ports(
    country_code: Optional[str] = Query(default=None),
    is_active: bool = Query(default=True),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    where = ["rc.is_active = :active"]
    params: dict = {"active": is_active}
    joins = ""

    if country_code:
        joins = "JOIN ports AS p ON p.un_code = rc.port_un_code"
        where.append("p.country_code = :country")
        params["country"] = country_code

    rows = conn.execute(text(f"""
        SELECT DISTINCT rc.port_un_code
        FROM haulage_rate_cards rc
        {joins}
        WHERE {' AND '.join(where)}
        ORDER BY rc.port_un_code
    """), params).fetchall()

    return {"status": "OK", "data": [r[0] for r in rows]}


@router.get("/rate-cards")
async def list_haulage_rate_cards(
    port_un_code: Optional[str] = Query(default=None),
    terminal_id: Optional[str] = Query(default=None),
    area_id: Optional[int] = Query(default=None),
    container_size: Optional[str] = Query(default=None),
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
        joins = "JOIN ports AS p ON p.un_code = rc.port_un_code"
        where.append("p.country_code = :country")
        params["country"] = country_code

    if port_un_code and not alerts_only:
        where.append("rc.port_un_code = :port")
        params["port"] = port_un_code
    if terminal_id:
        where.append("rc.terminal_id = :terminal_id")
        params["terminal_id"] = terminal_id
    if area_id:
        where.append("rc.area_id = :area")
        params["area"] = area_id
    if container_size:
        where.append("rc.container_size = :csize")
        params["csize"] = container_size

    if alerts_only:
        where.append("""(
            (
                EXISTS (SELECT 1 FROM haulage_rates r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NOT NULL AND r.rate_status = 'PUBLISHED' AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE))
                AND (SELECT MIN(r2.cost) FROM haulage_rates r2 WHERE r2.rate_card_id = rc.id AND r2.supplier_id IS NOT NULL AND r2.rate_status = 'PUBLISHED' AND r2.effective_from <= CURRENT_DATE AND (r2.effective_to IS NULL OR r2.effective_to >= CURRENT_DATE) AND r2.cost IS NOT NULL)
                    > (SELECT r3.list_price FROM haulage_rates r3 WHERE r3.rate_card_id = rc.id AND r3.supplier_id IS NULL AND r3.rate_status = 'PUBLISHED' AND r3.effective_from <= CURRENT_DATE AND (r3.effective_to IS NULL OR r3.effective_to >= CURRENT_DATE) ORDER BY r3.effective_from DESC LIMIT 1)
            )
            OR
            (
                EXISTS (SELECT 1 FROM haulage_rates r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NOT NULL AND r.rate_status = 'PUBLISHED' AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE) AND r.cost IS NOT NULL)
                AND NOT EXISTS (SELECT 1 FROM haulage_rates r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NULL AND r.rate_status = 'PUBLISHED' AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE) AND r.list_price IS NOT NULL)
            )
            OR
            (
                (SELECT MAX(r.effective_from) FROM haulage_rates r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NOT NULL AND r.rate_status = 'PUBLISHED')
                > (SELECT MAX(r.effective_from) FROM haulage_rates r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NULL AND r.rate_status = 'PUBLISHED')
            )
            OR
            (
                EXISTS (SELECT 1 FROM haulage_rates r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NULL AND r.rate_status = 'PUBLISHED' AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE) AND r.list_price IS NOT NULL)
                AND NOT EXISTS (SELECT 1 FROM haulage_rates r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NOT NULL AND r.rate_status = 'PUBLISHED' AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE) AND r.cost IS NOT NULL)
            )
        )""")

    rows = conn.execute(text(f"""
        SELECT rc.id, rc.rate_card_key, rc.port_un_code, rc.area_id, rc.container_size,
               rc.include_depot_gate_fee, rc.side_loader_available, rc.is_active,
               rc.created_at, rc.updated_at,
               rc.terminal_id,
               a.area_name, a.area_code, s.name AS state_name,
               pt.name AS terminal_name
        FROM haulage_rate_cards rc
        LEFT JOIN areas a ON a.area_id = rc.area_id
        LEFT JOIN states s ON s.state_code = a.state_code
        LEFT JOIN port_terminals pt ON pt.terminal_id = rc.terminal_id
        {joins}
        WHERE {' AND '.join(where)}
        ORDER BY rc.port_un_code, a.area_name, rc.container_size
    """), params).fetchall()

    cards = []
    for r in rows:
        card = _row_to_rate_card(r)
        card["area_name"] = r[11]
        card["area_code"] = r[12]
        card["state_name"] = r[13]
        card["terminal_name"] = r[14]
        cards.append(card)

    if cards:
        card_ids = [c["id"] for c in cards]

        # Latest price reference
        price_rows = conn.execute(text("""
            SELECT DISTINCT ON (rate_card_id)
                   rate_card_id, list_price, currency, effective_from, surcharges
            FROM haulage_rates
            WHERE rate_card_id = ANY(:ids) AND supplier_id IS NULL
            ORDER BY rate_card_id, effective_from DESC
        """), {"ids": card_ids}).fetchall()

        price_map = {}
        for r in price_rows:
            lp = float(r[1]) if r[1] is not None else None
            sc = _surcharge_total(r[4])
            price_map[r[0]] = {
                "list_price": lp,
                "currency": r[2],
                "effective_from": str(r[3]) if r[3] else None,
                "list_surcharge_total": sc,
                "total_list_price": round(lp + sc, 4) if lp is not None else None,
            }

        for c in cards:
            c["latest_price_ref"] = price_map.get(c["id"])

        # Pending draft count
        draft_rows = conn.execute(text("""
            SELECT rate_card_id, COUNT(*) AS cnt
            FROM haulage_rates
            WHERE rate_card_id = ANY(:ids) AND rate_status = 'DRAFT'
            GROUP BY rate_card_id
        """), {"ids": card_ids}).fetchall()

        draft_map = {r[0]: r[1] for r in draft_rows}
        for c in cards:
            c["pending_draft_count"] = draft_map.get(c["id"], 0)

        # Build 12-month time series (9 past + current + 2 forward)
        today = date.today()
        months = [(today + relativedelta(months=i - 9)).replace(day=1) for i in range(12)]
        month_start = months[0]
        month_end = (months[-1] + relativedelta(months=1))

        ts_rows = conn.execute(text("""
            SELECT id, rate_card_id, supplier_id, effective_from,
                   rate_status::text, currency, list_price, cost,
                   effective_to, surcharges
            FROM haulage_rates
            WHERE rate_card_id = ANY(:ids)
              AND effective_from < :m_end
              AND (effective_to IS NULL OR effective_to >= :m_start)
              AND rate_status IN ('PUBLISHED', 'DRAFT')
        """), {"ids": card_ids, "m_start": month_start, "m_end": month_end}).fetchall()

        # Seed carry-forward
        seed_price_rows = conn.execute(text("""
            SELECT DISTINCT ON (rate_card_id)
                   rate_card_id, list_price, currency, rate_status::text, effective_to, surcharges
            FROM haulage_rates
            WHERE rate_card_id = ANY(:ids)
              AND supplier_id IS NULL
              AND effective_from < :m_start
              AND rate_status IN ('PUBLISHED', 'DRAFT')
            ORDER BY rate_card_id, effective_from DESC
        """), {"ids": card_ids, "m_start": month_start}).fetchall()

        seed_cost_rows = conn.execute(text("""
            SELECT DISTINCT ON (rate_card_id, supplier_id)
                   rate_card_id, supplier_id, cost, effective_to, surcharges
            FROM haulage_rates
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

        seed_supplier_costs: dict[int, dict[str, dict]] = {}
        for r in seed_cost_rows:
            card_id_s, supplier_id_s, cost_s, eff_to_s, surcharges_s = r
            if card_id_s not in seed_supplier_costs:
                seed_supplier_costs[card_id_s] = {}
            seed_supplier_costs[card_id_s][supplier_id_s] = {
                "cost": float(cost_s),
                "eff_to": eff_to_s,
                "surcharges": surcharges_s,
            }

        from collections import defaultdict
        price_ref_map: dict[tuple[int, str], dict] = {}
        cost_map: dict[tuple[int, str], list[tuple[float, list | None]]] = defaultdict(list)
        cost_map_by_supplier: dict[tuple[int, str], dict[str, tuple]] = defaultdict(dict)

        for r in ts_rows:
            rid, rc_id, supplier_id, eff_from, r_status, currency, lp, cost_val, eff_to, surcharges_json = r
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
                    cost_map_by_supplier[key][supplier_id] = (float(cost_val), eff_to, surcharges_json)

        current_month_key = f"{today.year}-{today.month:02d}"
        month_keys = [f"{m.year}-{m.month:02d}" for m in months]
        for c in cards:
            cid = c["id"]
            ts = []
            last_pr: dict | None = seed_price_map.get(cid)
            active_supplier_costs: dict[str, dict] = dict(seed_supplier_costs.get(cid, {}))
            for mk in month_keys:
                key = (cid, mk)
                pr = price_ref_map.get(key)
                cost_entries = cost_map.get(key)
                is_future = mk > current_month_key

                if pr is not None:
                    last_pr = pr

                month_start_d = date(int(mk[:4]), int(mk[5:7]), 1)

                supplier_updates = cost_map_by_supplier.get(key, {})
                for sup_id, (c_val, c_eff_to, c_surcharges) in supplier_updates.items():
                    active_supplier_costs[sup_id] = {
                        "cost": c_val,
                        "eff_to": c_eff_to,
                        "surcharges": c_surcharges,
                    }

                active_supplier_costs = {
                    sup_id: entry
                    for sup_id, entry in active_supplier_costs.items()
                    if entry["eff_to"] is None or entry["eff_to"] >= month_start_d
                }

                if active_supplier_costs:
                    best_sup = min(
                        active_supplier_costs.values(),
                        key=lambda e: e["cost"] + _surcharge_total(e["surcharges"])
                    )
                    last_cost = best_sup["cost"]
                    last_cost_surcharges = best_sup["surcharges"]
                else:
                    last_cost = None
                    last_cost_surcharges = None

                if last_pr is not None:
                    pr_eff_to = last_pr.get("_eff_to")
                    if pr_eff_to is not None and pr_eff_to < month_start_d:
                        last_pr = None

                if is_future:
                    effective_pr = pr if pr is not None else last_pr
                    if cost_entries:
                        best_cost_entry = min(cost_entries, key=lambda e: e[0] + _surcharge_total(e[1]))
                        effective_cost = best_cost_entry[0]
                        effective_cost_surcharges = best_cost_entry[1]
                    else:
                        effective_cost = last_cost
                        effective_cost_surcharges = last_cost_surcharges
                    pr_sc = _surcharge_total(effective_pr.get("_surcharges")) if effective_pr else 0.0
                    cost_sc = _surcharge_total(effective_cost_surcharges) if effective_cost is not None else 0.0
                    has_any = effective_pr is not None or effective_cost is not None
                    f_lp = effective_pr["list_price"] if effective_pr else None
                    ts.append({
                        "month_key": mk,
                        "list_price": f_lp,
                        "cost": effective_cost,
                        "currency": effective_pr["currency"] if effective_pr else None,
                        "rate_status": effective_pr["rate_status"] if effective_pr else None,
                        "list_surcharge_total": pr_sc,
                        "cost_surcharge_total": cost_sc,
                        "total_list_price": round(f_lp + pr_sc, 4) if f_lp is not None else None,
                        "total_cost": round(effective_cost + cost_sc, 4) if effective_cost is not None else None,
                        "surcharge_total": pr_sc,
                        "has_surcharges": (pr_sc > 0 or cost_sc > 0) and has_any,
                    })
                else:
                    pr_sc = _surcharge_total(last_pr.get("_surcharges")) if last_pr else 0.0
                    cost_sc = _surcharge_total(last_cost_surcharges) if last_cost is not None else 0.0
                    has_any = last_pr is not None or last_cost is not None
                    h_lp = last_pr["list_price"] if last_pr else None
                    ts.append({
                        "month_key": mk,
                        "list_price": h_lp,
                        "cost": last_cost,
                        "currency": last_pr["currency"] if last_pr else None,
                        "rate_status": last_pr["rate_status"] if last_pr else None,
                        "list_surcharge_total": pr_sc,
                        "cost_surcharge_total": cost_sc,
                        "total_list_price": round(h_lp + pr_sc, 4) if h_lp is not None else None,
                        "total_cost": round(last_cost + cost_sc, 4) if last_cost is not None else None,
                        "surcharge_total": pr_sc,
                        "has_surcharges": (pr_sc > 0 or cost_sc > 0) and has_any,
                    })
            c["time_series"] = ts

        # Latest effective_from per supplier type
        date_meta_rows = conn.execute(text("""
            SELECT
                rate_card_id,
                MAX(CASE WHEN supplier_id IS NULL THEN effective_from END) AS latest_list_price_from,
                MAX(CASE WHEN supplier_id IS NOT NULL AND rate_status = 'PUBLISHED' THEN effective_from END) AS latest_cost_from
            FROM haulage_rates
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
async def get_haulage_rate_card(
    card_id: int,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    row = conn.execute(text("""
        SELECT rc.id, rc.rate_card_key, rc.port_un_code, rc.area_id, rc.container_size,
               rc.include_depot_gate_fee, rc.side_loader_available, rc.is_active,
               rc.created_at, rc.updated_at,
               rc.terminal_id,
               a.area_name, a.area_code, s.name AS state_name,
               pt.name AS terminal_name
        FROM haulage_rate_cards rc
        LEFT JOIN areas a ON a.area_id = rc.area_id
        LEFT JOIN states s ON s.state_code = a.state_code
        LEFT JOIN port_terminals pt ON pt.terminal_id = rc.terminal_id
        WHERE rc.id = :id
    """), {"id": card_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Haulage rate card {card_id} not found")

    card = _row_to_rate_card(row)
    card["area_name"] = row[11]
    card["area_code"] = row[12]
    card["state_name"] = row[13]
    card["terminal_name"] = row[14]

    MIGRATION_FLOOR = date(2024, 1, 1)

    window_rows = conn.execute(text(f"""
        {_RATE_SELECT}
        WHERE rate_card_id = :id
          AND effective_from >= :floor
        ORDER BY supplier_id NULLS FIRST, effective_from DESC
    """), {"id": card_id, "floor": MIGRATION_FLOOR}).fetchall()

    seed_rows = conn.execute(text(f"""
        SELECT DISTINCT ON (supplier_id)
            id, rate_card_id, supplier_id, effective_from,
            rate_status::text, currency, uom,
            list_price, cost, min_list_price, min_cost,
            roundup_qty,
            created_at, updated_at, effective_to, surcharges,
            side_loader_surcharge
        FROM haulage_rates
        WHERE rate_card_id = :id
          AND effective_from < :floor
          AND rate_status IN ('PUBLISHED', 'DRAFT')
        ORDER BY supplier_id NULLS FIRST, effective_from DESC
    """), {"id": card_id, "floor": MIGRATION_FLOOR}).fetchall()

    rate_rows = list(window_rows) + list(seed_rows)

    rates_by_supplier: dict[str | None, list] = {}
    for rr in rate_rows:
        rate = _row_to_rate(rr)
        key = rate["supplier_id"]
        if key not in rates_by_supplier:
            rates_by_supplier[key] = []
        rates_by_supplier[key].append(rate)

    card["rates_by_supplier"] = rates_by_supplier

    date_meta = conn.execute(text("""
        SELECT
            MAX(CASE WHEN supplier_id IS NULL THEN effective_from END),
            MAX(CASE WHEN supplier_id IS NOT NULL AND rate_status = 'PUBLISHED' THEN effective_from END)
        FROM haulage_rates
        WHERE rate_card_id = :id
    """), {"id": card_id}).fetchone()
    card["latest_list_price_from"] = str(date_meta[0]) if date_meta and date_meta[0] else None
    card["latest_cost_from"] = str(date_meta[1]) if date_meta and date_meta[1] else None

    return {"status": "OK", "data": card}


@router.post("/rate-cards")
async def create_haulage_rate_card(
    body: HaulageRateCardCreate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    port = body.port_un_code.strip().upper()
    terminal = body.terminal_id.strip() if body.terminal_id else None

    if body.container_size not in _VALID_CONTAINER_SIZES:
        raise HTTPException(status_code=400, detail=f"Invalid container_size: {body.container_size}")

    # Validate area exists and get area_code for rate_card_key
    area = conn.execute(text("SELECT area_id, area_code FROM areas WHERE area_id = :id"),
                        {"id": body.area_id}).fetchone()
    if not area:
        raise HTTPException(status_code=400, detail=f"Area {body.area_id} not found")

    area_code = area[1]
    rate_card_key = (
        f"{port}:{terminal}:{area_code}:{body.container_size}"
        if terminal
        else f"{port}:{area_code}:{body.container_size}"
    )

    existing = conn.execute(text(
        "SELECT id FROM haulage_rate_cards WHERE rate_card_key = :key"
    ), {"key": rate_card_key}).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail=f"Rate card {rate_card_key} already exists")

    row = conn.execute(text("""
        INSERT INTO haulage_rate_cards
            (rate_card_key, port_un_code, terminal_id, area_id, container_size,
             include_depot_gate_fee, side_loader_available)
        VALUES (:key, :port, :terminal, :area, :csize, :depot, :side_loader)
        RETURNING id, created_at
    """), {
        "key": rate_card_key, "port": port, "terminal": terminal,
        "area": body.area_id, "csize": body.container_size,
        "depot": body.include_depot_gate_fee,
        "side_loader": body.side_loader_available,
    }).fetchone()

    return {"status": "OK", "data": {
        "id": row[0], "rate_card_key": rate_card_key,
        "port_un_code": port, "terminal_id": terminal,
        "area_id": body.area_id,
        "container_size": body.container_size,
        "include_depot_gate_fee": body.include_depot_gate_fee,
        "side_loader_available": body.side_loader_available,
        "is_active": True, "created_at": str(row[1]),
    }}


@router.patch("/rate-cards/{card_id}")
async def update_haulage_rate_card(
    card_id: int,
    body: HaulageRateCardUpdate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM haulage_rate_cards WHERE id = :id"),
                            {"id": card_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"Haulage rate card {card_id} not found")

    updates = []
    params: dict = {"id": card_id}

    if body.include_depot_gate_fee is not None:
        updates.append("include_depot_gate_fee = :depot")
        params["depot"] = body.include_depot_gate_fee
    if body.side_loader_available is not None:
        updates.append("side_loader_available = :side_loader")
        params["side_loader"] = body.side_loader_available
    if body.is_active is not None:
        updates.append("is_active = :active")
        params["active"] = body.is_active

    if not updates:
        return {"status": "OK", "msg": "No changes"}

    updates.append("updated_at = NOW()")
    conn.execute(text(f"UPDATE haulage_rate_cards SET {', '.join(updates)} WHERE id = :id"), params)

    return {"status": "OK", "msg": "Rate card updated"}


# ---------------------------------------------------------------------------
# Rate endpoints
# ---------------------------------------------------------------------------

@router.get("/rate-cards/{card_id}/rates")
async def list_haulage_rates(
    card_id: int,
    supplier_id: Optional[str] = Query(default=None),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    card = conn.execute(text("SELECT id FROM haulage_rate_cards WHERE id = :id"),
                        {"id": card_id}).fetchone()
    if not card:
        raise HTTPException(status_code=404, detail=f"Haulage rate card {card_id} not found")

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
async def create_haulage_rate(
    card_id: int,
    body: HaulageRateCreate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    card = conn.execute(text("SELECT id FROM haulage_rate_cards WHERE id = :id"),
                        {"id": card_id}).fetchone()
    if not card:
        raise HTTPException(status_code=404, detail=f"Haulage rate card {card_id} not found")

    if body.rate_status not in _VALID_RATE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid rate_status: {body.rate_status}")

    # close_previous: close the most recent open-ended row for same card+supplier
    if body.close_previous:
        conn.execute(text("""
            UPDATE haulage_rates
            SET effective_to = :close_date, updated_at = NOW()
            WHERE rate_card_id = :card_id
              AND supplier_id IS NOT DISTINCT FROM :supplier
              AND effective_to IS NULL
              AND effective_from < :eff_from
        """), {
            "close_date": body.effective_from - timedelta(days=1),
            "card_id": card_id,
            "supplier": body.supplier_id,
            "eff_from": body.effective_from,
        })

    row = conn.execute(text("""
        INSERT INTO haulage_rates
            (rate_card_id, supplier_id, effective_from, effective_to, rate_status,
             currency, uom, list_price, cost, min_list_price, min_cost,
             roundup_qty, surcharges, side_loader_surcharge)
        VALUES
            (:card_id, :supplier, :eff, :eff_to, CAST(:status AS rate_status),
             :currency, :uom, :list_price, :cost, :min_list_price, :min_cost,
             :roundup_qty, :surcharges, :side_loader_surcharge)
        RETURNING id, created_at
    """), {
        "card_id": card_id, "supplier": body.supplier_id,
        "eff": body.effective_from, "eff_to": body.effective_to, "status": body.rate_status,
        "currency": body.currency, "uom": body.uom,
        "list_price": body.list_price, "cost": body.cost,
        "min_list_price": body.min_list_price, "min_cost": body.min_cost,
        "roundup_qty": body.roundup_qty,
        "surcharges": json.dumps(body.surcharges) if body.surcharges else None,
        "side_loader_surcharge": body.side_loader_surcharge,
    }).fetchone()

    return {"status": "OK", "data": {
        "id": row[0], "rate_card_id": card_id,
        "created_at": str(row[1]),
    }}


@router.patch("/rates/{rate_id}")
async def update_haulage_rate(
    rate_id: int,
    body: HaulageRateUpdate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM haulage_rates WHERE id = :id"),
                            {"id": rate_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"Haulage rate {rate_id} not found")

    updates = []
    params: dict = {"id": rate_id}

    field_map = {
        "supplier_id": "supplier_id",
        "effective_from": "effective_from",
        "currency": "currency",
        "uom": "uom",
        "list_price": "list_price",
        "cost": "cost",
        "min_list_price": "min_list_price",
        "min_cost": "min_cost",
        "roundup_qty": "roundup_qty",
        "side_loader_surcharge": "side_loader_surcharge",
    }

    for field, col in field_map.items():
        val = getattr(body, field, None)
        if val is not None:
            updates.append(f"{col} = :{field}")
            params[field] = val

    if "effective_to" in body.__fields_set__:
        updates.append("effective_to = :effective_to")
        params["effective_to"] = body.effective_to

    if "effective_from" in body.__fields_set__ or "effective_to" in body.__fields_set__:
        chk_from = params.get("effective_from")
        chk_to = params.get("effective_to")
        if "effective_from" not in body.__fields_set__ or "effective_to" not in body.__fields_set__:
            row = conn.execute(text("SELECT effective_from, effective_to FROM haulage_rates WHERE id = :id"), {"id": rate_id}).fetchone()
            if row:
                if "effective_from" not in body.__fields_set__:
                    chk_from = str(row[0]) if row[0] else None
                if "effective_to" not in body.__fields_set__:
                    chk_to = str(row[1]) if row[1] else None
        if chk_from and chk_to and str(chk_to) < str(chk_from):
            raise HTTPException(status_code=400, detail="effective_to cannot be before effective_from")

    if body.rate_status is not None:
        if body.rate_status not in _VALID_RATE_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid rate_status: {body.rate_status}")
        updates.append("rate_status = CAST(:rate_status AS rate_status)")
        params["rate_status"] = body.rate_status

    if "surcharges" in body.__fields_set__:
        updates.append("surcharges = :surcharges")
        params["surcharges"] = json.dumps(body.surcharges) if body.surcharges else None

    if not updates:
        return {"status": "OK", "msg": "No changes"}

    updates.append("updated_at = NOW()")
    conn.execute(text(f"UPDATE haulage_rates SET {', '.join(updates)} WHERE id = :id"), params)

    return {"status": "OK", "msg": "Rate updated"}


@router.post("/rates/{rate_id}/publish")
async def publish_haulage_rate(
    rate_id: int,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    row = conn.execute(text(
        "SELECT id, rate_status::text FROM haulage_rates WHERE id = :id"
    ), {"id": rate_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Haulage rate {rate_id} not found")
    if row[1] != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Rate is not in DRAFT status (current: {row[1]})")

    conn.execute(text(
        "UPDATE haulage_rates SET rate_status = 'PUBLISHED'::rate_status, updated_at = NOW() WHERE id = :id"
    ), {"id": rate_id})

    return {"status": "OK", "msg": "Rate published"}


@router.post("/rates/{rate_id}/reject")
async def reject_haulage_rate(
    rate_id: int,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    row = conn.execute(text(
        "SELECT id, rate_status::text FROM haulage_rates WHERE id = :id"
    ), {"id": rate_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Haulage rate {rate_id} not found")
    if row[1] != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Rate is not in DRAFT status (current: {row[1]})")

    conn.execute(text(
        "UPDATE haulage_rates SET rate_status = 'REJECTED'::rate_status, updated_at = NOW() WHERE id = :id"
    ), {"id": rate_id})

    return {"status": "OK", "msg": "Rate rejected"}


@router.delete("/rates/{rate_id}")
async def delete_haulage_rate(
    rate_id: int,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM haulage_rates WHERE id = :id"),
                            {"id": rate_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"Haulage rate {rate_id} not found")

    conn.execute(text("DELETE FROM haulage_rates WHERE id = :id"), {"id": rate_id})

    return {"status": "OK", "msg": "Rate deleted"}


# ---------------------------------------------------------------------------
# Depot Gate Fee (DGF) endpoints
# ---------------------------------------------------------------------------

class DepotGateFeeCreate(BaseModel):
    port_un_code: str
    terminal_id: Optional[str] = None
    effective_from: date
    effective_to: Optional[date] = None
    rate_status: str = "PUBLISHED"
    currency: str
    fee_amount: float


class DepotGateFeeUpdate(BaseModel):
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    rate_status: Optional[str] = None
    currency: Optional[str] = None
    fee_amount: Optional[float] = None


def _row_to_dgf(r) -> dict:
    return {
        "id": r[0],
        "port_un_code": r[1],
        "terminal_id": r[2],
        "effective_from": str(r[3]) if r[3] else None,
        "effective_to": str(r[4]) if r[4] else None,
        "rate_status": r[5],
        "currency": r[6],
        "fee_amount": float(r[7]) if r[7] is not None else None,
        "created_at": str(r[8]) if r[8] else None,
        "updated_at": str(r[9]) if r[9] else None,
    }


@router.get("/depot-gate-fees")
async def list_depot_gate_fees(
    port_un_code: str = Query(...),
    terminal_id: Optional[str] = Query(default=None),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    where = ["port_un_code = :port"]
    params: dict = {"port": port_un_code}

    if terminal_id:
        where.append("(terminal_id = :terminal OR terminal_id IS NULL)")
        params["terminal"] = terminal_id

    rows = conn.execute(text(f"""
        SELECT id, port_un_code, terminal_id, effective_from, effective_to,
               rate_status::text, currency, fee_amount, created_at, updated_at
        FROM port_depot_gate_fees
        WHERE {' AND '.join(where)}
        ORDER BY terminal_id NULLS LAST, effective_from DESC
    """), params).fetchall()

    return {"status": "OK", "data": [_row_to_dgf(r) for r in rows]}


@router.get("/depot-gate-fees/active")
async def get_active_depot_gate_fee(
    port_un_code: str = Query(...),
    terminal_id: Optional[str] = Query(default=None),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    where = ["port_un_code = :port", "effective_from <= CURRENT_DATE",
             "(effective_to IS NULL OR effective_to >= CURRENT_DATE)",
             "rate_status = 'PUBLISHED'"]
    params: dict = {"port": port_un_code}

    if terminal_id:
        where.append("(terminal_id = :terminal OR terminal_id IS NULL)")
        params["terminal"] = terminal_id

    row = conn.execute(text(f"""
        SELECT id, port_un_code, terminal_id, effective_from, effective_to,
               rate_status::text, currency, fee_amount, created_at, updated_at
        FROM port_depot_gate_fees
        WHERE {' AND '.join(where)}
        ORDER BY terminal_id NULLS LAST, effective_from DESC
        LIMIT 1
    """), params).fetchone()

    return {"status": "OK", "data": _row_to_dgf(row) if row else None}


@router.post("/depot-gate-fees")
async def create_depot_gate_fee(
    body: DepotGateFeeCreate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    if body.rate_status not in _VALID_RATE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid rate_status: {body.rate_status}")

    existing = conn.execute(text("""
        SELECT id FROM port_depot_gate_fees
        WHERE port_un_code = :port
          AND terminal_id IS NOT DISTINCT FROM :terminal
          AND effective_from = :eff
    """), {"port": body.port_un_code, "terminal": body.terminal_id, "eff": body.effective_from}).fetchone()

    if existing:
        raise HTTPException(status_code=409, detail="Duplicate depot gate fee for this port/terminal/date")

    row = conn.execute(text("""
        INSERT INTO port_depot_gate_fees
            (port_un_code, terminal_id, effective_from, effective_to, rate_status, currency, fee_amount)
        VALUES (:port, :terminal, :eff, :eff_to, CAST(:status AS rate_status), :currency, :fee)
        RETURNING id, created_at
    """), {
        "port": body.port_un_code, "terminal": body.terminal_id,
        "eff": body.effective_from, "eff_to": body.effective_to,
        "status": body.rate_status, "currency": body.currency,
        "fee": body.fee_amount,
    }).fetchone()

    return {"status": "OK", "data": {"id": row[0], "created_at": str(row[1])}}


@router.patch("/depot-gate-fees/{fee_id}")
async def update_depot_gate_fee(
    fee_id: int,
    body: DepotGateFeeUpdate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM port_depot_gate_fees WHERE id = :id"),
                            {"id": fee_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"Depot gate fee {fee_id} not found")

    updates = []
    params: dict = {"id": fee_id}

    if body.effective_from is not None:
        updates.append("effective_from = :effective_from")
        params["effective_from"] = body.effective_from

    if "effective_to" in body.__fields_set__:
        updates.append("effective_to = :effective_to")
        params["effective_to"] = body.effective_to

    if body.currency is not None:
        updates.append("currency = :currency")
        params["currency"] = body.currency

    if body.fee_amount is not None:
        updates.append("fee_amount = :fee_amount")
        params["fee_amount"] = body.fee_amount

    if body.rate_status is not None:
        if body.rate_status not in _VALID_RATE_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid rate_status: {body.rate_status}")
        updates.append("rate_status = CAST(:rate_status AS rate_status)")
        params["rate_status"] = body.rate_status

    # Date validation
    if "effective_from" in body.__fields_set__ or "effective_to" in body.__fields_set__:
        chk_from = params.get("effective_from")
        chk_to = params.get("effective_to")
        if "effective_from" not in body.__fields_set__ or "effective_to" not in body.__fields_set__:
            row = conn.execute(text("SELECT effective_from, effective_to FROM port_depot_gate_fees WHERE id = :id"), {"id": fee_id}).fetchone()
            if row:
                if "effective_from" not in body.__fields_set__:
                    chk_from = str(row[0]) if row[0] else None
                if "effective_to" not in body.__fields_set__:
                    chk_to = str(row[1]) if row[1] else None
        if chk_from and chk_to and str(chk_to) < str(chk_from):
            raise HTTPException(status_code=400, detail="effective_to cannot be before effective_from")

    if not updates:
        return {"status": "OK", "msg": "No changes"}

    updates.append("updated_at = NOW()")
    conn.execute(text(f"UPDATE port_depot_gate_fees SET {', '.join(updates)} WHERE id = :id"), params)

    return {"status": "OK", "msg": "Depot gate fee updated"}


@router.delete("/depot-gate-fees/{fee_id}")
async def delete_depot_gate_fee(
    fee_id: int,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM port_depot_gate_fees WHERE id = :id"),
                            {"id": fee_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"Depot gate fee {fee_id} not found")

    conn.execute(text("DELETE FROM port_depot_gate_fees WHERE id = :id"), {"id": fee_id})

    return {"status": "OK", "msg": "Depot gate fee deleted"}


# ---------------------------------------------------------------------------
# Supplier Rebates
# ---------------------------------------------------------------------------

_VALID_REBATE_CONTAINER_SIZES = (
    "20", "40", "40HC",
    "side_loader_20", "side_loader_40", "side_loader_40HC",
)


class SupplierRebateCreate(BaseModel):
    supplier_id: str
    port_un_code: str
    container_size: str
    effective_from: date
    effective_to: Optional[date] = None
    rate_status: str = "PUBLISHED"
    rebate_percent: float


class SupplierRebateUpdate(BaseModel):
    effective_to: Optional[date] = None
    rate_status: Optional[str] = None
    rebate_percent: Optional[float] = None


def _row_to_rebate(r) -> dict:
    return {
        "id": r[0],
        "supplier_id": r[1],
        "port_un_code": r[2],
        "container_size": r[3],
        "effective_from": str(r[4]) if r[4] else None,
        "effective_to": str(r[5]) if r[5] else None,
        "rate_status": r[6],
        "rebate_percent": float(r[7]) if r[7] is not None else None,
        "created_at": str(r[8]) if r[8] else None,
        "updated_at": str(r[9]) if r[9] else None,
    }


_REBATE_SELECT = """
    SELECT id, supplier_id, port_un_code, container_size, effective_from, effective_to,
           rate_status::text, rebate_percent, created_at, updated_at
    FROM haulage_supplier_rebates
"""


@router.get("/supplier-rebates")
async def list_supplier_rebates(
    supplier_id: str = Query(...),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    rows = conn.execute(text(f"""
        {_REBATE_SELECT}
        WHERE supplier_id = :supplier
        ORDER BY container_size, effective_from DESC
    """), {"supplier": supplier_id}).fetchall()

    return {"status": "OK", "data": [_row_to_rebate(r) for r in rows]}


@router.post("/supplier-rebates")
async def create_supplier_rebate(
    body: SupplierRebateCreate,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    if body.container_size not in _VALID_REBATE_CONTAINER_SIZES:
        raise HTTPException(status_code=400, detail=f"Invalid container_size: {body.container_size}")

    if body.rate_status not in _VALID_RATE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid rate_status: {body.rate_status}")

    existing = conn.execute(text("""
        SELECT id FROM haulage_supplier_rebates
        WHERE supplier_id = :supplier AND port_un_code = :port AND container_size = :csize AND effective_from = :eff
    """), {"supplier": body.supplier_id, "port": body.port_un_code, "csize": body.container_size, "eff": body.effective_from}).fetchone()

    if existing:
        raise HTTPException(status_code=409, detail="A rebate already exists for this supplier, port, container size and effective date.")

    row = conn.execute(text("""
        INSERT INTO haulage_supplier_rebates
            (supplier_id, port_un_code, container_size, effective_from, effective_to, rate_status, rebate_percent)
        VALUES (:supplier, :port, :csize, :eff, :eff_to, CAST(:status AS rate_status), :rebate)
        RETURNING id, supplier_id, port_un_code, container_size, effective_from, effective_to,
                  rate_status::text, rebate_percent, created_at, updated_at
    """), {
        "supplier": body.supplier_id, "port": body.port_un_code, "csize": body.container_size,
        "eff": body.effective_from, "eff_to": body.effective_to,
        "status": body.rate_status, "rebate": body.rebate_percent,
    }).fetchone()

    return {"status": "OK", "data": _row_to_rebate(row)}


@router.patch("/supplier-rebates/{rebate_id}")
async def update_supplier_rebate(
    rebate_id: int,
    body: SupplierRebateUpdate,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM haulage_supplier_rebates WHERE id = :id"),
                            {"id": rebate_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"Supplier rebate {rebate_id} not found")

    updates = []
    params: dict = {"id": rebate_id}

    if "effective_to" in body.__fields_set__:
        updates.append("effective_to = :effective_to")
        params["effective_to"] = body.effective_to

    if body.rate_status is not None:
        if body.rate_status not in _VALID_RATE_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid rate_status: {body.rate_status}")
        updates.append("rate_status = CAST(:rate_status AS rate_status)")
        params["rate_status"] = body.rate_status

    if body.rebate_percent is not None:
        updates.append("rebate_percent = :rebate_percent")
        params["rebate_percent"] = body.rebate_percent

    if not updates:
        return {"status": "OK", "data": None, "msg": "No changes"}

    updates.append("updated_at = NOW()")
    conn.execute(text(f"UPDATE haulage_supplier_rebates SET {', '.join(updates)} WHERE id = :id"), params)

    row = conn.execute(text(f"""
        {_REBATE_SELECT}
        WHERE id = :id
    """), {"id": rebate_id}).fetchone()

    return {"status": "OK", "data": _row_to_rebate(row)}


@router.delete("/supplier-rebates/{rebate_id}")
async def delete_supplier_rebate(
    rebate_id: int,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM haulage_supplier_rebates WHERE id = :id"),
                            {"id": rebate_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"Supplier rebate {rebate_id} not found")

    conn.execute(text("DELETE FROM haulage_supplier_rebates WHERE id = :id"), {"id": rebate_id})

    return {"status": "OK", "data": {"deleted": True}}


# ---------------------------------------------------------------------------
# FAF Rates
# ---------------------------------------------------------------------------

class FafRateCreate(BaseModel):
    supplier_id: str
    effective_from: date
    effective_to: Optional[date] = None
    rate_status: str = "DRAFT"
    port_rates: list = []


class FafRateUpdate(BaseModel):
    effective_to: Optional[date] = None
    rate_status: Optional[str] = None
    port_rates: Optional[list] = None


def _row_to_faf_rate(r) -> dict:
    port_rates_raw = r[5]
    if isinstance(port_rates_raw, str):
        port_rates_raw = json.loads(port_rates_raw)
    return {
        "id": r[0],
        "supplier_id": r[1],
        "effective_from": str(r[2]) if r[2] else None,
        "effective_to": str(r[3]) if r[3] else None,
        "rate_status": r[4],
        "port_rates": port_rates_raw if port_rates_raw else [],
        "created_at": str(r[6]) if r[6] else None,
        "updated_at": str(r[7]) if r[7] else None,
    }


_FAF_SELECT = """
    SELECT id, supplier_id, effective_from, effective_to,
           rate_status::text, port_rates, created_at, updated_at
    FROM haulage_faf_rates
"""


@router.get("/faf-rates")
async def list_faf_rates(
    supplier_id: str = Query(...),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    rows = conn.execute(text(f"""
        {_FAF_SELECT}
        WHERE supplier_id = :supplier
        ORDER BY effective_from DESC
    """), {"supplier": supplier_id}).fetchall()

    return {"status": "OK", "data": [_row_to_faf_rate(r) for r in rows]}


@router.post("/faf-rates")
async def create_faf_rate(
    body: FafRateCreate,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    if body.rate_status not in _VALID_RATE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid rate_status: {body.rate_status}")

    existing = conn.execute(text("""
        SELECT id FROM haulage_faf_rates
        WHERE supplier_id = :supplier AND effective_from = :eff
    """), {"supplier": body.supplier_id, "eff": body.effective_from}).fetchone()

    if existing:
        raise HTTPException(status_code=409, detail="A FAF rate already exists for this supplier and effective date.")

    row = conn.execute(text("""
        INSERT INTO haulage_faf_rates
            (supplier_id, effective_from, effective_to, rate_status, port_rates)
        VALUES (:supplier, :eff, :eff_to, CAST(:status AS rate_status), :port_rates)
        RETURNING id, supplier_id, effective_from, effective_to,
                  rate_status::text, port_rates, created_at, updated_at
    """), {
        "supplier": body.supplier_id,
        "eff": body.effective_from, "eff_to": body.effective_to,
        "status": body.rate_status,
        "port_rates": json.dumps(body.port_rates),
    }).fetchone()

    return {"status": "OK", "data": _row_to_faf_rate(row)}


@router.patch("/faf-rates/{faf_id}")
async def update_faf_rate(
    faf_id: int,
    body: FafRateUpdate,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM haulage_faf_rates WHERE id = :id"),
                            {"id": faf_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"FAF rate {faf_id} not found")

    updates = []
    params: dict = {"id": faf_id}

    if "effective_to" in body.__fields_set__:
        updates.append("effective_to = :effective_to")
        params["effective_to"] = body.effective_to

    if body.rate_status is not None:
        if body.rate_status not in _VALID_RATE_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid rate_status: {body.rate_status}")
        updates.append("rate_status = CAST(:rate_status AS rate_status)")
        params["rate_status"] = body.rate_status

    if body.port_rates is not None:
        updates.append("port_rates = :port_rates")
        params["port_rates"] = json.dumps(body.port_rates)

    if not updates:
        return {"status": "OK", "data": None, "msg": "No changes"}

    updates.append("updated_at = NOW()")
    conn.execute(text(f"UPDATE haulage_faf_rates SET {', '.join(updates)} WHERE id = :id"), params)

    row = conn.execute(text(f"""
        {_FAF_SELECT}
        WHERE id = :id
    """), {"id": faf_id}).fetchone()

    return {"status": "OK", "data": _row_to_faf_rate(row)}


@router.delete("/faf-rates/{faf_id}")
async def delete_faf_rate(
    faf_id: int,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM haulage_faf_rates WHERE id = :id"),
                            {"id": faf_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"FAF rate {faf_id} not found")

    conn.execute(text("DELETE FROM haulage_faf_rates WHERE id = :id"), {"id": faf_id})

    return {"status": "OK", "data": {"deleted": True}}
