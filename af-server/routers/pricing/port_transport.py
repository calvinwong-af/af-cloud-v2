"""
routers/pricing/port_transport.py — Port Transport rate card + rate endpoints.
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

class PortTransportRateCardCreate(BaseModel):
    port_un_code: str
    terminal_id: Optional[str] = None
    area_id: int
    vehicle_type_id: str
    include_depot_gate_fee: bool = False


class PortTransportRateCardUpdate(BaseModel):
    include_depot_gate_fee: Optional[bool] = None
    is_active: Optional[bool] = None


class PortTransportRateCreate(BaseModel):
    supplier_id: Optional[str] = None
    effective_from: date
    effective_to: Optional[date] = None
    rate_status: str = "PUBLISHED"
    currency: str
    uom: str = "SET"
    list_price: Optional[float] = None
    cost: Optional[float] = None
    min_list_price: Optional[float] = None
    min_cost: Optional[float] = None
    surcharges: Optional[list] = None
    roundup_qty: int = 0
    close_previous: bool = False


class PortTransportRateUpdate(BaseModel):
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
    roundup_qty: Optional[int] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row_to_rate_card(r) -> dict:
    return {
        "id": r[0],
        "rate_card_key": r[1],
        "port_un_code": r[2],
        "area_id": r[3],
        "vehicle_type_id": r[4],
        "include_depot_gate_fee": r[5],
        "is_active": r[6],
        "created_at": str(r[7]) if r[7] else None,
        "updated_at": str(r[8]) if r[8] else None,
        "terminal_id": r[9],
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
           created_at, updated_at, effective_to, surcharges
    FROM port_transport_rates
"""

_VALID_RATE_STATUSES = {"PUBLISHED", "ON_REQUEST", "DRAFT", "REJECTED"}


# ---------------------------------------------------------------------------
# Transport-specific reference data endpoints
# ---------------------------------------------------------------------------

