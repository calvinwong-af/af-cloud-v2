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
from .port_transport import router as port_transport_router
from .haulage import router as haulage_router
from .air import router as air_router

router = APIRouter()
router.include_router(fcl_router, prefix="/fcl", tags=["Pricing - FCL"])
router.include_router(lcl_router, prefix="/lcl", tags=["Pricing - LCL"])
router.include_router(local_charges_router, prefix="/local-charges", tags=["Pricing - Local Charges"])
router.include_router(customs_router, prefix="/customs", tags=["Pricing - Customs"])
router.include_router(port_transport_router, prefix="/port-transport", tags=["Pricing - Port Transport"])
router.include_router(haulage_router, prefix="/haulage", tags=["Pricing - Haulage"])
router.include_router(air_router, prefix="/air", tags=["Pricing - Air Freight"])


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

        row = conn.execute(text(f"""
            WITH
            active_cards AS (
                SELECT rc.id, rc.updated_at
                FROM {card_table} rc
                {joins}
                WHERE rc.is_active = true {country_where}
            ),
            alert_cep AS (
                SELECT DISTINCT rc.id
                FROM {card_table} rc
                JOIN active_cards ac ON ac.id = rc.id
                CROSS JOIN LATERAL (
                    SELECT r.cost, r.effective_to
                    FROM {rate_table} r
                    WHERE r.rate_card_id = rc.id
                      AND r.supplier_id IS NOT NULL
                      AND r.rate_status = 'PUBLISHED'
                      AND r.cost IS NOT NULL
                    ORDER BY r.effective_from DESC
                    LIMIT 1
                ) lc
                CROSS JOIN LATERAL (
                    SELECT r.list_price, r.effective_to
                    FROM {rate_table} r
                    WHERE r.rate_card_id = rc.id
                      AND r.supplier_id IS NULL
                      AND r.rate_status = 'PUBLISHED'
                      AND r.list_price IS NOT NULL
                    ORDER BY r.effective_from DESC
                    LIMIT 1
                ) llp
                WHERE (lc.effective_to IS NULL OR lc.effective_to >= CURRENT_DATE)
                  AND (llp.effective_to IS NULL OR llp.effective_to >= CURRENT_DATE)
                  AND lc.cost > llp.list_price
            ),
            alert_nac AS (
                SELECT DISTINCT rc.id
                FROM {card_table} rc
                JOIN active_cards ac ON ac.id = rc.id
                CROSS JOIN LATERAL (
                    SELECT r.effective_to
                    FROM {rate_table} r
                    WHERE r.rate_card_id = rc.id
                      AND r.supplier_id IS NULL
                      AND r.rate_status = 'PUBLISHED'
                      AND r.list_price IS NOT NULL
                    ORDER BY r.effective_from DESC
                    LIMIT 1
                ) llp
                LEFT JOIN LATERAL (
                    SELECT r.effective_to, 1 AS found
                    FROM {rate_table} r
                    WHERE r.rate_card_id = rc.id
                      AND r.supplier_id IS NOT NULL
                      AND r.rate_status = 'PUBLISHED'
                      AND r.cost IS NOT NULL
                    ORDER BY r.effective_from DESC
                    LIMIT 1
                ) lc ON true
                WHERE (llp.effective_to IS NULL OR llp.effective_to >= CURRENT_DATE)
                  AND (lc.found IS NULL
                       OR (lc.effective_to IS NOT NULL AND lc.effective_to < CURRENT_DATE))
            ),
            alert_nlp AS (
                SELECT DISTINCT rc.id
                FROM {card_table} rc
                JOIN active_cards ac ON ac.id = rc.id
                CROSS JOIN LATERAL (
                    SELECT r.effective_to
                    FROM {rate_table} r
                    WHERE r.rate_card_id = rc.id
                      AND r.supplier_id IS NOT NULL
                      AND r.rate_status = 'PUBLISHED'
                      AND r.cost IS NOT NULL
                    ORDER BY r.effective_from DESC
                    LIMIT 1
                ) lc
                LEFT JOIN LATERAL (
                    SELECT r.effective_to, 1 AS found
                    FROM {rate_table} r
                    WHERE r.rate_card_id = rc.id
                      AND r.supplier_id IS NULL
                      AND r.rate_status = 'PUBLISHED'
                      AND r.list_price IS NOT NULL
                    ORDER BY r.effective_from DESC
                    LIMIT 1
                ) llp ON true
                WHERE (lc.effective_to IS NULL OR lc.effective_to >= CURRENT_DATE)
                  AND (llp.found IS NULL
                       OR (llp.effective_to IS NOT NULL AND llp.effective_to < CURRENT_DATE))
            ),
            alert_prn AS (
                SELECT DISTINCT rc.id
                FROM {card_table} rc
                JOIN active_cards ac ON ac.id = rc.id
                WHERE (
                    SELECT MAX(r.effective_from)
                    FROM {rate_table} r
                    WHERE r.rate_card_id = rc.id
                      AND r.supplier_id IS NOT NULL
                      AND r.rate_status = 'PUBLISHED'
                ) > (
                    SELECT MAX(r.effective_from)
                    FROM {rate_table} r
                    WHERE r.rate_card_id = rc.id
                      AND r.supplier_id IS NULL
                      AND r.rate_status = 'PUBLISHED'
                )
            ),
            alert_union AS (
                SELECT id FROM alert_cep
                UNION
                SELECT id FROM alert_nac
                UNION
                SELECT id FROM alert_nlp
                UNION
                SELECT id FROM alert_prn
            ),
            expiring_soon_cards AS (
                SELECT ac.id
                FROM active_cards ac
                WHERE
                    CURRENT_DATE >= DATE_TRUNC('month', CURRENT_DATE + interval '1 month') - interval '7 days'
                    AND NOT EXISTS (
                        SELECT 1 FROM {rate_table} r
                        WHERE r.rate_card_id = ac.id
                          AND r.effective_from >= DATE_TRUNC('month', CURRENT_DATE + interval '1 month')
                    )
                    AND ac.id NOT IN (SELECT id FROM alert_union)
            )
            SELECT
                (SELECT COUNT(*) FROM active_cards)                    AS total_cards,
                (SELECT MAX(updated_at)::date FROM active_cards)       AS last_updated,
                (SELECT COUNT(*) FROM expiring_soon_cards)             AS expiring_soon,
                (SELECT COUNT(*) FROM alert_cep)                       AS cost_exceeds_price,
                (SELECT COUNT(*) FROM alert_nac)                       AS no_active_cost,
                (SELECT COUNT(*) FROM alert_nlp)                       AS no_list_price,
                (SELECT COUNT(*) FROM alert_prn)                       AS price_review_needed
        """), params).fetchone()

        result[mode] = {
            "total_cards": row[0] if row else 0,
            "last_updated": str(row[1]) if row and row[1] else None,
            "expiring_soon": row[2] if row else 0,
            "cost_exceeds_price": row[3] if row else 0,
            "no_active_cost": row[4] if row else 0,
            "no_list_price": row[5] if row else 0,
            "price_review_needed": row[6] if row else 0,
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

    # --- Transport (port-to-area, same 4-scenario pattern as FCL/LCL) ---
    t_card_table = "port_transport_rate_cards"
    t_rate_table = "port_transport_rates"
    t_joins = ""
    t_country_where = ""
    t_params: dict = {}

    if country_code:
        t_joins = "JOIN ports AS p ON p.un_code = rc.port_un_code"
        t_country_where = "AND p.country_code = :country"
        t_params["country"] = country_code

    t_row = conn.execute(text(f"""
        SELECT COUNT(*), MAX(rc.updated_at)::date
        FROM {t_card_table} rc {t_joins}
        WHERE rc.is_active = true {t_country_where}
    """), t_params).fetchone()
    t_total = t_row[0] if t_row else 0
    t_last_updated = str(t_row[1]) if t_row and t_row[1] else None

    t_exp = conn.execute(text(f"""
        SELECT COUNT(*) FROM {t_card_table} rc {t_joins}
        WHERE rc.is_active = true {t_country_where}
        AND NOT EXISTS (
            SELECT 1 FROM {t_rate_table} r
            WHERE r.rate_card_id = rc.id
            AND r.effective_from > DATE_TRUNC('month', CURRENT_DATE)
        )
    """), t_params).fetchone()
    t_expiring = t_exp[0] if t_exp else 0

    t_s1 = conn.execute(text(f"""
        SELECT COUNT(DISTINCT rc.id) FROM {t_card_table} rc {t_joins}
        WHERE rc.is_active = true {t_country_where}
        AND (SELECT MIN(r.cost) FROM {t_rate_table} r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NOT NULL AND r.rate_status = 'PUBLISHED' AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE) AND r.cost IS NOT NULL)
            > (SELECT r2.list_price FROM {t_rate_table} r2 WHERE r2.rate_card_id = rc.id AND r2.supplier_id IS NULL AND r2.rate_status = 'PUBLISHED' AND r2.effective_from <= CURRENT_DATE AND (r2.effective_to IS NULL OR r2.effective_to >= CURRENT_DATE) ORDER BY r2.effective_from DESC LIMIT 1)
    """), t_params).fetchone()
    t_cep = t_s1[0] if t_s1 else 0

    t_s2 = conn.execute(text(f"""
        SELECT COUNT(DISTINCT rc.id) FROM {t_card_table} rc {t_joins}
        WHERE rc.is_active = true {t_country_where}
        AND EXISTS (SELECT 1 FROM {t_rate_table} r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NOT NULL AND r.rate_status = 'PUBLISHED' AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE) AND r.cost IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM {t_rate_table} r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NULL AND r.rate_status = 'PUBLISHED' AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE) AND r.list_price IS NOT NULL)
    """), t_params).fetchone()
    t_nlp = t_s2[0] if t_s2 else 0

    t_s3 = conn.execute(text(f"""
        SELECT COUNT(DISTINCT rc.id) FROM {t_card_table} rc {t_joins}
        WHERE rc.is_active = true {t_country_where}
        AND (SELECT MAX(r.effective_from) FROM {t_rate_table} r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NOT NULL AND r.rate_status = 'PUBLISHED')
            > (SELECT MAX(r.effective_from) FROM {t_rate_table} r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NULL AND r.rate_status = 'PUBLISHED')
    """), t_params).fetchone()
    t_prn = t_s3[0] if t_s3 else 0

    t_s4 = conn.execute(text(f"""
        SELECT COUNT(DISTINCT rc.id) FROM {t_card_table} rc {t_joins}
        WHERE rc.is_active = true {t_country_where}
        AND EXISTS (SELECT 1 FROM {t_rate_table} r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NULL AND r.rate_status = 'PUBLISHED' AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE) AND r.list_price IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM {t_rate_table} r WHERE r.rate_card_id = rc.id AND r.supplier_id IS NOT NULL AND r.rate_status = 'PUBLISHED' AND r.effective_from <= CURRENT_DATE AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE) AND r.cost IS NOT NULL)
    """), t_params).fetchone()
    t_nac = t_s4[0] if t_s4 else 0

    result["port-transport"] = {
        "total_cards": t_total,
        "last_updated": t_last_updated,
        "expiring_soon": t_expiring,
        "cost_exceeds_price": t_cep,
        "no_active_cost": t_nac,
        "no_list_price": t_nlp,
        "price_review_needed": t_prn,
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
