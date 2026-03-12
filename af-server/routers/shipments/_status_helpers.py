"""
routers/shipments/_status_helpers.py — Status advancement, task helpers, and system logging.
"""

import json
import logging
from datetime import datetime, timezone

from sqlalchemy import text, bindparam, String

from core.constants import STATUS_DEPARTED, STATUS_LABELS, NUMERIC_TO_STRING_STATUS
from logic.incoterm_tasks import (
    FREIGHT_BOOKING,
    EXPORT_CLEARANCE,
    PENDING,
    COMPLETED,
    BLOCKED,
)
from ._helpers import _parse_jsonb

logger = logging.getLogger(__name__)


def _check_atd_advancement_pg(
    conn,
    shipment_id: str,
    current_status: int,
    claims_email: str,
    note: str = "Auto-advanced from ATD (doc apply)",
) -> int:
    """
    If TRACKED POL task has actual_end set and current status < STATUS_DEPARTED,
    advance shipment to STATUS_DEPARTED and append to status_history.
    Returns the final status.
    """
    if current_status >= STATUS_DEPARTED:
        return current_status

    now = datetime.now(timezone.utc).isoformat()
    wf_row = conn.execute(
        text("SELECT workflow_tasks FROM shipment_workflows WHERE order_id = :id"),
        {"id": shipment_id}
    ).fetchone()
    if not wf_row:
        return current_status

    wf_tasks = _parse_jsonb(wf_row[0]) or []
    pol_task = next(
        (t for t in wf_tasks if t.get("task_type") == "POL" and t.get("mode") == "TRACKED"),
        None
    )
    if not pol_task or not pol_task.get("actual_end"):
        return current_status

    cur = conn.execute(
        text("""
            SELECT o.status, sd.status_history, o.sub_status
            FROM orders o
            JOIN shipment_details sd ON sd.order_id = o.order_id
            WHERE o.order_id = :id
        """),
        {"id": shipment_id}
    ).fetchone()
    if not cur:
        return current_status
    # Check if already at or past departed — sub_status in_transit/arrived or status completed/cancelled
    db_sub = cur[2] or ""
    if db_sub in ("in_transit", "arrived") or (cur[0] or "") in ("completed", "cancelled"):
        return current_status

    history = _parse_jsonb(cur[1]) or []
    history.append({
        "status": STATUS_DEPARTED,
        "label": STATUS_LABELS[STATUS_DEPARTED],
        "timestamp": now,
        "changed_by": claims_email,
        "note": note,
    })
    str_status, str_sub_status = NUMERIC_TO_STRING_STATUS.get(STATUS_DEPARTED, ("in_progress", "in_transit"))
    conn.execute(text("""
        UPDATE orders
        SET status = :s, sub_status = :ss, updated_at = :now
        WHERE order_id = :id
    """), {
        "s": str_status,
        "ss": str_sub_status,
        "now": now,
        "id": shipment_id,
    })
    conn.execute(text("""
        UPDATE shipment_details
        SET status_history = CAST(:history AS jsonb)
        WHERE order_id = :id
    """).bindparams(bindparam("history", type_=String())), {
        "history": json.dumps(history),
        "id": shipment_id,
    })
    logger.info("[atd_check] Auto-advanced %s to Departed (4001)", shipment_id)
    return STATUS_DEPARTED