@router.get("/areas")
async def list_transport_areas(
    port_un_code: Optional[str] = Query(default=None),
    is_active: bool = Query(default=True),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    where = []
    params: dict = {}

    if is_active:
        where.append("a.is_active = true")

    if port_un_code:
        where.append("a.port_un_code = :port")
        params["port"] = port_un_code

    where_clause = f"WHERE {' AND '.join(where)}" if where else ""

    rows = conn.execute(text(f"""
        SELECT a.area_id, a.area_code, a.area_name, a.port_un_code,
               s.state_code, s.name AS state_name
        FROM areas a
        LEFT JOIN states s ON s.state_code = a.state_code
        {where_clause}
        ORDER BY a.area_name
    """), params).fetchall()

    return {"status": "OK", "data": [
        {
            "area_id": r[0], "area_code": r[1], "area_name": r[2],
            "port_un_code": r[3], "state_code": r[4], "state_name": r[5],
        } for r in rows
    ]}


@router.get("/vehicle-types")
async def list_vehicle_types(
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    rows = conn.execute(text("""
        SELECT vehicle_type_id, label, category, sort_order
        FROM vehicle_types
        WHERE is_active = true
        ORDER BY sort_order, vehicle_type_id
    """)).fetchall()

    return {"status": "OK", "data": [
        {
            "vehicle_type_id": r[0], "label": r[1],
            "category": r[2], "sort_order": r[3],
        } for r in rows
    ]}


# ---------------------------------------------------------------------------
# Rate Card endpoints
# ---------------------------------------------------------------------------

@router.get("/ports")
async def list_transport_ports(
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
        FROM port_transport_rate_cards rc
        {joins}
        WHERE {' AND '.join(where)}
        ORDER BY rc.port_un_code
    """), params).fetchall()

    return {"status": "OK", "data": [r[0] for r in rows]}


@router.get("/rate-cards")
async def list_port_transport_rate_cards(
    port_un_code: Optional[str] = Query(default=None),
    terminal_id: Optional[str] = Query(default=None),
    area_id: Optional[int] = Query(default=None),
    vehicle_type_id: Optional[str] = Query(default=None),
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
    if vehicle_type_id:
        where.append("rc.vehicle_type_id = :vtype")
        params["vtype"] = vehicle_type_id

    if alerts_only:
        where.append("""(
            (
                EXISTS (SELECT 1 FROM port_transport_rates r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NOT NULL AND r.rate_status = 'PUBLISHED' AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE))
                AND (SELECT MIN(r2.cost) FROM port_transport_rates r2 WHERE r2.rate_card_id = rc.id AND r2.supplier_id IS NOT NULL AND r2.rate_status = 'PUBLISHED' AND r2.effective_from <= CURRENT_DATE AND (r2.effective_to IS NULL OR r2.effective_to >= CURRENT_DATE) AND r2.cost IS NOT NULL)
                    > (SELECT r3.list_price FROM port_transport_rates r3 WHERE r3.rate_card_id = rc.id AND r3.supplier_id IS NULL AND r3.rate_status = 'PUBLISHED' AND r3.effective_from <= CURRENT_DATE AND (r3.effective_to IS NULL OR r3.effective_to >= CURRENT_DATE) ORDER BY r3.effective_from DESC LIMIT 1)
            )
            OR
            (
                EXISTS (SELECT 1 FROM port_transport_rates r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NOT NULL AND r.rate_status = 'PUBLISHED' AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE) AND r.cost IS NOT NULL)
                AND NOT EXISTS (SELECT 1 FROM port_transport_rates r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NULL AND r.rate_status = 'PUBLISHED' AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE) AND r.list_price IS NOT NULL)
            )
            OR
            (
                (SELECT MAX(r.effective_from) FROM port_transport_rates r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NOT NULL AND r.rate_status = 'PUBLISHED')
                > (SELECT MAX(r.effective_from) FROM port_transport_rates r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NULL AND r.rate_status = 'PUBLISHED')
            )
            OR
            (
                EXISTS (SELECT 1 FROM port_transport_rates r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NULL AND r.rate_status = 'PUBLISHED' AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE) AND r.list_price IS NOT NULL)
                AND NOT EXISTS (SELECT 1 FROM port_transport_rates r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NOT NULL AND r.rate_status = 'PUBLISHED' AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE) AND r.cost IS NOT NULL)
            )
        )""")

    rows = conn.execute(text(f"""
        SELECT rc.id, rc.rate_card_key, rc.port_un_code, rc.area_id, rc.vehicle_type_id,
               rc.include_depot_gate_fee, rc.is_active, rc.created_at, rc.updated_at,
               rc.terminal_id,
               a.area_name, a.area_code, vt.label AS vehicle_type_label,
               s.name AS state_name,
               pt.name AS terminal_name
        FROM port_transport_rate_cards rc
        LEFT JOIN areas a ON a.area_id = rc.area_id
        LEFT JOIN vehicle_types vt ON vt.vehicle_type_id = rc.vehicle_type_id
        LEFT JOIN states s ON s.state_code = a.state_code
        LEFT JOIN port_terminals pt ON pt.terminal_id = rc.terminal_id
        {joins}
        WHERE {' AND '.join(where)}
        ORDER BY rc.port_un_code, a.area_name, vt.sort_order
    """), params).fetchall()

    cards = []
    for r in rows:
        card = _row_to_rate_card(r)
        card["area_name"] = r[10]
        card["area_code"] = r[11]
        card["vehicle_type_label"] = r[12]
        card["state_name"] = r[13]
        card["terminal_name"] = r[14]
        cards.append(card)

    if cards:
        card_ids = [c["id"] for c in cards]

        # Latest price reference
        price_rows = conn.execute(text("""
            SELECT DISTINCT ON (rate_card_id)
                   rate_card_id, list_price, currency, effective_from
            FROM port_transport_rates
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

        # Pending draft count
        draft_rows = conn.execute(text("""
            SELECT rate_card_id, COUNT(*) AS cnt
            FROM port_transport_rates
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
            FROM port_transport_rates
            WHERE rate_card_id = ANY(:ids)
              AND effective_from < :m_end
              AND (effective_to IS NULL OR effective_to >= :m_start)
              AND rate_status IN ('PUBLISHED', 'DRAFT')
        """), {"ids": card_ids, "m_start": month_start, "m_end": month_end}).fetchall()

        # Seed carry-forward
        seed_price_rows = conn.execute(text("""
            SELECT DISTINCT ON (rate_card_id)
                   rate_card_id, list_price, currency, rate_status::text, effective_to, surcharges
            FROM port_transport_rates
            WHERE rate_card_id = ANY(:ids)
              AND supplier_id IS NULL
              AND effective_from < :m_start
              AND rate_status IN ('PUBLISHED', 'DRAFT')
            ORDER BY rate_card_id, effective_from DESC
        """), {"ids": card_ids, "m_start": month_start}).fetchall()

        seed_cost_rows = conn.execute(text("""
            SELECT DISTINCT ON (rate_card_id, supplier_id)
                   rate_card_id, supplier_id, cost, effective_to, surcharges
            FROM port_transport_rates
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

                # Both future and past/current months use last_pr / last_cost (carry-forward).
                # For future months, an exact-match rate starting this month takes precedence,
                # but open-ended rates from prior months must still carry forward.
                if is_future:
                    # Use exact-match pr if available, otherwise fall back to carried last_pr
                    effective_pr = pr if pr is not None else last_pr
                    # Use exact-match cost_entries if available, otherwise fall back to last_cost
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
                    ts.append({
                        "month_key": mk,
                        "list_price": effective_pr["list_price"] if effective_pr else None,
                        "cost": effective_cost,
                        "currency": effective_pr["currency"] if effective_pr else None,
                        "rate_status": effective_pr["rate_status"] if effective_pr else None,
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
                        "currency": last_pr["currency"] if last_pr else None,
                        "rate_status": last_pr["rate_status"] if last_pr else None,
                        "list_surcharge_total": pr_sc,
                        "cost_surcharge_total": cost_sc,
                        "surcharge_total": pr_sc,
                        "has_surcharges": (pr_sc > 0 or cost_sc > 0) and has_any,
                    })
            c["time_series"] = ts

        # Latest effective_from per supplier type for alert scenario 3
        date_meta_rows = conn.execute(text("""
            SELECT
                rate_card_id,
                MAX(CASE WHEN supplier_id IS NULL THEN effective_from END) AS latest_list_price_from,
                MAX(CASE WHEN supplier_id IS NOT NULL AND rate_status = 'PUBLISHED' THEN effective_from END) AS latest_cost_from
            FROM port_transport_rates
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
async def get_transport_rate_card(
    card_id: int,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    row = conn.execute(text("""
        SELECT rc.id, rc.rate_card_key, rc.port_un_code, rc.area_id, rc.vehicle_type_id,
               rc.include_depot_gate_fee, rc.is_active, rc.created_at, rc.updated_at,
               rc.terminal_id,
               a.area_name, a.area_code, vt.label AS vehicle_type_label,
               s.name AS state_name,
               pt.name AS terminal_name
        FROM port_transport_rate_cards rc
        LEFT JOIN areas a ON a.area_id = rc.area_id
        LEFT JOIN vehicle_types vt ON vt.vehicle_type_id = rc.vehicle_type_id
        LEFT JOIN states s ON s.state_code = a.state_code
        LEFT JOIN port_terminals pt ON pt.terminal_id = rc.terminal_id
        WHERE rc.id = :id
    """), {"id": card_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Transport rate card {card_id} not found")

    card = _row_to_rate_card(row)
    card["area_name"] = row[10]
    card["area_code"] = row[11]
    card["vehicle_type_label"] = row[12]
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
            created_at, updated_at, effective_to, surcharges
        FROM port_transport_rates
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
        FROM port_transport_rates
        WHERE rate_card_id = :id
    """), {"id": card_id}).fetchone()
    card["latest_list_price_from"] = str(date_meta[0]) if date_meta and date_meta[0] else None
    card["latest_cost_from"] = str(date_meta[1]) if date_meta and date_meta[1] else None

    return {"status": "OK", "data": card}


@router.post("/rate-cards")
async def create_transport_rate_card(
    body: PortTransportRateCardCreate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    port = body.port_un_code.strip().upper()
    terminal = body.terminal_id.strip() if body.terminal_id else None
    rate_card_key = (
        f"{port}:{terminal}:{body.area_id}:{body.vehicle_type_id}"
        if terminal
        else f"{port}:{body.area_id}:{body.vehicle_type_id}"
    )

    existing = conn.execute(text(
        "SELECT id FROM port_transport_rate_cards WHERE rate_card_key = :key"
    ), {"key": rate_card_key}).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail=f"Rate card {rate_card_key} already exists")

    # Validate area exists
    area = conn.execute(text("SELECT area_id FROM areas WHERE area_id = :id"), {"id": body.area_id}).fetchone()
    if not area:
        raise HTTPException(status_code=400, detail=f"Area {body.area_id} not found")

    # Validate vehicle type exists
    vtype = conn.execute(text("SELECT vehicle_type_id FROM vehicle_types WHERE vehicle_type_id = :id"),
                         {"id": body.vehicle_type_id}).fetchone()
    if not vtype:
        raise HTTPException(status_code=400, detail=f"Vehicle type {body.vehicle_type_id} not found")

    row = conn.execute(text("""
        INSERT INTO port_transport_rate_cards
            (rate_card_key, port_un_code, terminal_id, area_id, vehicle_type_id, include_depot_gate_fee)
        VALUES (:key, :port, :terminal, :area, :vtype, :depot)
        RETURNING id, created_at
    """), {
        "key": rate_card_key, "port": port, "terminal": terminal,
        "area": body.area_id, "vtype": body.vehicle_type_id,
        "depot": body.include_depot_gate_fee,
    }).fetchone()

    return {"status": "OK", "data": {
        "id": row[0], "rate_card_key": rate_card_key,
        "port_un_code": port, "terminal_id": terminal,
        "area_id": body.area_id,
        "vehicle_type_id": body.vehicle_type_id,
        "include_depot_gate_fee": body.include_depot_gate_fee,
        "is_active": True, "created_at": str(row[1]),
    }}


@router.patch("/rate-cards/{card_id}")
async def update_transport_rate_card(
    card_id: int,
    body: PortTransportRateCardUpdate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM port_transport_rate_cards WHERE id = :id"),
                            {"id": card_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"Transport rate card {card_id} not found")

    updates = []
    params: dict = {"id": card_id}

    if body.include_depot_gate_fee is not None:
        updates.append("include_depot_gate_fee = :depot")
        params["depot"] = body.include_depot_gate_fee
    if body.is_active is not None:
        updates.append("is_active = :active")
        params["active"] = body.is_active

    if not updates:
        return {"status": "OK", "msg": "No changes"}

    updates.append("updated_at = NOW()")
    conn.execute(text(f"UPDATE port_transport_rate_cards SET {', '.join(updates)} WHERE id = :id"), params)

    return {"status": "OK", "msg": "Rate card updated"}


# ---------------------------------------------------------------------------
# Rate endpoints
# ---------------------------------------------------------------------------

@router.get("/rate-cards/{card_id}/rates")
async def list_port_transport_rates(
    card_id: int,
    supplier_id: Optional[str] = Query(default=None),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    card = conn.execute(text("SELECT id FROM port_transport_rate_cards WHERE id = :id"),
                        {"id": card_id}).fetchone()
    if not card:
        raise HTTPException(status_code=404, detail=f"Transport rate card {card_id} not found")

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
async def create_transport_rate(
    card_id: int,
    body: PortTransportRateCreate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    card = conn.execute(text("SELECT id FROM port_transport_rate_cards WHERE id = :id"),
                        {"id": card_id}).fetchone()
    if not card:
        raise HTTPException(status_code=404, detail=f"Transport rate card {card_id} not found")

    if body.rate_status not in _VALID_RATE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid rate_status: {body.rate_status}")

    # close_previous: close the most recent open-ended row for same card+supplier
    if body.close_previous:
        conn.execute(text("""
            UPDATE port_transport_rates
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
        INSERT INTO port_transport_rates
            (rate_card_id, supplier_id, effective_from, effective_to, rate_status,
             currency, uom, list_price, cost, min_list_price, min_cost,
             roundup_qty, surcharges)
        VALUES
            (:card_id, :supplier, :eff, :eff_to, CAST(:status AS rate_status),
             :currency, :uom, :list_price, :cost, :min_list_price, :min_cost,
             :roundup_qty, :surcharges)
        RETURNING id, created_at
    """), {
        "card_id": card_id, "supplier": body.supplier_id,
        "eff": body.effective_from, "eff_to": body.effective_to, "status": body.rate_status,
        "currency": body.currency, "uom": body.uom,
        "list_price": body.list_price, "cost": body.cost,
        "min_list_price": body.min_list_price, "min_cost": body.min_cost,
        "roundup_qty": body.roundup_qty,
        "surcharges": json.dumps(body.surcharges) if body.surcharges else None,
    }).fetchone()

    return {"status": "OK", "data": {
        "id": row[0], "rate_card_id": card_id,
        "created_at": str(row[1]),
    }}


@router.patch("/rates/{rate_id}")
async def update_transport_rate(
    rate_id: int,
    body: PortTransportRateUpdate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM port_transport_rates WHERE id = :id"),
                            {"id": rate_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"Transport rate {rate_id} not found")

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
            row = conn.execute(text("SELECT effective_from, effective_to FROM port_transport_rates WHERE id = :id"), {"id": rate_id}).fetchone()
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
    conn.execute(text(f"UPDATE port_transport_rates SET {', '.join(updates)} WHERE id = :id"), params)

    return {"status": "OK", "msg": "Rate updated"}


@router.post("/rates/{rate_id}/publish")
async def publish_transport_rate(
    rate_id: int,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    row = conn.execute(text(
        "SELECT id, rate_status::text FROM port_transport_rates WHERE id = :id"
    ), {"id": rate_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Transport rate {rate_id} not found")
    if row[1] != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Rate is not in DRAFT status (current: {row[1]})")

    conn.execute(text(
        "UPDATE port_transport_rates SET rate_status = 'PUBLISHED'::rate_status, updated_at = NOW() WHERE id = :id"
    ), {"id": rate_id})

    return {"status": "OK", "msg": "Rate published"}


@router.post("/rates/{rate_id}/reject")
async def reject_transport_rate(
    rate_id: int,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    row = conn.execute(text(
        "SELECT id, rate_status::text FROM port_transport_rates WHERE id = :id"
    ), {"id": rate_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Transport rate {rate_id} not found")
    if row[1] != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Rate is not in DRAFT status (current: {row[1]})")

    conn.execute(text(
        "UPDATE port_transport_rates SET rate_status = 'REJECTED'::rate_status, updated_at = NOW() WHERE id = :id"
    ), {"id": rate_id})

    return {"status": "OK", "msg": "Rate rejected"}


@router.delete("/rates/{rate_id}")
async def delete_transport_rate(
    rate_id: int,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM port_transport_rates WHERE id = :id"),
                            {"id": rate_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"Transport rate {rate_id} not found")

    conn.execute(text("DELETE FROM port_transport_rates WHERE id = :id"), {"id": rate_id})

    return {"status": "OK", "msg": "Rate deleted"}
