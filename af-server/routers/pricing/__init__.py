"""
routers/pricing/ — Pricing module endpoints (FCL + LCL rate cards and rates).
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text

from core.auth import Claims, require_afu
from core.db import get_db
from .fcl import router as fcl_router
from .lcl import router as lcl_router
from .local_charges import router as local_charges_router
from .customs import router as customs_router

router = APIRouter()
router.include_router(fcl_router, prefix="/fcl", tags=["Pricing - FCL"])
router.include_router(lcl_router, prefix="/lcl", tags=["Pricing - LCL"])
router.include_router(local_charges_router, prefix="/local-charges", tags=["Pricing - Local Charges"])
router.include_router(customs_router, prefix="/customs", tags=["Pricing - Customs"])


# ---------------------------------------------------------------------------
# Shared pricing endpoints
# ---------------------------------------------------------------------------

def _country_join_filter(table_alias: str, params: dict, country_code: str) -> str:
    """Return JOIN + WHERE clause fragment for country filtering on a rate card table."""
    params["country"] = country_code
    return f"""
        JOIN ports AS op ON op.un_code = {table_alias}.origin_port_code
        JOIN ports AS dp ON dp.un_code = {table_alias}.destination_port_code
    """


@router.get("/dashboard-summary", tags=["Pricing"])
async def dashboard_summary(
    country_code: Optional[str] = Query(default=None),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    result = {}
    for mode, card_table, rate_table in [
        ("fcl", "fcl_rate_cards", "fcl_rates"),
        ("lcl", "lcl_rate_cards", "lcl_rates"),
    ]:
        joins = ""
        country_where = ""
        params: dict = {}

        if country_code:
            joins = _country_join_filter("rc", params, country_code)
            country_where = "AND (op.country_code = :country OR dp.country_code = :country)"

        # total_cards + last_updated
        row = conn.execute(text(f"""
            SELECT COUNT(*), MAX(rc.updated_at)::date
            FROM {card_table} rc
            {joins}
            WHERE rc.is_active = true {country_where}
        """), params).fetchone()

        total_cards = row[0] if row else 0
        last_updated = str(row[1]) if row and row[1] else None

        # expiring_soon — cards with no future-dated rate
        exp_row = conn.execute(text(f"""
            SELECT COUNT(*) FROM {card_table} rc
            {joins}
            WHERE rc.is_active = true {country_where}
            AND NOT EXISTS (
                SELECT 1 FROM {rate_table} r
                WHERE r.rate_card_id = rc.id
                AND r.effective_from > DATE_TRUNC('month', CURRENT_DATE)
            )
        """), params).fetchone()

        expiring_soon = exp_row[0] if exp_row else 0

        # Scenario 1 — cost exceeds list price
        s1_row = conn.execute(text(f"""
            SELECT COUNT(DISTINCT rc.id)
            FROM {card_table} rc
            {joins}
            WHERE rc.is_active = true {country_where}
            AND (
                SELECT MIN(r_cost.cost)
                FROM {rate_table} r_cost
                WHERE r_cost.rate_card_id = rc.id
                  AND r_cost.supplier_id IS NOT NULL
                  AND r_cost.rate_status = 'PUBLISHED'
                  AND r_cost.effective_from <= CURRENT_DATE
                  AND (r_cost.effective_to IS NULL OR r_cost.effective_to >= CURRENT_DATE)
                  AND r_cost.cost IS NOT NULL
            ) > (
                SELECT r_price.list_price
                FROM {rate_table} r_price
                WHERE r_price.rate_card_id = rc.id
                  AND r_price.supplier_id IS NULL
                  AND r_price.rate_status = 'PUBLISHED'
                  AND r_price.effective_from <= CURRENT_DATE
                  AND (r_price.effective_to IS NULL OR r_price.effective_to >= CURRENT_DATE)
                ORDER BY r_price.effective_from DESC
                LIMIT 1
            )
        """), params).fetchone()
        cost_exceeds_price = s1_row[0] if s1_row else 0

        # Scenario 2 — cost but no list price
        s2_row = conn.execute(text(f"""
            SELECT COUNT(DISTINCT rc.id)
            FROM {card_table} rc
            {joins}
            WHERE rc.is_active = true {country_where}
            AND EXISTS (
                SELECT 1 FROM {rate_table} r
                WHERE r.rate_card_id = rc.id
                  AND r.supplier_id IS NOT NULL
                  AND r.rate_status = 'PUBLISHED'
                  AND r.effective_from <= CURRENT_DATE
                  AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
                  AND r.cost IS NOT NULL
            )
            AND NOT EXISTS (
                SELECT 1 FROM {rate_table} r
                WHERE r.rate_card_id = rc.id
                  AND r.supplier_id IS NULL
                  AND r.rate_status = 'PUBLISHED'
                  AND r.effective_from <= CURRENT_DATE
                  AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
                  AND r.list_price IS NOT NULL
            )
        """), params).fetchone()
        no_list_price = s2_row[0] if s2_row else 0

        # Scenario 3 — cost newer than list price
        s3_row = conn.execute(text(f"""
            SELECT COUNT(DISTINCT rc.id)
            FROM {card_table} rc
            {joins}
            WHERE rc.is_active = true {country_where}
            AND (
                SELECT MAX(r_cost.effective_from)
                FROM {rate_table} r_cost
                WHERE r_cost.rate_card_id = rc.id
                  AND r_cost.supplier_id IS NOT NULL
                  AND r_cost.rate_status = 'PUBLISHED'
            ) > (
                SELECT MAX(r_price.effective_from)
                FROM {rate_table} r_price
                WHERE r_price.rate_card_id = rc.id
                  AND r_price.supplier_id IS NULL
                  AND r_price.rate_status = 'PUBLISHED'
            )
        """), params).fetchone()
        price_review_needed = s3_row[0] if s3_row else 0

        # Scenario 4 — list price active but no current supplier cost (cost expired)
        s4_row = conn.execute(text(f"""
            SELECT COUNT(DISTINCT rc.id)
            FROM {card_table} rc
            {joins}
            WHERE rc.is_active = true {country_where}
            AND EXISTS (
                SELECT 1 FROM {rate_table} r
                WHERE r.rate_card_id = rc.id
                  AND r.supplier_id IS NULL
                  AND r.rate_status = 'PUBLISHED'
                  AND r.effective_from <= CURRENT_DATE
                  AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
                  AND r.list_price IS NOT NULL
            )
            AND NOT EXISTS (
                SELECT 1 FROM {rate_table} r
                WHERE r.rate_card_id = rc.id
                  AND r.supplier_id IS NOT NULL
                  AND r.rate_status = 'PUBLISHED'
                  AND r.effective_from <= CURRENT_DATE
                  AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
                  AND r.cost IS NOT NULL
            )
        """), params).fetchone()
        no_active_cost = s4_row[0] if s4_row else 0

        result[mode] = {
            "total_cards": total_cards,
            "last_updated": last_updated,
            "expiring_soon": expiring_soon,
            "cost_exceeds_price": cost_exceeds_price,
            "no_active_cost": no_active_cost,
            "no_list_price": no_list_price,
            "price_review_needed": price_review_needed,
        }

    # --- Local Charges and Customs (flat-rate modules) ---
    for mode, rate_table in [
        ("local-charges", "local_charges"),
        ("customs", "customs_rates"),
    ]:
        flat_joins = ""
        flat_where = ""
        flat_params: dict = {}

        if country_code:
            flat_joins = "JOIN ports p ON p.un_code = r.port_code"
            flat_where = "AND p.country_code = :country"
            flat_params["country"] = country_code

        # Distinct card key tuple differs: local_charges has container_size/container_type, customs does not
        if rate_table == "local_charges":
            distinct_key = "(r.port_code, r.trade_direction, r.shipment_type, r.container_size, r.container_type, r.charge_code, r.is_domestic)"
        else:
            distinct_key = "(r.port_code, r.trade_direction, r.shipment_type, r.charge_code, r.is_domestic)"

        total_row = conn.execute(text(f"""
            SELECT COUNT(DISTINCT {distinct_key})
            FROM {rate_table} r
            {flat_joins}
            WHERE r.is_active = true {flat_where}
        """), flat_params).fetchone()
        flat_total = total_row[0] if total_row else 0

        upd_row = conn.execute(text(f"""
            SELECT MAX(r.updated_at)::date
            FROM {rate_table} r
            {flat_joins}
            WHERE r.is_active = true {flat_where}
        """), flat_params).fetchone()
        flat_last_updated = str(upd_row[0]) if upd_row and upd_row[0] else None

        # cost_exceeds_price: active row today where cost > price
        cep_row = conn.execute(text(f"""
            SELECT COUNT(DISTINCT {distinct_key})
            FROM {rate_table} r
            {flat_joins}
            WHERE r.is_active = true {flat_where}
              AND r.effective_from <= CURRENT_DATE
              AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
              AND r.cost IS NOT NULL AND r.price IS NOT NULL
              AND r.cost > r.price
        """), flat_params).fetchone()
        flat_cep = cep_row[0] if cep_row else 0

        # no_active_cost: price present but cost is NULL on active row
        nac_row = conn.execute(text(f"""
            SELECT COUNT(DISTINCT {distinct_key})
            FROM {rate_table} r
            {flat_joins}
            WHERE r.is_active = true {flat_where}
              AND r.effective_from <= CURRENT_DATE
              AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
              AND r.price IS NOT NULL AND r.cost IS NULL
        """), flat_params).fetchone()
        flat_nac = nac_row[0] if nac_row else 0

        result[mode] = {
            "total_cards": flat_total,
            "last_updated": flat_last_updated,
            "expiring_soon": 0,
            "cost_exceeds_price": flat_cep,
            "no_active_cost": flat_nac,
            "no_list_price": 0,
            "price_review_needed": 0,
        }

    return {"status": "OK", "data": result}


@router.get("/countries", tags=["Pricing"])
async def pricing_countries(
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    rows = conn.execute(text("""
        SELECT DISTINCT c.country_code, c.name AS country_name
        FROM countries c
        WHERE c.country_code IN (
            SELECT LEFT(origin_port_code, 2) FROM fcl_rate_cards WHERE is_active = true
            UNION
            SELECT LEFT(destination_port_code, 2) FROM fcl_rate_cards WHERE is_active = true
            UNION
            SELECT LEFT(origin_port_code, 2) FROM lcl_rate_cards WHERE is_active = true
            UNION
            SELECT LEFT(destination_port_code, 2) FROM lcl_rate_cards WHERE is_active = true
        )
        AND c.is_active = true
        ORDER BY c.name
    """)).fetchall()

    data = [{"country_code": r[0], "country_name": r[1]} for r in rows]
    return {"status": "OK", "data": data}
