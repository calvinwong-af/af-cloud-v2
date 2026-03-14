"""
routers/orders.py — Unified orders list endpoint.

Single list across all order types (shipment + transport).
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy import String
from sqlalchemy.sql.expression import bindparam

from core.auth import Claims, require_auth
from core.db import get_db
from logic.incoterm_tasks import generate_tasks

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


# ---------------------------------------------------------------------------
# PATCH /orders/{shipment_id}/transaction-type
# ---------------------------------------------------------------------------

class TransactionTypeUpdate(BaseModel):
    transaction_type: str  # 'IMPORT' | 'EXPORT'


@router.patch("/{shipment_id}/transaction-type")
async def update_transaction_type(
    shipment_id: str,
    body: TransactionTypeUpdate,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """Change trade direction on a Draft shipment. Resets workflow and flags quotations."""
    if body.transaction_type not in ("IMPORT", "EXPORT"):
        raise HTTPException(status_code=400, detail="transaction_type must be IMPORT or EXPORT")

    # 1. Check current status and transaction_type
    row = conn.execute(text("""
        SELECT o.status, sd.transaction_type, sd.incoterm_code
        FROM orders o
        JOIN shipment_details sd ON sd.order_id = o.order_id
        WHERE o.order_id = :sid
    """), {"sid": shipment_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Shipment not found")

    current_status = row[0]
    current_txn = row[1]
    incoterm_code = row[2] or "CNF"

    if current_status not in ("draft",):
        raise HTTPException(status_code=400, detail="Trade direction can only be changed on Draft shipments")

    if body.transaction_type == current_txn:
        raise HTTPException(status_code=400, detail="New trade direction is the same as current")

    now = datetime.now(timezone.utc).isoformat()

    # 2. Update shipment_details.transaction_type
    conn.execute(text("""
        UPDATE shipment_details SET transaction_type = :txn
        WHERE order_id = :sid
    """), {"txn": body.transaction_type, "sid": shipment_id})

    # 3. Reset workflow tasks
    tasks = generate_tasks(incoterm_code, body.transaction_type, updated_by=claims.email)

    conn.execute(text("DELETE FROM shipment_workflows WHERE order_id = :sid"), {"sid": shipment_id})
    conn.execute(text("""
        INSERT INTO shipment_workflows (order_id, status_history, workflow_tasks, completed, created_at, updated_at)
        VALUES (:sid, CAST(:history AS jsonb), CAST(:tasks AS jsonb), FALSE, :now, :now)
    """).bindparams(
        bindparam("history", type_=String()),
        bindparam("tasks", type_=String()),
    ), {
        "sid": shipment_id,
        "history": json.dumps([{
            "status": "draft",
            "label": "Draft",
            "timestamp": now,
            "changed_by": claims.email,
            "note": f"Trade direction changed to {body.transaction_type}",
        }]),
        "tasks": json.dumps(tasks),
        "now": now,
    })

    # 4. Flag open quotations as stale
    result = conn.execute(text("""
        UPDATE quotations SET scope_changed = TRUE, updated_at = :now
        WHERE shipment_id = :sid AND status NOT IN ('EXPIRED', 'ACCEPTED')
    """), {"sid": shipment_id, "now": now})
    quotations_flagged = result.rowcount

    # 5. Update orders.updated_at
    conn.execute(text("UPDATE orders SET updated_at = :now WHERE order_id = :sid"), {"now": now, "sid": shipment_id})

    return {
        "status": "OK",
        "data": {
            "transaction_type": body.transaction_type,
            "workflow_reset": True,
            "quotations_flagged": quotations_flagged,
        },
    }
