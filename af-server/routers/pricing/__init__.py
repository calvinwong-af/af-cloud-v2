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

router = APIRouter()
router.include_router(fcl_router, prefix="/fcl", tags=["Pricing - FCL"])
router.include_router(lcl_router, prefix="/lcl", tags=["Pricing - LCL"])


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

        result[mode] = {
            "total_cards": total_cards,
            "last_updated": last_updated,
            "expiring_soon": expiring_soon,
        }

    return {"status": "OK", "data": result}


@router.get("/countries", tags=["Pricing"])
async def pricing_countries(
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    rows = conn.execute(text("""
        SELECT DISTINCT p.country_code, p.country
        FROM ports p
        WHERE p.un_code IN (
            SELECT origin_port_code FROM fcl_rate_cards WHERE is_active = true
            UNION
            SELECT destination_port_code FROM fcl_rate_cards WHERE is_active = true
            UNION
            SELECT origin_port_code FROM lcl_rate_cards WHERE is_active = true
            UNION
            SELECT destination_port_code FROM lcl_rate_cards WHERE is_active = true
        )
        AND p.country_code IS NOT NULL
        ORDER BY p.country_code
    """)).fetchall()

    data = [{"country_code": r[0], "country_name": r[1]} for r in rows]
    return {"status": "OK", "data": data}
