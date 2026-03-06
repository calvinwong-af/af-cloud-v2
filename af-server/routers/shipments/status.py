"""
routers/shipments/status.py

Status-related endpoints: status update, invoiced flag, exception flag,
company reassign.
"""

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from core.auth import Claims, require_afu, require_auth
from core.db import get_db
from core.exceptions import NotFoundError
from core.constants import (
    AFC_ADMIN,
    AFC_M,
    STATUS_LABELS,
    STATUS_CANCELLED,
    STATUS_BOOKING_PENDING,
    STATUS_BOOKING_CONFIRMED,
    NUMERIC_TO_STRING_STATUS,
    STRING_STATUS_TO_NUMERIC,
    SUB_STATUS_TO_NUMERIC,
    get_status_path,
    get_status_path_list,
)

from ._helpers import _parse_jsonb

logger = logging.getLogger(__name__)

router = APIRouter()


def _normalize_status_to_numeric(raw_status, raw_sub_status=None) -> int:
    """Convert stored status (may be int, numeric string, or string label) to numeric code."""
    if raw_status is None:
        return 1001
    if isinstance(raw_status, int):
        return raw_status
    s = str(raw_status).strip()
    if s.lstrip('-').isdigit():
        return int(s)
    # String status — use sub_status for precise mapping when in_progress
    if raw_sub_status and raw_sub_status in SUB_STATUS_TO_NUMERIC:
        return SUB_STATUS_TO_NUMERIC[raw_sub_status]
    return STRING_STATUS_TO_NUMERIC.get(s, 1001)


# ---------------------------------------------------------------------------
# Update shipment status  (atomic status + history write)
# ---------------------------------------------------------------------------

class UpdateStatusRequest(BaseModel):
    status: int
    allow_jump: bool = False
    reverted: bool = False


