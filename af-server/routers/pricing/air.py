"""
routers/pricing/air.py — Air freight rate card + rate endpoints.
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

class AirRateCardCreate(BaseModel):
    origin_port_code: str
    destination_port_code: str
    dg_class_code: str = "NON-DG"
    airline_code: str
    code: str = "FR-AIR"
    description: str = ""
    currency: str = "MYR"


class AirRateCardUpdate(BaseModel):
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    currency: Optional[str] = None


class AirRateCreate(BaseModel):
    supplier_id: Optional[str] = None
    effective_from: date
    effective_to: Optional[date] = None
    rate_status: str = "PUBLISHED"
    l45_list_price: Optional[float] = None
    p45_list_price: Optional[float] = None
    p100_list_price: Optional[float] = None
    p250_list_price: Optional[float] = None
    p300_list_price: Optional[float] = None
    p500_list_price: Optional[float] = None
    p1000_list_price: Optional[float] = None
    min_list_price: Optional[float] = None
    l45_cost: Optional[float] = None
    p45_cost: Optional[float] = None
    p100_cost: Optional[float] = None
    p250_cost: Optional[float] = None
    p300_cost: Optional[float] = None
    p500_cost: Optional[float] = None
    p1000_cost: Optional[float] = None
    min_cost: Optional[float] = None
    surcharges: Optional[list] = None


class AirRateUpdate(BaseModel):
    supplier_id: Optional[str] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    rate_status: Optional[str] = None
    l45_list_price: Optional[float] = None
    p45_list_price: Optional[float] = None
    p100_list_price: Optional[float] = None
    p250_list_price: Optional[float] = None
    p300_list_price: Optional[float] = None
    p500_list_price: Optional[float] = None
    p1000_list_price: Optional[float] = None
    min_list_price: Optional[float] = None
    l45_cost: Optional[float] = None
    p45_cost: Optional[float] = None
    p100_cost: Optional[float] = None
    p250_cost: Optional[float] = None
    p300_cost: Optional[float] = None
    p500_cost: Optional[float] = None
    p1000_cost: Optional[float] = None
    min_cost: Optional[float] = None
    surcharges: Optional[list] = None


class AirResolveRequest(BaseModel):
    chargeable_weight: float
    supplier_id: Optional[str] = None
    reference_date: Optional[str] = None


class AirListPriceCardCreate(BaseModel):
    origin_port_code: str
    destination_port_code: str
    dg_class_code: str = "NON-DG"
    code: str = "FR-AIR"
    description: str = ""
    currency: str = "MYR"


class AirListPriceCardUpdate(BaseModel):
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    currency: Optional[str] = None


class AirListPriceRateCreate(BaseModel):
    effective_from: date
    effective_to: Optional[date] = None
    rate_status: str = "PUBLISHED"
    l45_list_price: Optional[float] = None
    p45_list_price: Optional[float] = None
    p100_list_price: Optional[float] = None
    p250_list_price: Optional[float] = None
    p300_list_price: Optional[float] = None
    p500_list_price: Optional[float] = None
    p1000_list_price: Optional[float] = None
    min_list_price: Optional[float] = None
    surcharges: Optional[list] = None


class AirListPriceRateUpdate(BaseModel):
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    rate_status: Optional[str] = None
    l45_list_price: Optional[float] = None
    p45_list_price: Optional[float] = None
    p100_list_price: Optional[float] = None
    p250_list_price: Optional[float] = None
    p300_list_price: Optional[float] = None
    p500_list_price: Optional[float] = None
    p1000_list_price: Optional[float] = None
    min_list_price: Optional[float] = None
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
        "airline_code": r[5],
        "code": r[6],
        "description": r[7],
        "is_active": r[8],
        "created_at": str(r[9]) if r[9] else None,
        "updated_at": str(r[10]) if r[10] else None,
        "currency": r[11],
    }


_RATE_SELECT = """
    SELECT id, rate_card_id, supplier_id, effective_from,
           rate_status::text,
           l45_list_price, p45_list_price, p100_list_price, p250_list_price,
           p300_list_price, p500_list_price, p1000_list_price, min_list_price,
           l45_cost, p45_cost, p100_cost, p250_cost,
           p300_cost, p500_cost, p1000_cost, min_cost,
           surcharges,
           created_at, updated_at, effective_to
    FROM air_freight_rates
"""


def _row_to_rate(r) -> dict:
    return {
        "id": r[0],
        "rate_card_id": r[1],
        "supplier_id": r[2],
        "effective_from": str(r[3]) if r[3] else None,
        "rate_status": r[4],
        "l45_list_price": float(r[5]) if r[5] is not None else None,
        "p45_list_price": float(r[6]) if r[6] is not None else None,
        "p100_list_price": float(r[7]) if r[7] is not None else None,
        "p250_list_price": float(r[8]) if r[8] is not None else None,
        "p300_list_price": float(r[9]) if r[9] is not None else None,
        "p500_list_price": float(r[10]) if r[10] is not None else None,
        "p1000_list_price": float(r[11]) if r[11] is not None else None,
        "min_list_price": float(r[12]) if r[12] is not None else None,
        "l45_cost": float(r[13]) if r[13] is not None else None,
        "p45_cost": float(r[14]) if r[14] is not None else None,
        "p100_cost": float(r[15]) if r[15] is not None else None,
        "p250_cost": float(r[16]) if r[16] is not None else None,
        "p300_cost": float(r[17]) if r[17] is not None else None,
        "p500_cost": float(r[18]) if r[18] is not None else None,
        "p1000_cost": float(r[19]) if r[19] is not None else None,
        "min_cost": float(r[20]) if r[20] is not None else None,
        "surcharges": r[21] if r[21] is not None else None,
        "created_at": str(r[22]) if r[22] else None,
        "updated_at": str(r[23]) if r[23] else None,
        "effective_to": str(r[24]) if r[24] else None,
    }


def _surcharge_total(surcharges) -> float:
    if not surcharges:
        return 0.0
    return sum(float(s.get('amount', 0) or 0) for s in surcharges)


_LIST_PRICE_RATE_SELECT = """
    SELECT id, rate_card_id, effective_from,
           rate_status::text,
           l45_list_price, p45_list_price, p100_list_price, p250_list_price,
           p300_list_price, p500_list_price, p1000_list_price, min_list_price,
           surcharges, created_at, updated_at, effective_to
    FROM air_list_price_rates
