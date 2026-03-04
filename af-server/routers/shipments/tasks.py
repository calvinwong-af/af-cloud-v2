"""
routers/shipments/tasks.py

Workflow task endpoints: get tasks, update task.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from core.auth import Claims, require_auth
from core.db import get_db
from core.exceptions import NotFoundError
from core import constants, db_queries
from logic.incoterm_tasks import (
    migrate_task_on_read,
    PENDING,
    IN_PROGRESS,
    COMPLETED,
    BLOCKED,
    ASSIGNED,
    TRACKED,
    IGNORED,
    FREIGHT_BOOKING,
    EXPORT_CLEARANCE,
)

from ._helpers import _parse_jsonb, _sync_route_node_timings
from .core import _lazy_init_tasks_pg

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# GET /shipments/{shipment_id}/tasks
# ---------------------------------------------------------------------------

@router.get("/{shipment_id}/tasks")
async def get_shipment_tasks(
    shipment_id: str,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """
    Get the workflow tasks for a shipment.
    Auto-generates tasks on first access if incoterm + transaction_type are set.
    """
    # Fetch shipment data for AFC company check and lazy init
    shipment_data = db_queries.get_shipment_by_id(conn, shipment_id)
    if not shipment_data:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    # AFC users can only see their own company's shipments
    if claims.is_afc() and shipment_data.get("company_id") != claims.company_id:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    tasks = _lazy_init_tasks_pg(conn, shipment_id, shipment_data)

    # Apply migration-on-read for tasks missing new fields
    tasks = [migrate_task_on_read(t) for t in tasks]

    # Filter hidden tasks for AFC users
    if claims.is_afc():
        tasks = [t for t in tasks if t.get("visibility") != "HIDDEN"]

    return {
        "shipment_id": shipment_id,
        "tasks": tasks,
    }


# ---------------------------------------------------------------------------
# PATCH /shipments/{shipment_id}/tasks/{task_id}
# ---------------------------------------------------------------------------

class UpdateTaskRequest(BaseModel):
    status: Optional[str] = None
    mode: Optional[str] = None
    assigned_to: Optional[str] = None
    third_party_name: Optional[str] = None
    due_date: Optional[str] = None
    due_date_override: Optional[bool] = None
    notes: Optional[str] = None
    visibility: Optional[str] = None
    scheduled_start: Optional[str] = None
    scheduled_end: Optional[str] = None
    actual_start: Optional[str] = None
    actual_end: Optional[str] = None


@router.patch("/{shipment_id}/tasks/{task_id}")
async def update_shipment_task(
    shipment_id: str,
    task_id: str,
    body: UpdateTaskRequest,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """
    Update a single task within workflow_tasks on shipment_workflows.
    Permission enforcement:
      AFU: all fields
      AFC_ADMIN / AFC_M: all except visibility
      AFC (regular): read-only — 403
    """
    now = datetime.now(timezone.utc).isoformat()

    # --- Permission check ---
    if claims.is_afc():
        if claims.role not in ("AFC-ADMIN", "AFC-M"):
            raise HTTPException(status_code=403, detail="Read-only access — cannot update tasks")
        # AFC Admin/Manager cannot change visibility
        if body.visibility is not None:
            raise HTTPException(status_code=403, detail="Only AF staff can change task visibility")

    # --- Validate enum values ---
    if body.status is not None and body.status not in (PENDING, IN_PROGRESS, COMPLETED, BLOCKED):
        raise HTTPException(status_code=400, detail=f"Invalid status: {body.status}")
    if body.mode is not None and body.mode not in (ASSIGNED, TRACKED, IGNORED):
        raise HTTPException(status_code=400, detail=f"Invalid mode: {body.mode}")
    if body.assigned_to is not None and body.assigned_to not in ("AF", "CUSTOMER", "THIRD_PARTY"):
        raise HTTPException(status_code=400, detail=f"Invalid assigned_to: {body.assigned_to}")
    if body.visibility is not None and body.visibility not in ("VISIBLE", "HIDDEN"):
        raise HTTPException(status_code=400, detail=f"Invalid visibility: {body.visibility}")

    # --- Load shipment_workflows ---
    wf_row = conn.execute(text("""
        SELECT workflow_tasks FROM shipment_workflows WHERE shipment_id = :id
    """), {"id": shipment_id}).fetchone()

    if not wf_row:
        raise NotFoundError(f"ShipmentWorkFlow for {shipment_id} not found")

    tasks: list[dict] = _parse_jsonb(wf_row[0]) or []

    # --- Find the target task ---
    target_idx = None
    for i, t in enumerate(tasks):
        if t.get("task_id") == task_id:
            target_idx = i
            break

    if target_idx is None:
        raise NotFoundError(f"Task {task_id} not found on shipment {shipment_id}")

    task = tasks[target_idx]
    warning = None

    # --- Apply mode updates (before status — mode affects valid statuses) ---
    if body.mode is not None:
        task["mode"] = body.mode
        if body.mode == IGNORED:
            task["visibility"] = "HIDDEN"
            task["status"] = PENDING
        elif task.get("mode") == IGNORED and body.mode != IGNORED:
            # Coming out of IGNORED — restore visibility
            task["visibility"] = "VISIBLE"

    # --- Apply status updates ---
    if body.status is not None:
        # BLOCKED is only valid when mode is ASSIGNED
        if body.status == BLOCKED and task.get("mode", ASSIGNED) != ASSIGNED:
            raise HTTPException(status_code=400, detail="BLOCKED status only valid for ASSIGNED mode tasks")

        old_status = task.get("status")
        task["status"] = body.status

        # Auto-set actual_start when moving to IN_PROGRESS
        if body.status == IN_PROGRESS and old_status != IN_PROGRESS:
            if body.actual_start is None and not task.get("actual_start"):
                task["actual_start"] = now

        # Auto-set completion timestamp when moving to COMPLETED
        if body.status == COMPLETED:
            # TRACKED POD: ATA (actual_start) is the meaningful completion event
            # — the vessel arrives and discharges; ATD is irrelevant for POD
            if task.get("mode") == TRACKED and task.get("task_type") == "POD":
                if body.actual_start is None and not task.get("actual_start"):
                    task["actual_start"] = now
            else:
                if body.actual_end is None and not task.get("actual_end"):
                    task["actual_end"] = now
            task["completed_at"] = now

    if body.assigned_to is not None:
        task["assigned_to"] = body.assigned_to

    if body.third_party_name is not None:
        task["third_party_name"] = body.third_party_name

    if body.due_date is not None:
        task["due_date"] = body.due_date
        task["scheduled_end"] = body.due_date
        task["due_date_override"] = True
    elif body.due_date_override is not None:
        task["due_date_override"] = body.due_date_override

    if body.notes is not None:
        task["notes"] = body.notes

    if body.visibility is not None:
        task["visibility"] = body.visibility

    # --- Timing fields ---
    # Use __fields_set__ to distinguish "not sent" from "explicitly set to null".
    # Explicit null clears the field; omitted fields are left unchanged.
    if "scheduled_start" in body.__fields_set__:
        task["scheduled_start"] = body.scheduled_start
    if "scheduled_end" in body.__fields_set__:
        task["scheduled_end"] = body.scheduled_end
    if "actual_start" in body.__fields_set__:
        task["actual_start"] = body.actual_start
    if "actual_end" in body.__fields_set__:
        task["actual_end"] = body.actual_end
        task["completed_at"] = body.actual_end if body.actual_end is not None else None

    task["updated_by"] = claims.uid
    task["updated_at"] = now

    # --- FREIGHT_BOOKING completion -> unblock EXPORT_CLEARANCE ---
    if body.status == COMPLETED and task.get("task_type") == FREIGHT_BOOKING:
        # Check shipment for booking_reference
        booking_row = conn.execute(text("""
            SELECT booking FROM shipments WHERE id = :id
        """), {"id": shipment_id}).fetchone()
        booking_ref = ""
        if booking_row:
            booking = _parse_jsonb(booking_row[0]) or {}
            booking_ref = booking.get("booking_reference", "") if isinstance(booking, dict) else ""

        if booking_ref:
            # Unblock EXPORT_CLEARANCE
            for t in tasks:
                if t.get("task_type") == EXPORT_CLEARANCE and t.get("status") == BLOCKED:
                    t["status"] = PENDING
                    t["updated_by"] = claims.uid
                    t["updated_at"] = now
        else:
            warning = "EXPORT_CLEARANCE remains BLOCKED — booking_reference not set on shipment"

    # --- Write back ---
    tasks[target_idx] = task
    conn.execute(text("""
        UPDATE shipment_workflows
        SET workflow_tasks = CAST(:tasks AS jsonb), updated_at = :now
        WHERE shipment_id = :id
    """), {"tasks": json.dumps(tasks), "now": now, "id": shipment_id})

    # --- Sync route node timings for TRACKED POL actual_start (ATA) ---
    # Use task["actual_start"] (final value) — covers both manual edits AND
    # auto-set from status transitions (IN_PROGRESS / COMPLETED auto-stamps).
    if (task.get("mode") == TRACKED and task.get("task_type") == "POL"
            and task.get("actual_start")):
        _sync_route_node_timings(
            conn, shipment_id, now,
            origin_actual_eta=task["actual_start"],
        )

    # --- Auto status progression for TRACKED port tasks ---
    task_type = task.get("task_type")
    task_mode = task.get("mode")

    if task_mode == TRACKED and task_type in ("POL", "POD"):
        # Auto status progression — forward only
        if task_type == "POL" and body.actual_end is not None:
            cur = conn.execute(
                text("SELECT status, status_history FROM shipments WHERE id = :id"),
                {"id": shipment_id}
            ).fetchone()
            if cur and (cur[0] or 0) < constants.STATUS_DEPARTED:
                new_status = constants.STATUS_DEPARTED
                history = _parse_jsonb(cur[1]) or []
                history.append({
                    "status": new_status,
                    "label": constants.STATUS_LABELS[new_status],
                    "timestamp": now,
                    "changed_by": claims.email,
                    "note": "Auto-advanced from ATD (POL task)",
                })
                conn.execute(text("""
                    UPDATE shipments
                    SET status = :status, status_history = CAST(:history AS jsonb), updated_at = :now
                    WHERE id = :id
                """), {"status": new_status, "history": json.dumps(history), "now": now, "id": shipment_id})
                logger.info("[tasks] Auto-advanced %s to Departed (4001) from POL ATD", shipment_id)

        elif task_type == "POD" and body.actual_start is not None:
            cur = conn.execute(
                text("SELECT status, status_history FROM shipments WHERE id = :id"),
                {"id": shipment_id}
            ).fetchone()
            if cur and (cur[0] or 0) < constants.STATUS_ARRIVED:
                new_status = constants.STATUS_ARRIVED
                history = _parse_jsonb(cur[1]) or []
                history.append({
                    "status": new_status,
                    "label": constants.STATUS_LABELS[new_status],
                    "timestamp": now,
                    "changed_by": claims.email,
                    "note": "Auto-advanced from ATA (POD task)",
                })
                conn.execute(text("""
                    UPDATE shipments
                    SET status = :status, status_history = CAST(:history AS jsonb), updated_at = :now
                    WHERE id = :id
                """), {"status": new_status, "history": json.dumps(history), "now": now, "id": shipment_id})
                logger.info("[tasks] Auto-advanced %s to Arrived (4002) from POD ATA", shipment_id)

    logger.info("Task %s updated on %s by %s", task_id, shipment_id, claims.uid)

    response: dict = {"status": "OK", "data": task, "msg": "Task updated"}
    if warning:
        response["warning"] = warning
    return response