def _maybe_unblock_export_clearance_pg(conn, shipment_id: str, user_id: str):
    """Unblock EXPORT_CLEARANCE if FREIGHT_BOOKING is completed and waybill is set."""
    wf_row = conn.execute(text("""
        SELECT workflow_tasks FROM shipment_workflows WHERE order_id = :id
    """), {"id": shipment_id}).fetchone()

    if not wf_row:
        return

    tasks = _parse_jsonb(wf_row[0]) or []
    now = datetime.now(timezone.utc).isoformat()

    # Check FREIGHT_BOOKING status
    fb_completed = False
    for t in tasks:
        if t.get("task_type") == FREIGHT_BOOKING and t.get("status") == COMPLETED:
            fb_completed = True
            break

    if not fb_completed:
        return

    # Unblock EXPORT_CLEARANCE
    changed = False
    for t in tasks:
        if t.get("task_type") == EXPORT_CLEARANCE and t.get("status") == BLOCKED:
            t["status"] = PENDING
            t["updated_by"] = user_id
            t["updated_at"] = now
            changed = True
            break

    if changed:
        conn.execute(text("""
            UPDATE shipment_workflows
            SET workflow_tasks = CAST(:tasks AS jsonb), updated_at = :now
            WHERE order_id = :id
        """).bindparams(bindparam("tasks", type_=String())), {"tasks": json.dumps(tasks), "now": now, "id": shipment_id})
        logger.info("EXPORT_CLEARANCE unblocked for %s", shipment_id)


def _log_system_action_pg(conn, action: str, entity_id: str, uid: str, email: str):
    """Write a log entry to system_logs table."""
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(text("""
        INSERT INTO system_logs (action, entity_id, uid, email, created_at)
        VALUES (:action, :entity_id, :uid, :email, :created_at)
    """), {
        "action": action,
        "entity_id": entity_id,
        "uid": uid,
        "email": email,
        "created_at": now,
    })


def _sync_route_node_timings(
    conn,
    shipment_id: str,
    now: str,
    *,
    origin_scheduled_eta: str | None = None,
    origin_scheduled_etd: str | None = None,
    origin_actual_etd: str | None = None,
    origin_actual_eta: str | None = None,
    dest_scheduled_eta: str | None = None,
    dest_actual_eta: str | None = None,
) -> None:
    """
    Sync timing values to the route_nodes JSONB on shipments.
    Only updates fields that are explicitly passed (non-None).
    For derived (unsaved) route nodes, builds and saves minimal nodes first.
    """
    row = conn.execute(
        text("SELECT route_nodes, origin_port, dest_port FROM shipment_details WHERE order_id = :id"),
        {"id": shipment_id},
    ).fetchone()
    if not row:
        return

    nodes = _parse_jsonb(row[0]) or []

    # If no saved route nodes yet, bootstrap from origin/dest port codes
    if not nodes:
        origin_code = row[1] or ""
        dest_code = row[2] or ""
        if not origin_code and not dest_code:
            return
        nodes = []
        if origin_code:
            nodes.append({
                "port_un_code": origin_code,
                "port_name": origin_code,
                "sequence": 1,
                "role": "ORIGIN",
                "scheduled_eta": None,
                "actual_eta": None,
                "scheduled_etd": None,
                "actual_etd": None,
            })
        if dest_code:
            nodes.append({
                "port_un_code": dest_code,
                "port_name": dest_code,
                "sequence": 2 if origin_code else 1,
                "role": "DESTINATION",
                "scheduled_eta": None,
                "actual_eta": None,
                "scheduled_etd": None,
                "actual_etd": None,
            })

    modified = False
    for node in nodes:
        if node.get("role") == "ORIGIN":
            if origin_scheduled_eta is not None:
                node["scheduled_eta"] = origin_scheduled_eta
                modified = True
            if origin_scheduled_etd is not None:
                node["scheduled_etd"] = origin_scheduled_etd
                modified = True
            if origin_actual_etd is not None:
                node["actual_etd"] = origin_actual_etd
                modified = True
            if origin_actual_eta is not None:
                node["actual_eta"] = origin_actual_eta
                modified = True
        elif node.get("role") == "DESTINATION":
            if dest_scheduled_eta is not None:
                node["scheduled_eta"] = dest_scheduled_eta
                modified = True
            if dest_actual_eta is not None:
                node["actual_eta"] = dest_actual_eta
                modified = True

    if modified:
        conn.execute(text("""
            UPDATE shipment_details
            SET route_nodes = CAST(:nodes AS jsonb)
            WHERE order_id = :id
        """).bindparams(bindparam("nodes", type_=String())), {"nodes": json.dumps(nodes), "id": shipment_id})
