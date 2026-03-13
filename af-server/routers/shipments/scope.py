"""
routers/shipments/scope.py

Scope configuration endpoints — GET and PATCH for shipment scope flags.
Scope flags control task mode (ASSIGNED / TRACKED / IGNORED) for
configurable legs (first_mile, export_clearance, import_clearance, last_mile).
"""

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text, bindparam, String

from core.auth import Claims, require_afu
from core.db import get_db
from core.exceptions import NotFoundError
from logic.incoterm_tasks import (
    derive_scope_from_incoterm,
    apply_scope_to_tasks,
    get_eligible_scope_keys,
    ASSIGNED, TRACKED, IGNORED,
)
from ._helpers import _parse_jsonb

logger = logging.getLogger(__name__)

router = APIRouter()

_VALID_MODES = {ASSIGNED, TRACKED, IGNORED}


def _is_new_schema(scope: dict) -> bool:
    """Check if a scope dict uses the new string-mode schema vs old boolean schema."""
    if not scope:
        return False
    return any(v in _VALID_MODES for v in scope.values())


@router.get("/{shipment_id}/scope")
async def get_scope(
    shipment_id: str,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Return the current scope for a shipment. Derives from incoterm if not set."""
    row = conn.execute(text("""
        SELECT sd.scope, sd.incoterm_code, sd.transaction_type, sd.tlx_release
        FROM shipment_details sd
        JOIN orders o ON o.order_id = sd.order_id
        WHERE sd.order_id = :id AND o.trash = FALSE
    """), {"id": shipment_id}).fetchone()

    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    scope = _parse_jsonb(row[0])
    incoterm = row[1] or ""
    txn_type = row[2] or ""

    # If scope is null, empty, or uses old boolean schema → derive from incoterm
    if not scope or not _is_new_schema(scope):
        scope = derive_scope_from_incoterm(incoterm, txn_type)

    return {"status": "OK", "data": {**scope, "tlx_release": bool(row[3])}}


class UpdateScopeRequest(BaseModel):
    first_mile: str | None = None
    export_clearance: str | None = None
    import_clearance: str | None = None
    last_mile: str | None = None
    tlx_release: bool | None = None


@router.patch("/{shipment_id}/scope")
async def update_scope(
    shipment_id: str,
    body: UpdateScopeRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Update scope flags and apply to workflow tasks."""
    row = conn.execute(text("""
        SELECT sd.scope, sd.incoterm_code, sd.transaction_type
        FROM shipment_details sd
        JOIN orders o ON o.order_id = sd.order_id
        WHERE sd.order_id = :id AND o.trash = FALSE
    """), {"id": shipment_id}).fetchone()

    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    current_scope = _parse_jsonb(row[0])
    incoterm = row[1] or ""
    txn_type = row[2] or ""

    # Start from current scope or derive default
    if not current_scope or not _is_new_schema(current_scope):
        current_scope = derive_scope_from_incoterm(incoterm, txn_type)

    # Eligible keys for this incoterm/transaction
    eligible = set(get_eligible_scope_keys(incoterm, txn_type))

    # Apply updates from request body
    updates = body.dict(exclude_none=True)
    # Handle tlx_release separately — it's a boolean column, not a scope flag
    tlx_update = updates.pop("tlx_release", None)
    for key, value in updates.items():
        if value not in _VALID_MODES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid mode '{value}' for {key}. Must be ASSIGNED, TRACKED, or IGNORED.",
            )
        # Cannot scope-in a task that the incoterm doesn't include
        if value in (ASSIGNED, TRACKED) and key not in eligible:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot set {key} to {value} — not eligible for {incoterm}/{txn_type}.",
            )
        current_scope[key] = value

    now = datetime.now(timezone.utc).isoformat()

    # Save scope to shipment_details
    conn.execute(text("""
        UPDATE shipment_details SET scope = CAST(:scope AS jsonb) WHERE order_id = :id
    """).bindparams(bindparam("scope", type_=String())), {"scope": json.dumps(current_scope), "id": shipment_id})

    # Save tlx_release if provided
    if tlx_update is not None:
        conn.execute(text("""
            UPDATE shipment_details SET tlx_release = :tlx_release WHERE order_id = :id
        """), {"tlx_release": tlx_update, "id": shipment_id})

    # Apply scope to workflow tasks
    wf_row = conn.execute(text("""
        SELECT workflow_tasks FROM shipment_workflows WHERE order_id = :id
    """), {"id": shipment_id}).fetchone()

    if wf_row:
        tasks = _parse_jsonb(wf_row[0]) or []
        if tasks:
            apply_scope_to_tasks(tasks, current_scope)
            conn.execute(text("""
                UPDATE shipment_workflows
                SET workflow_tasks = CAST(:tasks AS jsonb), updated_at = :now
                WHERE order_id = :id
            """).bindparams(bindparam("tasks", type_=String())), {"tasks": json.dumps(tasks), "now": now, "id": shipment_id})

    conn.execute(text("""
        UPDATE orders SET updated_at = :now WHERE order_id = :id
    """), {"now": now, "id": shipment_id})

    logger.info("Scope updated for %s by %s", shipment_id, claims.uid)

    # Read back current tlx_release for response
    tlx_row = conn.execute(text("""
        SELECT tlx_release FROM shipment_details WHERE order_id = :id
    """), {"id": shipment_id}).fetchone()
    tlx_val = bool(tlx_row[0]) if tlx_row else False

    return {"status": "OK", "data": {**current_scope, "tlx_release": tlx_val}}