@router.patch("/{shipment_id}/status")
async def update_shipment_status(
    shipment_id: str,
    body: UpdateStatusRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """
    Update a shipment's status with atomic status + history write.

    Incoterm-aware: determines Path A (booking) or Path B (no booking)
    and validates the requested status is the correct next step on that path.
    Appends to shipment_workflows.status_history in the same request.
    """
    logger.info(f"[status write] shipment: {shipment_id} new_status: {body.status} reverted: {body.reverted}")
    now = datetime.now(timezone.utc).isoformat()
    new_status = body.status

    # --- a. Read shipment ---
    row = conn.execute(text("""
        SELECT o.status, sd.incoterm_code, sd.transaction_type, sd.status_history, o.sub_status
        FROM orders o
        JOIN shipment_details sd ON sd.order_id = o.order_id
        WHERE o.order_id = :id
    """), {"id": shipment_id}).fetchone()

    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    # --- b. Current status (normalize to numeric for validation) ---
    current_status = _normalize_status_to_numeric(row[0], row[4])
    incoterm = row[1] or ""
    txn_type = row[2] or ""
    q_history = _parse_jsonb(row[3]) or []

    # --- c2. Determine incoterm-aware status path ---
    path = get_status_path(incoterm, txn_type) if incoterm and txn_type else "A"
    path_list = get_status_path_list(incoterm, txn_type) if incoterm and txn_type else None

    # --- d. Terminal state protection (skipped for reversion) ---
    if not body.reverted:
        if current_status == STATUS_CANCELLED:
            return {"status": "ERROR", "msg": "Cannot change status of a cancelled shipment"}

    # --- d2. Path B guard: reject booking statuses for non-booking paths ---
    if path == "B" and new_status in (STATUS_BOOKING_PENDING, STATUS_BOOKING_CONFIRMED):
        return {"status": "ERROR", "msg": f"Booking statuses not applicable for {incoterm} {txn_type} (Path B)"}

    # --- e. Validate transition using path-aware logic ---
    if not body.allow_jump and not body.reverted:
        if new_status == STATUS_CANCELLED:
            pass  # Cancellation always allowed from non-terminal states
        elif path_list and current_status in path_list:
            current_idx = path_list.index(current_status)
            # Only allow advancing to the next step on the path
            if current_idx + 1 < len(path_list):
                expected_next = path_list[current_idx + 1]
                if new_status != expected_next:
                    expected_label = STATUS_LABELS.get(expected_next, str(expected_next))
                    return {
                        "status": "ERROR",
                        "msg": f"Invalid transition: next step is {expected_label} ({expected_next}), not {new_status}",
                    }
            else:
                return {"status": "ERROR", "msg": "Already at final status on this path"}
        elif path_list and current_status not in path_list:
            # Out-of-path: migrated shipment has a status not on its incoterm path
            # (e.g. status=3001 Booking Pending on a Path B incoterm like CNF IMPORT).
            # Allow advancing to any status that is numerically ahead in the full
            # ordered list, or to STATUS_CANCELLED. Block going backwards.
            all_codes = [1001, 1002, 2001, 3001, 3002, 4001, 4002]
            current_ord = all_codes.index(current_status) if current_status in all_codes else -1
            new_ord = all_codes.index(new_status) if new_status in all_codes else -1
            if current_ord >= 0 and new_ord >= 0 and new_ord <= current_ord:
                return {"status": "ERROR", "msg": "Cannot go backwards without revert flag"}
        elif not path_list:
            # Fallback if no incoterm — use simple forward check
            all_codes = [1001, 1002, 2001, 3001, 3002, 4001, 4002]
            if current_status in all_codes and new_status in all_codes:
                if all_codes.index(new_status) <= all_codes.index(current_status):
                    return {"status": "ERROR", "msg": "Cannot go backwards without revert flag"}

    # --- f. Build status_history entry for shipments table ---
    q_history_entry: dict = {
        "status": new_status,
        "label": STATUS_LABELS.get(new_status, str(new_status)),
        "timestamp": now,
        "changed_by": claims.email,
        "note": None,
    }
    if body.reverted:
        q_history_entry["reverted"] = True
        q_history_entry["reverted_from"] = current_status

    new_q_history = list(q_history) + [q_history_entry]

    # --- g. Write status to orders (as string) + status_history to shipment_details ---
    str_status, str_sub_status = NUMERIC_TO_STRING_STATUS.get(new_status, ("draft", None))
    conn.execute(text("""
        UPDATE orders
        SET status = :str_status,
            sub_status = :str_sub_status,
            updated_at = :now
        WHERE order_id = :id
    """), {
        "str_status": str_status,
        "str_sub_status": str_sub_status,
        "now": now,
        "id": shipment_id,
    })
    conn.execute(text("""
        UPDATE shipment_details
        SET status_history = CAST(:history AS jsonb)
        WHERE order_id = :id
    """), {
        "history": json.dumps(new_q_history),
        "id": shipment_id,
    })

    # --- h. Append to shipment_workflows.status_history ---
    wf_row = conn.execute(text("""
        SELECT status_history FROM shipment_workflows WHERE order_id = :id
    """), {"id": shipment_id}).fetchone()

    if wf_row:
        wf_history = _parse_jsonb(wf_row[0]) or []
        wf_history_entry: dict = {
            "status": new_status,
            "status_label": STATUS_LABELS.get(new_status, str(new_status)),
            "timestamp": now,
            "changed_by": claims.uid,
        }
        if body.reverted:
            wf_history_entry["reverted"] = True
            wf_history_entry["reverted_from"] = current_status

        new_wf_history = list(wf_history) + [wf_history_entry]

        conn.execute(text("""
            UPDATE shipment_workflows
            SET status_history = CAST(:history AS jsonb), updated_at = :now
            WHERE order_id = :id
        """), {"history": json.dumps(new_wf_history), "now": now, "id": shipment_id})

    logger.info(
        "Status updated %s: %s -> %s (path %s) by %s",
        shipment_id, current_status, new_status, path, claims.uid,
    )

    return {
        "status": "OK",
        "data": {"shipment_id": shipment_id, "new_status": new_status, "path": path},
        "msg": "Status updated",
    }


# ---------------------------------------------------------------------------
# Update completed flag
# ---------------------------------------------------------------------------

class UpdateCompletedRequest(BaseModel):
    completed: bool
    note: str | None = None


@router.patch("/{shipment_id}/complete")
async def update_completed_flag(
    shipment_id: str,
    body: UpdateCompletedRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """
    Mark a shipment as completed or uncomplete it. AFU staff only.
    Shipment must be at status 3002 or beyond to be marked complete.
    Sets completed_at timestamp when completing; clears it when uncompleting.
    """
    now = datetime.now(timezone.utc).isoformat()

    row = conn.execute(text("""
        SELECT o.status, sd.status_history, o.sub_status
        FROM orders o
        JOIN shipment_details sd ON sd.order_id = o.order_id
        WHERE o.order_id = :id
    """), {"id": shipment_id}).fetchone()

    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    current_status = _normalize_status_to_numeric(row[0], row[2])

    # Minimum status to allow completion
    if body.completed and current_status < STATUS_BOOKING_CONFIRMED:
        return {
            "status": "ERROR",
            "msg": f"Shipment must be at Booking Confirmed (3002) or beyond to mark as completed (current: {current_status})",
        }

    # Build status_history note entry
    q_history = _parse_jsonb(row[1]) or []
    event = "COMPLETED" if body.completed else "UNCOMPLETED"
    history_entry = {
        "event": event,
        "timestamp": now,
        "changed_by": claims.email,
        "note": body.note,
    }
    new_q_history = list(q_history) + [history_entry]

    # Write completed flag to orders, status_history to shipment_details
    if body.completed:
        conn.execute(text("""
            UPDATE orders
            SET completed = TRUE,
                completed_at = :now,
                updated_at = :now
            WHERE order_id = :id
        """), {"now": now, "id": shipment_id})
    else:
        conn.execute(text("""
            UPDATE orders
            SET completed = FALSE,
                completed_at = NULL,
                updated_at = :now
            WHERE order_id = :id
        """), {"now": now, "id": shipment_id})
    conn.execute(text("""
        UPDATE shipment_details
        SET status_history = CAST(:history AS jsonb)
        WHERE order_id = :id
    """), {"history": json.dumps(new_q_history), "id": shipment_id})

    logger.info(
        "Completed flag %s on %s by %s",
        event, shipment_id, claims.uid,
    )

    return {
        "status": "OK",
        "data": {
            "completed": body.completed,
            "completed_at": now if body.completed else None,
        },
    }


# ---------------------------------------------------------------------------
# Update invoiced status
# ---------------------------------------------------------------------------

class UpdateInvoicedRequest(BaseModel):
    issued_invoice: bool


@router.patch("/{shipment_id}/invoiced")
async def update_invoiced_status(
    shipment_id: str,
    body: UpdateInvoicedRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Update the issued_invoice flag. AFU staff only. Shipment must be completed."""
    now = datetime.now(timezone.utc).isoformat()

    row = conn.execute(text("""
        SELECT completed FROM orders WHERE order_id = :id
    """), {"id": shipment_id}).fetchone()

    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    if not row[0]:
        return {"status": "ERROR", "msg": "Invoiced flag can only be set on completed shipments"}

    conn.execute(text("""
        UPDATE orders SET issued_invoice = :issued_invoice, updated_at = :now WHERE order_id = :id
    """), {"issued_invoice": body.issued_invoice, "now": now, "id": shipment_id})

    logger.info("Invoiced %s on %s by %s", body.issued_invoice, shipment_id, claims.uid)

    return {"status": "OK", "data": {"issued_invoice": body.issued_invoice}, "msg": "Invoiced status updated"}


# ---------------------------------------------------------------------------
# Exception flag — raise / clear
# ---------------------------------------------------------------------------

class ExceptionRequest(BaseModel):
    flagged: bool
    notes: str | None = None


@router.patch("/{shipment_id}/exception")
async def update_exception_flag(
    shipment_id: str,
    body: ExceptionRequest,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """
    Raise or clear the exception flag on a shipment.

    Auth: AFU (all), AFC_ADMIN, AFC_M only — 403 for AFC regular.
    Does not block status advancement.
    """
    # Permission check
    if claims.is_afc():
        if claims.role not in (AFC_ADMIN, AFC_M):
            raise HTTPException(status_code=403, detail="Only admins and managers can flag exceptions")

    now = datetime.now(timezone.utc).isoformat()

    # Read the shipment record
    row = conn.execute(text("""
        SELECT o.order_id, o.company_id
        FROM orders o
        WHERE o.order_id = :id
    """), {"id": shipment_id}).fetchone()

    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    # AFC company check
    if claims.is_afc() and (row[1] or "") != claims.company_id:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    # Build exception object
    if body.flagged:
        exception_data = {
            "flagged": True,
            "raised_at": now,
            "raised_by": claims.uid,
            "notes": body.notes,
        }
    else:
        exception_data = {
            "flagged": False,
            "raised_at": None,
            "raised_by": None,
            "notes": None,
        }

    conn.execute(text("""
        UPDATE shipment_details
        SET exception_data = CAST(:exception AS jsonb)
        WHERE order_id = :id
    """), {"exception": json.dumps(exception_data), "id": shipment_id})
    conn.execute(text("""
        UPDATE orders SET updated_at = :now WHERE order_id = :id
    """), {"now": now, "id": shipment_id})

    logger.info(
        "Exception %s on %s by %s: %s",
        "raised" if body.flagged else "cleared",
        shipment_id, claims.uid, body.notes,
    )

    return {
        "status": "OK",
        "data": {"exception": exception_data},
        "msg": f"Exception {'raised' if body.flagged else 'cleared'}",
    }


# ---------------------------------------------------------------------------
# Reassign company
# ---------------------------------------------------------------------------

class AssignCompanyRequest(BaseModel):
    company_id: str


@router.patch("/{shipment_id}/company")
async def assign_company(
    shipment_id: str,
    body: AssignCompanyRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """
    Reassign a shipment to a different company. AFU staff only.
    """
    now = datetime.now(timezone.utc).isoformat()

    # Validate company exists
    company_row = conn.execute(text("""
        SELECT id, name, short_name FROM companies WHERE id = :id
    """), {"id": body.company_id}).fetchone()

    if not company_row:
        raise NotFoundError(f"Company {body.company_id} not found")

    company_name = company_row[1] or company_row[2] or body.company_id

    # Verify shipment exists
    shipment_row = conn.execute(text("""
        SELECT order_id FROM orders WHERE order_id = :id
    """), {"id": shipment_id}).fetchone()

    if not shipment_row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    conn.execute(text("""
        UPDATE orders SET company_id = :company_id, updated_at = :now WHERE order_id = :id
    """), {"company_id": body.company_id, "now": now, "id": shipment_id})

    logger.info("Reassigned %s to company %s by %s", shipment_id, body.company_id, claims.uid)

    return {
        "status": "OK",
        "data": {"company_id": body.company_id, "company_name": company_name},
        "msg": "Company reassigned",
    }