"""


def _row_to_list_price_rate(r) -> dict:
    return {
        "id": r[0],
        "rate_card_id": r[1],
        "effective_from": str(r[2]) if r[2] else None,
        "rate_status": r[3],
        "l45_list_price": float(r[4]) if r[4] is not None else None,
        "p45_list_price": float(r[5]) if r[5] is not None else None,
        "p100_list_price": float(r[6]) if r[6] is not None else None,
        "p250_list_price": float(r[7]) if r[7] is not None else None,
        "p300_list_price": float(r[8]) if r[8] is not None else None,
        "p500_list_price": float(r[9]) if r[9] is not None else None,
        "p1000_list_price": float(r[10]) if r[10] is not None else None,
        "min_list_price": float(r[11]) if r[11] is not None else None,
        "surcharges": r[12] if r[12] is not None else None,
        "created_at": str(r[13]) if r[13] else None,
        "updated_at": str(r[14]) if r[14] else None,
        "effective_to": str(r[15]) if r[15] else None,
    }


_VALID_RATE_STATUSES = {"PUBLISHED", "ON_REQUEST", "DRAFT", "REJECTED"}


def _select_tier(weight: float) -> str:
    if weight >= 1000: return 'p1000'
    if weight >= 500:  return 'p500'
    if weight >= 300:  return 'p300'
    if weight >= 250:  return 'p250'
    if weight >= 100:  return 'p100'
    if weight >= 45:   return 'p45'
    return 'l45'


# ---------------------------------------------------------------------------
# Reference data endpoints
# ---------------------------------------------------------------------------

@router.get("/origins")
async def list_air_origins(
    country_code: Optional[str] = Query(default=None),
    is_active: bool = Query(default=True),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    where = ["rc.is_active = :active"]
    params: dict = {"active": is_active}
    joins = ""

    if country_code:
        joins = "JOIN ports AS p ON p.un_code = rc.origin_port_code"
        where.append("p.country_code = :country")
        params["country"] = country_code

    rows = conn.execute(text(f"""
        SELECT DISTINCT rc.origin_port_code
        FROM air_freight_rate_cards rc
        {joins}
        WHERE {' AND '.join(where)}
        ORDER BY rc.origin_port_code
    """), params).fetchall()

    return {"status": "OK", "data": [r[0] for r in rows]}


@router.get("/airlines")
async def list_air_airlines(
    origin_port_code: Optional[str] = Query(default=None),
    is_active: bool = Query(default=True),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    where = ["rc.is_active = :active"]
    params: dict = {"active": is_active}

    if origin_port_code:
        where.append("rc.origin_port_code = :origin")
        params["origin"] = origin_port_code

    rows = conn.execute(text(f"""
        SELECT DISTINCT rc.airline_code
        FROM air_freight_rate_cards rc
        WHERE {' AND '.join(where)}
        ORDER BY rc.airline_code
    """), params).fetchall()

    return {"status": "OK", "data": [r[0] for r in rows]}


# ---------------------------------------------------------------------------
# Rate Card endpoints
# ---------------------------------------------------------------------------

@router.get("/rate-cards")
async def list_air_rate_cards(
    origin_port_code: Optional[str] = Query(default=None),
    destination_port_code: Optional[str] = Query(default=None),
    airline_code: Optional[str] = Query(default=None),
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
        joins = "JOIN ports AS p ON p.un_code = rc.origin_port_code"
        where.append("p.country_code = :country")
        params["country"] = country_code

    if origin_port_code and not alerts_only:
        where.append("rc.origin_port_code = :origin")
        params["origin"] = origin_port_code
    if destination_port_code:
        where.append("rc.destination_port_code = :dest")
        params["dest"] = destination_port_code
    if airline_code:
        where.append("rc.airline_code = :airline")
        params["airline"] = airline_code
    if dg_class_code:
        where.append("rc.dg_class_code = :dg")
        params["dg"] = dg_class_code

    if alerts_only:
        where.append("""(
            (
                EXISTS (
                    SELECT 1 FROM air_freight_rates r
                    WHERE r.rate_card_id = rc.id
                      AND r.supplier_id IS NOT NULL
                      AND r.rate_status = 'PUBLISHED'
                      AND r.effective_from <= CURRENT_DATE
                      AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
                )
                AND (
                    SELECT MIN(r2.l45_cost)
                    FROM air_freight_rates r2
                    WHERE r2.rate_card_id = rc.id
                      AND r2.supplier_id IS NOT NULL
                      AND r2.rate_status = 'PUBLISHED'
                      AND r2.effective_from <= CURRENT_DATE
                      AND (r2.effective_to IS NULL OR r2.effective_to >= CURRENT_DATE)
                      AND r2.l45_cost IS NOT NULL
                ) > (
                    SELECT lpr.l45_list_price
                    FROM air_list_price_rates lpr
                    JOIN air_list_price_rate_cards lprc
                      ON lprc.id = lpr.rate_card_id
                    WHERE lprc.rate_card_key = rc.origin_port_code || ':' || rc.destination_port_code || ':' || rc.dg_class_code
                      AND lpr.rate_status = 'PUBLISHED'
                      AND lpr.effective_from <= CURRENT_DATE
                      AND (lpr.effective_to IS NULL OR lpr.effective_to >= CURRENT_DATE)
                    ORDER BY lpr.effective_from DESC LIMIT 1
                )
            )
            OR
            (
                EXISTS (
                    SELECT 1 FROM air_freight_rates r
                    WHERE r.rate_card_id = rc.id
                      AND r.supplier_id IS NOT NULL
                      AND r.rate_status = 'PUBLISHED'
                      AND r.effective_from <= CURRENT_DATE
                      AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
                      AND r.l45_cost IS NOT NULL
                )
                AND NOT EXISTS (
                    SELECT 1
                    FROM air_list_price_rates lpr
                    JOIN air_list_price_rate_cards lprc ON lprc.id = lpr.rate_card_id
                    WHERE lprc.rate_card_key = rc.origin_port_code || ':' || rc.destination_port_code || ':' || rc.dg_class_code
                      AND lpr.rate_status = 'PUBLISHED'
                      AND lpr.effective_from <= CURRENT_DATE
                      AND (lpr.effective_to IS NULL OR lpr.effective_to >= CURRENT_DATE)
                      AND lpr.l45_list_price IS NOT NULL
                )
            )
            OR
            (
                (
                    SELECT MAX(r.effective_from) FROM air_freight_rates r
                    WHERE r.rate_card_id = rc.id AND r.supplier_id IS NOT NULL AND r.rate_status = 'PUBLISHED'
                ) > (
                    SELECT MAX(lpr.effective_from)
                    FROM air_list_price_rates lpr
                    JOIN air_list_price_rate_cards lprc ON lprc.id = lpr.rate_card_id
                    WHERE lprc.rate_card_key = rc.origin_port_code || ':' || rc.destination_port_code || ':' || rc.dg_class_code
                      AND lpr.rate_status = 'PUBLISHED'
                )
            )
            OR
            (
                EXISTS (
                    SELECT 1
                    FROM air_list_price_rates lpr
                    JOIN air_list_price_rate_cards lprc ON lprc.id = lpr.rate_card_id
                    WHERE lprc.rate_card_key = rc.origin_port_code || ':' || rc.destination_port_code || ':' || rc.dg_class_code
                      AND lpr.rate_status = 'PUBLISHED'
                      AND lpr.effective_from <= CURRENT_DATE
                      AND (lpr.effective_to IS NULL OR lpr.effective_to >= CURRENT_DATE)
                      AND lpr.l45_list_price IS NOT NULL
                )
                AND NOT EXISTS (
                    SELECT 1 FROM air_freight_rates r
                    WHERE r.rate_card_id = rc.id
                      AND r.supplier_id IS NOT NULL
                      AND r.rate_status = 'PUBLISHED'
                      AND r.effective_from <= CURRENT_DATE
                      AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
                      AND r.l45_cost IS NOT NULL
                )
            )
        )""")

    rows = conn.execute(text(f"""
        SELECT rc.id, rc.rate_card_key, rc.origin_port_code, rc.destination_port_code,
               rc.dg_class_code, rc.airline_code, rc.code, rc.description,
               rc.is_active, rc.created_at, rc.updated_at, rc.currency
        FROM air_freight_rate_cards rc
        {joins}
        WHERE {' AND '.join(where)}
        ORDER BY rc.origin_port_code, rc.destination_port_code, rc.airline_code
    """), params).fetchall()

    cards = [_row_to_rate_card(r) for r in rows]

    if cards:
        card_ids = [c["id"] for c in cards]

        # O/D+DG keys for list price card lookups
        od_dg_keys = list({
            f"{c['origin_port_code']}:{c['destination_port_code']}:{c['dg_class_code']}"
            for c in cards
        })

        lp_card_rows = conn.execute(text("""
            SELECT rate_card_key, id
            FROM air_list_price_rate_cards
            WHERE rate_card_key = ANY(:keys)
        """), {"keys": od_dg_keys}).fetchall()
        lp_card_map = {r[0]: r[1] for r in lp_card_rows}
        lp_card_ids = list(lp_card_map.values())

        # Latest price reference from list price table
        lp_latest_rows = conn.execute(text("""
            SELECT DISTINCT ON (rate_card_id)
                   rate_card_id, l45_list_price, effective_from
            FROM air_list_price_rates
            WHERE rate_card_id = ANY(:ids) AND rate_status = 'PUBLISHED'
            ORDER BY rate_card_id, effective_from DESC
        """), {"ids": lp_card_ids}).fetchall() if lp_card_ids else []

        lp_latest_map = {r[0]: {
            "l45_list_price": float(r[1]) if r[1] is not None else None,
            "effective_from": str(r[2]) if r[2] else None,
        } for r in lp_latest_rows}

        for c in cards:
            lp_key = f"{c['origin_port_code']}:{c['destination_port_code']}:{c['dg_class_code']}"
            lp_cid = lp_card_map.get(lp_key)
            c["latest_price_ref"] = lp_latest_map.get(lp_cid) if lp_cid else None

        # Pending draft count
        draft_rows = conn.execute(text("""
            SELECT rate_card_id, COUNT(*) AS cnt
            FROM air_freight_rates
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

        # Cost time series from air_freight_rates (supplier rows only)
        ts_rows = conn.execute(text("""
            SELECT id, rate_card_id, supplier_id, effective_from,
                   rate_status::text,
                   l45_cost,
                   p100_cost,
                   effective_to, surcharges
            FROM air_freight_rates
            WHERE rate_card_id = ANY(:ids)
              AND supplier_id IS NOT NULL
              AND effective_from < :m_end
              AND (effective_to IS NULL OR effective_to >= :m_start)
              AND rate_status IN ('PUBLISHED', 'DRAFT')
        """), {"ids": card_ids, "m_start": month_start, "m_end": month_end}).fetchall()

        # List price time series from air_list_price_rates
        lp_ts_rows = conn.execute(text("""
            SELECT id, rate_card_id, effective_from,
                   rate_status::text,
                   l45_list_price, p100_list_price,
                   effective_to, surcharges
            FROM air_list_price_rates
            WHERE rate_card_id = ANY(:ids)
              AND effective_from < :m_end
              AND (effective_to IS NULL OR effective_to >= :m_start)
              AND rate_status IN ('PUBLISHED', 'DRAFT')
        """), {"ids": lp_card_ids, "m_start": month_start, "m_end": month_end}).fetchall() if lp_card_ids else []

        # Seed carry-forward for list prices
        seed_lp_rows = conn.execute(text("""
            SELECT DISTINCT ON (rate_card_id)
                   rate_card_id, l45_list_price, p100_list_price, rate_status::text, effective_to, surcharges
            FROM air_list_price_rates
            WHERE rate_card_id = ANY(:ids)
              AND effective_from < :m_start
              AND rate_status IN ('PUBLISHED', 'DRAFT')
            ORDER BY rate_card_id, effective_from DESC
        """), {"ids": lp_card_ids, "m_start": month_start}).fetchall() if lp_card_ids else []

        seed_cost_rows = conn.execute(text("""
            SELECT DISTINCT ON (rate_card_id, supplier_id)
                   rate_card_id, supplier_id, l45_cost, p100_cost, effective_to, surcharges
            FROM air_freight_rates
            WHERE rate_card_id = ANY(:ids)
              AND supplier_id IS NOT NULL
              AND effective_from < :m_start
              AND rate_status = 'PUBLISHED'
              AND l45_cost IS NOT NULL
            ORDER BY rate_card_id, supplier_id, effective_from DESC
        """), {"ids": card_ids, "m_start": month_start}).fetchall()

        seed_price_map = {r[0]: {
            "l45_list_price": float(r[1]) if r[1] is not None else None,
            "p100_list_price": float(r[2]) if r[2] is not None else None,
            "rate_status": r[3],
            "_eff": None,
            "_eff_to": r[4],
            "_surcharges": r[5],
        } for r in seed_lp_rows}

        seed_supplier_costs: dict[int, dict[str, dict]] = {}
        for r in seed_cost_rows:
            card_id_s, supplier_id_s, cost_s, p100_cost_s, eff_to_s, surcharges_s = r
            if card_id_s not in seed_supplier_costs:
                seed_supplier_costs[card_id_s] = {}
            seed_supplier_costs[card_id_s][supplier_id_s] = {
                "cost": float(cost_s),
                "p100_cost": float(p100_cost_s) if p100_cost_s is not None else None,
                "eff_to": eff_to_s,
                "surcharges": surcharges_s,
            }

        from collections import defaultdict
        # price_ref_map keyed by (lp_card_id, month_key)
        price_ref_map: dict[tuple[int, str], dict] = {}
        cost_map: dict[tuple[int, str], list[tuple[float, list | None]]] = defaultdict(list)
        cost_map_by_supplier: dict[tuple[int, str], dict[str, tuple]] = defaultdict(dict)

        # Process list price time series
        for r in lp_ts_rows:
            rid, lp_rc_id, eff_from, r_status, lp, p100_lp, eff_to, surcharges_json = r
            mk = f"{eff_from.year}-{eff_from.month:02d}"
            key = (lp_rc_id, mk)
            existing = price_ref_map.get(key)
            if existing is None or eff_from > existing["_eff"]:
                price_ref_map[key] = {
                    "l45_list_price": float(lp) if lp is not None else None,
                    "p100_list_price": float(p100_lp) if p100_lp is not None else None,
                    "rate_status": r_status,
                    "_eff": eff_from,
                    "_eff_to": eff_to,
                    "_surcharges": surcharges_json,
                }

        # Process cost time series (supplier rows only)
        for r in ts_rows:
            rid, rc_id, supplier_id, eff_from, r_status, cost_val, p100_cost_val, eff_to, surcharges_json = r
            mk = f"{eff_from.year}-{eff_from.month:02d}"
            key = (rc_id, mk)
            if r_status == "PUBLISHED" and cost_val is not None:
                cost_map[key].append((float(cost_val), surcharges_json, float(p100_cost_val) if p100_cost_val is not None else None))
                cost_map_by_supplier[key][supplier_id] = (float(cost_val), float(p100_cost_val) if p100_cost_val is not None else None, eff_to, surcharges_json)

        current_month_key = f"{today.year}-{today.month:02d}"
        month_keys = [f"{m.year}-{m.month:02d}" for m in months]
        for c in cards:
            cid = c["id"]
            lp_key = f"{c['origin_port_code']}:{c['destination_port_code']}:{c['dg_class_code']}"
            lp_cid = lp_card_map.get(lp_key)
            ts = []
            last_pr: dict | None = seed_price_map.get(lp_cid) if lp_cid else None
            active_supplier_costs: dict[str, dict] = dict(seed_supplier_costs.get(cid, {}))
            last_p100_cost = None
            for mk in month_keys:
                key = (cid, mk)
                pr = price_ref_map.get((lp_cid, mk)) if lp_cid else None
                cost_entries = cost_map.get(key)
                is_future = mk > current_month_key

                if pr is not None:
                    last_pr = pr

                month_start_d = date(int(mk[:4]), int(mk[5:7]), 1)

                supplier_updates = cost_map_by_supplier.get(key, {})
                for sup_id, (c_val, c_p100_val, c_eff_to, c_surcharges) in supplier_updates.items():
                    active_supplier_costs[sup_id] = {
                        "cost": c_val,
                        "p100_cost": c_p100_val,
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
                    last_p100_cost = best_sup.get("p100_cost")
                    last_cost_surcharges = best_sup["surcharges"]
                else:
                    last_cost = None
                    last_p100_cost = None
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
                        effective_p100_cost = best_cost_entry[2]
                    else:
                        effective_cost = last_cost
                        effective_p100_cost = last_p100_cost
                        effective_cost_surcharges = last_cost_surcharges
                    pr_sc = _surcharge_total(effective_pr.get("_surcharges")) if effective_pr else 0.0
                    cost_sc = _surcharge_total(effective_cost_surcharges) if effective_cost is not None else 0.0
                    has_any = effective_pr is not None or effective_cost is not None
                    ts.append({
                        "month_key": mk,
                        "l45_list_price": effective_pr["l45_list_price"] if effective_pr else None,
                        "l45_cost": effective_cost,
                        "p100_list_price": effective_pr["p100_list_price"] if effective_pr else None,
                        "p100_cost": effective_p100_cost,
                        "currency": c["currency"],
                        "rate_status": effective_pr["rate_status"] if effective_pr else None,
                        "list_surcharge_total": pr_sc,
                        "cost_surcharge_total": cost_sc,
                        "has_surcharges": (pr_sc > 0 or cost_sc > 0) and has_any,
                    })
                else:
                    pr_sc = _surcharge_total(last_pr.get("_surcharges")) if last_pr else 0.0
                    cost_sc = _surcharge_total(last_cost_surcharges) if last_cost is not None else 0.0
                    has_any = last_pr is not None or last_cost is not None
                    ts.append({
                        "month_key": mk,
                        "l45_list_price": last_pr["l45_list_price"] if last_pr else None,
                        "l45_cost": last_cost,
                        "p100_list_price": last_pr["p100_list_price"] if last_pr else None,
                        "p100_cost": last_p100_cost,
                        "currency": c["currency"],
                        "rate_status": last_pr["rate_status"] if last_pr else None,
                        "list_surcharge_total": pr_sc,
                        "cost_surcharge_total": cost_sc,
                        "has_surcharges": (pr_sc > 0 or cost_sc > 0) and has_any,
                    })
            c["time_series"] = ts

        # Latest effective_from for cost (from air_freight_rates, supplier rows only)
        cost_date_rows = conn.execute(text("""
            SELECT rate_card_id,
                   MAX(effective_from) AS latest_cost_from
            FROM air_freight_rates
            WHERE rate_card_id = ANY(:ids)
              AND supplier_id IS NOT NULL
              AND rate_status = 'PUBLISHED'
            GROUP BY rate_card_id
        """), {"ids": card_ids}).fetchall()

        cost_date_map = {r[0]: r[1] for r in cost_date_rows}
        for c in cards:
            c["latest_cost_from"] = str(cost_date_map[c["id"]]) if cost_date_map.get(c["id"]) else None

        # Latest list price date per O/D+DG key (from air_list_price_rates)
        lp_date_rows = conn.execute(text("""
            SELECT lp.rate_card_key,
                   MAX(r.effective_from) AS latest_list_price_from
            FROM air_list_price_rates r
            JOIN air_list_price_rate_cards lp ON lp.id = r.rate_card_id
            WHERE lp.rate_card_key = ANY(:keys)
              AND r.rate_status IN ('PUBLISHED', 'DRAFT')
            GROUP BY lp.rate_card_key
        """), {"keys": od_dg_keys}).fetchall() if od_dg_keys else []

        lp_date_map = {r[0]: r[1] for r in lp_date_rows}
        for c in cards:
            lp_key = f"{c['origin_port_code']}:{c['destination_port_code']}:{c['dg_class_code']}"
            c["latest_list_price_from"] = str(lp_date_map[lp_key]) if lp_date_map.get(lp_key) else None

        # Supplier that provides lowest current p100_cost per card
        best_supplier_rows = conn.execute(text("""
            SELECT DISTINCT ON (r.rate_card_id)
                   r.rate_card_id,
                   r.supplier_id
            FROM air_freight_rates r
            WHERE r.rate_card_id = ANY(:ids)
              AND r.supplier_id IS NOT NULL
              AND r.rate_status = 'PUBLISHED'
              AND r.effective_from <= CURRENT_DATE
              AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
              AND r.p100_cost IS NOT NULL
            ORDER BY r.rate_card_id, r.p100_cost ASC
        """), {"ids": card_ids}).fetchall()

        best_supplier_map = {r[0]: r[1] for r in best_supplier_rows}
        for c in cards:
            c["latest_cost_supplier_id"] = best_supplier_map.get(c["id"])

    return {"status": "OK", "data": cards}


@router.get("/rate-cards/{card_id}")
async def get_air_rate_card(
    card_id: int,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    row = conn.execute(text("""
        SELECT rc.id, rc.rate_card_key, rc.origin_port_code, rc.destination_port_code,
               rc.dg_class_code, rc.airline_code, rc.code, rc.description,
               rc.is_active, rc.created_at, rc.updated_at, rc.currency
        FROM air_freight_rate_cards rc
        WHERE rc.id = :id
    """), {"id": card_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Air freight rate card {card_id} not found")

    card = _row_to_rate_card(row)

    MIGRATION_FLOOR = date(2024, 1, 1)

    # Supplier cost rows from air_freight_rates
    window_rows = conn.execute(text(f"""
        {_RATE_SELECT}
        WHERE rate_card_id = :id
          AND supplier_id IS NOT NULL
          AND effective_from >= :floor
        ORDER BY supplier_id, effective_from DESC
    """), {"id": card_id, "floor": MIGRATION_FLOOR}).fetchall()

    seed_rows = conn.execute(text(f"""
        SELECT DISTINCT ON (supplier_id)
            id, rate_card_id, supplier_id, effective_from,
            rate_status::text,
            l45_list_price, p45_list_price, p100_list_price, p250_list_price,
            p300_list_price, p500_list_price, p1000_list_price, min_list_price,
            l45_cost, p45_cost, p100_cost, p250_cost,
            p300_cost, p500_cost, p1000_cost, min_cost,
            surcharges,
            created_at, updated_at, effective_to
        FROM air_freight_rates
        WHERE rate_card_id = :id
          AND supplier_id IS NOT NULL
          AND effective_from < :floor
          AND rate_status IN ('PUBLISHED', 'DRAFT')
        ORDER BY supplier_id, effective_from DESC
    """), {"id": card_id, "floor": MIGRATION_FLOOR}).fetchall()

    rate_rows = list(window_rows) + list(seed_rows)

    rates_by_supplier: dict[str, list] = {}
    for rr in rate_rows:
        rate = _row_to_rate(rr)
        key = rate["supplier_id"]
        if key is None:
            continue
        if key not in rates_by_supplier:
            rates_by_supplier[key] = []
        rates_by_supplier[key].append(rate)

    card["rates_by_supplier"] = rates_by_supplier

    # List price from air_list_price_rates
    lp_key = f"{card['origin_port_code']}:{card['destination_port_code']}:{card['dg_class_code']}"
    lp_card_row = conn.execute(text("""
        SELECT id FROM air_list_price_rate_cards WHERE rate_card_key = :key
    """), {"key": lp_key}).fetchone()
    lp_card_id = lp_card_row[0] if lp_card_row else None

    if lp_card_id:
        lp_rate_rows = conn.execute(text(f"""
            {_LIST_PRICE_RATE_SELECT}
            WHERE rate_card_id = :id
              AND effective_from >= :floor
            ORDER BY effective_from DESC
        """), {"id": lp_card_id, "floor": MIGRATION_FLOOR}).fetchall()

        lp_seed_row = conn.execute(text(f"""
            SELECT DISTINCT ON (rate_card_id)
                id, rate_card_id, effective_from,
                rate_status::text,
                l45_list_price, p45_list_price, p100_list_price, p250_list_price,
                p300_list_price, p500_list_price, p1000_list_price, min_list_price,
                surcharges, created_at, updated_at, effective_to
            FROM air_list_price_rates
            WHERE rate_card_id = :id
              AND effective_from < :floor
              AND rate_status IN ('PUBLISHED', 'DRAFT')
            ORDER BY rate_card_id, effective_from DESC
        """), {"id": lp_card_id, "floor": MIGRATION_FLOOR}).fetchone()

        list_price_rates = [_row_to_list_price_rate(r) for r in lp_rate_rows]
        if lp_seed_row:
            list_price_rates.append(_row_to_list_price_rate(lp_seed_row))
    else:
        list_price_rates = []

    card["list_price_card_id"] = lp_card_id
    card["list_price_rates"] = list_price_rates

    # Date metadata
    cost_date = conn.execute(text("""
        SELECT MAX(effective_from)
        FROM air_freight_rates
        WHERE rate_card_id = :id AND supplier_id IS NOT NULL AND rate_status = 'PUBLISHED'
    """), {"id": card_id}).fetchone()
    card["latest_cost_from"] = str(cost_date[0]) if cost_date and cost_date[0] else None

    lp_date = None
    if lp_card_id:
        lp_date_row = conn.execute(text("""
            SELECT MAX(effective_from)
            FROM air_list_price_rates
            WHERE rate_card_id = :id
        """), {"id": lp_card_id}).fetchone()
        lp_date = lp_date_row[0] if lp_date_row else None
    card["latest_list_price_from"] = str(lp_date) if lp_date else None

    return {"status": "OK", "data": card}


@router.post("/rate-cards")
async def create_air_rate_card(
    body: AirRateCardCreate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    origin = body.origin_port_code.strip().upper()
    dest = body.destination_port_code.strip().upper()
    airline = body.airline_code.strip().upper()
    dg = body.dg_class_code.strip().upper()

    rate_card_key = f"{origin}:{dest}:{dg}:{airline}"

    existing = conn.execute(text(
        "SELECT id FROM air_freight_rate_cards WHERE rate_card_key = :key"
    ), {"key": rate_card_key}).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail=f"Rate card {rate_card_key} already exists")

    row = conn.execute(text("""
        INSERT INTO air_freight_rate_cards
            (rate_card_key, origin_port_code, destination_port_code,
             dg_class_code, airline_code, code, description, currency)
        VALUES (:key, :origin, :dest, :dg, :airline, :code, :desc, :currency)
        RETURNING id, created_at
    """), {
        "key": rate_card_key, "origin": origin, "dest": dest,
        "dg": dg, "airline": airline,
        "code": body.code, "desc": body.description,
        "currency": body.currency,
    }).fetchone()

    return {"status": "OK", "data": {
        "id": row[0], "rate_card_key": rate_card_key,
        "origin_port_code": origin, "destination_port_code": dest,
        "dg_class_code": dg, "airline_code": airline,
        "code": body.code, "description": body.description,
        "is_active": True, "created_at": str(row[1]),
        "currency": body.currency,
    }}


@router.patch("/rate-cards/{card_id}")
async def update_air_rate_card(
    card_id: int,
    body: AirRateCardUpdate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM air_freight_rate_cards WHERE id = :id"),
                            {"id": card_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"Air freight rate card {card_id} not found")

    updates = []
    params: dict = {"id": card_id}

    if body.code is not None:
        updates.append("code = :code")
        params["code"] = body.code
    if body.description is not None:
        updates.append("description = :description")
        params["description"] = body.description
    if body.is_active is not None:
        updates.append("is_active = :active")
        params["active"] = body.is_active
    if body.currency is not None:
        updates.append("currency = :currency")
        params["currency"] = body.currency

    if not updates:
        return {"status": "OK", "msg": "No changes"}

    updates.append("updated_at = NOW()")
    conn.execute(text(f"UPDATE air_freight_rate_cards SET {', '.join(updates)} WHERE id = :id"), params)

    return {"status": "OK", "msg": "Rate card updated"}


# ---------------------------------------------------------------------------
# Rate endpoints
# ---------------------------------------------------------------------------

@router.get("/rate-cards/{card_id}/rates")
async def list_air_rates(
    card_id: int,
    supplier_id: Optional[str] = Query(default=None),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    card = conn.execute(text("SELECT id FROM air_freight_rate_cards WHERE id = :id"),
                        {"id": card_id}).fetchone()
    if not card:
        raise HTTPException(status_code=404, detail=f"Air freight rate card {card_id} not found")

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
async def create_air_rate(
    card_id: int,
    body: AirRateCreate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    card = conn.execute(text("SELECT id FROM air_freight_rate_cards WHERE id = :id"),
                        {"id": card_id}).fetchone()
    if not card:
        raise HTTPException(status_code=404, detail=f"Air freight rate card {card_id} not found")

    if body.rate_status not in _VALID_RATE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid rate_status: {body.rate_status}")

    row = conn.execute(text("""
        INSERT INTO air_freight_rates
            (rate_card_id, supplier_id, effective_from, effective_to, rate_status,
             l45_list_price, p45_list_price, p100_list_price, p250_list_price,
             p300_list_price, p500_list_price, p1000_list_price, min_list_price,
             l45_cost, p45_cost, p100_cost, p250_cost,
             p300_cost, p500_cost, p1000_cost, min_cost,
             surcharges)
        VALUES
            (:card_id, :supplier, :eff, :eff_to, CAST(:status AS rate_status),
             :l45_list_price, :p45_list_price, :p100_list_price, :p250_list_price,
             :p300_list_price, :p500_list_price, :p1000_list_price, :min_list_price,
             :l45_cost, :p45_cost, :p100_cost, :p250_cost,
             :p300_cost, :p500_cost, :p1000_cost, :min_cost,
             :surcharges)
        RETURNING id, created_at
    """), {
        "card_id": card_id, "supplier": body.supplier_id,
        "eff": body.effective_from, "eff_to": body.effective_to, "status": body.rate_status,
        "l45_list_price": body.l45_list_price, "p45_list_price": body.p45_list_price,
        "p100_list_price": body.p100_list_price, "p250_list_price": body.p250_list_price,
        "p300_list_price": body.p300_list_price, "p500_list_price": body.p500_list_price,
        "p1000_list_price": body.p1000_list_price, "min_list_price": body.min_list_price,
        "l45_cost": body.l45_cost, "p45_cost": body.p45_cost,
        "p100_cost": body.p100_cost, "p250_cost": body.p250_cost,
        "p300_cost": body.p300_cost, "p500_cost": body.p500_cost,
        "p1000_cost": body.p1000_cost, "min_cost": body.min_cost,
        "surcharges": json.dumps(body.surcharges) if body.surcharges else None,
    }).fetchone()

    return {"status": "OK", "data": {
        "id": row[0], "rate_card_id": card_id,
        "created_at": str(row[1]),
    }}


@router.patch("/rates/{rate_id}")
async def update_air_rate(
    rate_id: int,
    body: AirRateUpdate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM air_freight_rates WHERE id = :id"),
                            {"id": rate_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"Air freight rate {rate_id} not found")

    updates = []
    params: dict = {"id": rate_id}

    field_map = {
        "supplier_id": "supplier_id",
        "effective_from": "effective_from",
        "l45_list_price": "l45_list_price",
        "p45_list_price": "p45_list_price",
        "p100_list_price": "p100_list_price",
        "p250_list_price": "p250_list_price",
        "p300_list_price": "p300_list_price",
        "p500_list_price": "p500_list_price",
        "p1000_list_price": "p1000_list_price",
        "min_list_price": "min_list_price",
        "l45_cost": "l45_cost",
        "p45_cost": "p45_cost",
        "p100_cost": "p100_cost",
        "p250_cost": "p250_cost",
        "p300_cost": "p300_cost",
        "p500_cost": "p500_cost",
        "p1000_cost": "p1000_cost",
        "min_cost": "min_cost",
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
            row = conn.execute(text("SELECT effective_from, effective_to FROM air_freight_rates WHERE id = :id"), {"id": rate_id}).fetchone()
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
    conn.execute(text(f"UPDATE air_freight_rates SET {', '.join(updates)} WHERE id = :id"), params)

    return {"status": "OK", "msg": "Rate updated"}


@router.post("/rates/{rate_id}/publish")
async def publish_air_rate(
    rate_id: int,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    row = conn.execute(text(
        "SELECT id, rate_status::text FROM air_freight_rates WHERE id = :id"
    ), {"id": rate_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Air freight rate {rate_id} not found")
    if row[1] != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Rate is not in DRAFT status (current: {row[1]})")

    conn.execute(text(
        "UPDATE air_freight_rates SET rate_status = 'PUBLISHED'::rate_status, updated_at = NOW() WHERE id = :id"
    ), {"id": rate_id})

    return {"status": "OK", "msg": "Rate published"}


@router.post("/rates/{rate_id}/reject")
async def reject_air_rate(
    rate_id: int,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    row = conn.execute(text(
        "SELECT id, rate_status::text FROM air_freight_rates WHERE id = :id"
    ), {"id": rate_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Air freight rate {rate_id} not found")
    if row[1] != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Rate is not in DRAFT status (current: {row[1]})")

    conn.execute(text(
        "UPDATE air_freight_rates SET rate_status = 'REJECTED'::rate_status, updated_at = NOW() WHERE id = :id"
    ), {"id": rate_id})

    return {"status": "OK", "msg": "Rate rejected"}


@router.delete("/rates/{rate_id}")
async def delete_air_rate(
    rate_id: int,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM air_freight_rates WHERE id = :id"),
                            {"id": rate_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"Air freight rate {rate_id} not found")

    conn.execute(text("DELETE FROM air_freight_rates WHERE id = :id"), {"id": rate_id})

    return {"status": "OK", "msg": "Rate deleted"}


# ---------------------------------------------------------------------------
# List Price Card endpoints (O/D+DG level)
# ---------------------------------------------------------------------------

@router.get("/list-price-cards")
async def list_air_list_price_cards(
    origin_port_code: Optional[str] = Query(default=None),
    destination_port_code: Optional[str] = Query(default=None),
    dg_class_code: Optional[str] = Query(default=None),
    is_active: bool = Query(default=True),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    where = ["is_active = :active"]
    params: dict = {"active": is_active}

    if origin_port_code:
        where.append("origin_port_code = :origin")
        params["origin"] = origin_port_code
    if destination_port_code:
        where.append("destination_port_code = :dest")
        params["dest"] = destination_port_code
    if dg_class_code:
        where.append("dg_class_code = :dg")
        params["dg"] = dg_class_code

    rows = conn.execute(text(f"""
        SELECT id, rate_card_key, origin_port_code, destination_port_code,
               dg_class_code, code, description, is_active, created_at, updated_at, currency
        FROM air_list_price_rate_cards
        WHERE {' AND '.join(where)}
        ORDER BY origin_port_code, destination_port_code
    """), params).fetchall()

    data = [{
        "id": r[0], "rate_card_key": r[1],
        "origin_port_code": r[2], "destination_port_code": r[3],
        "dg_class_code": r[4], "code": r[5], "description": r[6],
        "is_active": r[7], "created_at": str(r[8]) if r[8] else None,
        "updated_at": str(r[9]) if r[9] else None,
        "currency": r[10],
    } for r in rows]

    return {"status": "OK", "data": data}


@router.post("/list-price-cards")
async def create_air_list_price_card(
    body: AirListPriceCardCreate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    origin = body.origin_port_code.strip().upper()
    dest = body.destination_port_code.strip().upper()
    dg = body.dg_class_code.strip().upper()
    rate_card_key = f"{origin}:{dest}:{dg}"

    existing = conn.execute(text(
        "SELECT id FROM air_list_price_rate_cards WHERE rate_card_key = :key"
    ), {"key": rate_card_key}).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail=f"List price card {rate_card_key} already exists")

    row = conn.execute(text("""
        INSERT INTO air_list_price_rate_cards
            (rate_card_key, origin_port_code, destination_port_code,
             dg_class_code, code, description, currency)
        VALUES (:key, :origin, :dest, :dg, :code, :desc, :currency)
        RETURNING id, created_at
    """), {
        "key": rate_card_key, "origin": origin, "dest": dest,
        "dg": dg, "code": body.code, "desc": body.description,
        "currency": body.currency,
    }).fetchone()

    return {"status": "OK", "data": {
        "id": row[0], "rate_card_key": rate_card_key,
        "origin_port_code": origin, "destination_port_code": dest,
        "dg_class_code": dg, "code": body.code, "description": body.description,
        "is_active": True, "created_at": str(row[1]),
        "currency": body.currency,
    }}


@router.patch("/list-price-cards/{card_id}")
async def update_air_list_price_card(
    card_id: int,
    body: AirListPriceCardUpdate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM air_list_price_rate_cards WHERE id = :id"),
                            {"id": card_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"List price card {card_id} not found")

    updates = []
    params: dict = {"id": card_id}

    if body.code is not None:
        updates.append("code = :code")
        params["code"] = body.code
    if body.description is not None:
        updates.append("description = :description")
        params["description"] = body.description
    if body.is_active is not None:
        updates.append("is_active = :active")
        params["active"] = body.is_active
    if body.currency is not None:
        updates.append("currency = :currency")
        params["currency"] = body.currency

    if not updates:
        return {"status": "OK", "msg": "No changes"}

    updates.append("updated_at = NOW()")
    conn.execute(text(f"UPDATE air_list_price_rate_cards SET {', '.join(updates)} WHERE id = :id"), params)

    return {"status": "OK", "msg": "List price card updated"}


@router.get("/list-price-cards/{card_id}/rates")
async def list_air_list_price_rates(
    card_id: int,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    card = conn.execute(text("SELECT id FROM air_list_price_rate_cards WHERE id = :id"),
                        {"id": card_id}).fetchone()
    if not card:
        raise HTTPException(status_code=404, detail=f"List price card {card_id} not found")

    rows = conn.execute(text(f"""
        {_LIST_PRICE_RATE_SELECT}
        WHERE rate_card_id = :card_id
        ORDER BY effective_from DESC
    """), {"card_id": card_id}).fetchall()

    return {"status": "OK", "data": [_row_to_list_price_rate(r) for r in rows]}


@router.post("/list-price-cards/{card_id}/rates")
async def create_air_list_price_rate(
    card_id: int,
    body: AirListPriceRateCreate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    card = conn.execute(text("SELECT id FROM air_list_price_rate_cards WHERE id = :id"),
                        {"id": card_id}).fetchone()
    if not card:
        raise HTTPException(status_code=404, detail=f"List price card {card_id} not found")

    if body.rate_status not in _VALID_RATE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid rate_status: {body.rate_status}")

    row = conn.execute(text("""
        INSERT INTO air_list_price_rates
            (rate_card_id, effective_from, effective_to, rate_status,
             l45_list_price, p45_list_price, p100_list_price, p250_list_price,
             p300_list_price, p500_list_price, p1000_list_price, min_list_price,
             surcharges)
        VALUES
            (:card_id, :eff, :eff_to, CAST(:status AS rate_status),
             :l45, :p45, :p100, :p250, :p300, :p500, :p1000, :min_lp, :surcharges)
        RETURNING id, created_at
    """), {
        "card_id": card_id, "eff": body.effective_from, "eff_to": body.effective_to,
        "status": body.rate_status,
        "l45": body.l45_list_price, "p45": body.p45_list_price,
        "p100": body.p100_list_price, "p250": body.p250_list_price,
        "p300": body.p300_list_price, "p500": body.p500_list_price,
        "p1000": body.p1000_list_price, "min_lp": body.min_list_price,
        "surcharges": json.dumps(body.surcharges) if body.surcharges else None,
    }).fetchone()

    return {"status": "OK", "data": {
        "id": row[0], "rate_card_id": card_id, "created_at": str(row[1]),
    }}


@router.patch("/list-price-rates/{rate_id}")
async def update_air_list_price_rate(
    rate_id: int,
    body: AirListPriceRateUpdate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM air_list_price_rates WHERE id = :id"),
                            {"id": rate_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"List price rate {rate_id} not found")

    updates = []
    params: dict = {"id": rate_id}

    field_map = {
        "effective_from": "effective_from",
        "l45_list_price": "l45_list_price",
        "p45_list_price": "p45_list_price",
        "p100_list_price": "p100_list_price",
        "p250_list_price": "p250_list_price",
        "p300_list_price": "p300_list_price",
        "p500_list_price": "p500_list_price",
        "p1000_list_price": "p1000_list_price",
        "min_list_price": "min_list_price",
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
            row = conn.execute(text("SELECT effective_from, effective_to FROM air_list_price_rates WHERE id = :id"), {"id": rate_id}).fetchone()
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
    conn.execute(text(f"UPDATE air_list_price_rates SET {', '.join(updates)} WHERE id = :id"), params)

    return {"status": "OK", "msg": "List price rate updated"}


@router.delete("/list-price-rates/{rate_id}")
async def delete_air_list_price_rate(
    rate_id: int,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text("SELECT id FROM air_list_price_rates WHERE id = :id"),
                            {"id": rate_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"List price rate {rate_id} not found")

    conn.execute(text("DELETE FROM air_list_price_rates WHERE id = :id"), {"id": rate_id})

    return {"status": "OK", "msg": "List price rate deleted"}


@router.post("/list-price-rates/{rate_id}/publish")
async def publish_air_list_price_rate(
    rate_id: int,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    row = conn.execute(text(
        "SELECT id, rate_status::text FROM air_list_price_rates WHERE id = :id"
    ), {"id": rate_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"List price rate {rate_id} not found")
    if row[1] != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Rate is not in DRAFT status (current: {row[1]})")

    conn.execute(text(
        "UPDATE air_list_price_rates SET rate_status = 'PUBLISHED'::rate_status, updated_at = NOW() WHERE id = :id"
    ), {"id": rate_id})

    return {"status": "OK", "msg": "List price rate published"}


# ---------------------------------------------------------------------------
# Resolve endpoint (Part B — quotation engine entry point)
# ---------------------------------------------------------------------------

@router.post("/rate-cards/{card_id}/resolve")
async def resolve_air_rate(
    card_id: int,
    body: AirResolveRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    if body.chargeable_weight <= 0:
        raise HTTPException(status_code=400, detail="chargeable_weight must be > 0")

    ref_date = body.reference_date or str(date.today())

    # Find the latest active rate for this card + supplier + reference_date
    if body.supplier_id is None:
        rate_row = conn.execute(text(f"""
            {_RATE_SELECT}
            WHERE rate_card_id = :card_id
              AND supplier_id IS NULL
              AND rate_status = 'PUBLISHED'
              AND effective_from <= :ref_date
              AND (effective_to IS NULL OR effective_to >= :ref_date)
            ORDER BY effective_from DESC
            LIMIT 1
        """), {"card_id": card_id, "ref_date": ref_date}).fetchone()
    else:
        rate_row = conn.execute(text(f"""
            {_RATE_SELECT}
            WHERE rate_card_id = :card_id
              AND supplier_id = :supplier
              AND rate_status = 'PUBLISHED'
              AND effective_from <= :ref_date
              AND (effective_to IS NULL OR effective_to >= :ref_date)
            ORDER BY effective_from DESC
            LIMIT 1
        """), {"card_id": card_id, "supplier": body.supplier_id, "ref_date": ref_date}).fetchone()

    if not rate_row:
        raise HTTPException(status_code=404, detail="No active rate found for the given parameters")

    rate = _row_to_rate(rate_row)

    # Currency is on the card, not the rate row
    card_row = conn.execute(text(
        "SELECT currency FROM air_freight_rate_cards WHERE id = :id"
    ), {"id": card_id}).fetchone()
    card_currency = card_row[0] if card_row else "MYR"

    weight = body.chargeable_weight
    tier = _select_tier(weight)

    # Select the right breakpoint value based on supplier_id
    if body.supplier_id is None:
        tier_field = f"{tier}_list_price"
        min_field = "min_list_price"
    else:
        tier_field = f"{tier}_cost"
        min_field = "min_cost"

    tier_rate = rate.get(tier_field)
    min_rate = rate.get(min_field)

    if tier_rate is None:
        raise HTTPException(status_code=404, detail=f"No rate value for tier {tier}")

    surcharges = rate.get("surcharges") or []
    surcharge_per_kg = _surcharge_total(surcharges)
    surcharge_amount = weight * surcharge_per_kg

    base_at_tier = weight * tier_rate
    if min_rate is not None and base_at_tier < min_rate:
        base_charge = min_rate
        min_applied = True
    else:
        base_charge = base_at_tier
        min_applied = False

    total_charge = base_charge + surcharge_amount

    return {"status": "OK", "data": {
        "rate_id": rate["id"],
        "rate_card_id": rate["rate_card_id"],
        "supplier_id": rate["supplier_id"],
        "chargeable_weight": weight,
        "reference_date": ref_date,
        "currency": card_currency,
        "tier_applied": tier,
        "tier_rate": tier_rate,
        "min_rate": min_rate,
        "min_applied": min_applied,
        "surcharge_total_per_kg": surcharge_per_kg,
        "surcharge_amount": round(surcharge_amount, 2),
        "surcharges": surcharges,
        "base_charge": round(base_charge, 2),
        "total_charge": round(total_charge, 2),
    }}
