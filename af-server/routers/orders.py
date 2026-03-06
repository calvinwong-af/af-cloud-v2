"""
routers/orders.py — Unified orders list endpoint.

Single list across all order types (shipment + transport).
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text

from core.auth import Claims, require_auth
from core.db import get_db

logger = logging.getLogger(__name__)

router = APIRouter()

_VALID_TABS = {"all", "active", "closed", "cancelled"}


def _tab_filter(tab: str) -> str:
    if tab == "active":
        return "o.status IN ('confirmed', 'in_progress', 'dispatched', 'in_transit', 'detained') AND o.completed = FALSE"
    if tab == "closed":
        return "(o.completed = TRUE OR o.status = 'completed')"
    if tab == "cancelled":
        return "o.status = 'cancelled'"
    # all
    return "TRUE"


@router.get("")
async def list_orders(
    tab: str = Query("active"),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """List all orders (shipments + transport) with tab-based filtering."""
    if tab not in _VALID_TABS:
        raise HTTPException(status_code=400, detail=f"Unrecognised tab value: {tab}")

    where = f"o.trash = FALSE AND {_tab_filter(tab)}"
    params: dict = {"limit": limit, "offset": offset}

    # AFC users scoped to own company
    if claims.is_afc():
        where += " AND o.company_id = :company_id"
        params["company_id"] = claims.company_id

    rows = conn.execute(text(f"""
        SELECT
            o.order_id,
            o.order_type,
            o.transport_mode,
            o.status,
            o.sub_status,
            o.company_id,
            c.name AS company_name,
            o.parent_order_id,
            o.is_test,
            o.created_at::text,
            o.updated_at::text,
            sd.order_type_detail,
            sd.transaction_type,
            sd.origin_port,
            sd.dest_port
        FROM orders o
        LEFT JOIN shipment_details sd ON sd.order_id = o.order_id AND o.order_type = 'shipment'
        LEFT JOIN companies c ON c.id = o.company_id
        WHERE {where}
        ORDER BY o.created_at DESC
        LIMIT :limit OFFSET :offset
    """), params).fetchall()

    items = []
    for r in rows:
        items.append({
            "order_id": r[0],
            "order_type": r[1],
            "transport_mode": r[2],
            "status": r[3],
            "sub_status": r[4],
            "company_id": r[5] or "",
            "company_name": r[6] or "",
            "parent_order_id": r[7],
            "is_test": r[8] or False,
            "created_at": (r[9] or "")[:10] if r[9] else "",
            "updated_at": (r[10] or "")[:10] if r[10] else "",
            "order_type_detail": r[11],
            "transaction_type": r[12],
            "origin_port": r[13],
            "dest_port": r[14],
        })

    # Total count for pagination
    count_where = f"o.trash = FALSE AND {_tab_filter(tab)}"
    count_params: dict = {}
    if claims.is_afc():
        count_where += " AND o.company_id = :company_id"
        count_params["company_id"] = claims.company_id

    total_row = conn.execute(text(f"""
        SELECT COUNT(*) FROM orders o WHERE {count_where}
    """), count_params).fetchone()
    total = total_row[0] if total_row else 0

    next_cursor = str(offset + limit) if (offset + limit) < total else None

    return {"items": items, "total": total, "next_cursor": next_cursor}


@router.get("/stats")
async def get_orders_stats(
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """Return order counts across all types for tab badges."""
    where = "o.trash = FALSE"
    params: dict = {}
    if claims.is_afc():
        where += " AND o.company_id = :company_id"
        params["company_id"] = claims.company_id

    row = conn.execute(text(f"""
        SELECT
            COUNT(*) FILTER (WHERE
                o.status IN ('confirmed', 'in_progress', 'dispatched', 'in_transit', 'detained')
                AND o.completed = FALSE
            ) AS active,
            COUNT(*) FILTER (WHERE o.status = 'cancelled') AS cancelled,
            COUNT(*) AS total
        FROM orders o
        WHERE {where}
    """), params).fetchone()

    return {
        "status": "OK",
        "data": {
            "active": row[0] or 0,
            "cancelled": row[1] or 0,
            "total": row[2] or 0,
        },
    }
