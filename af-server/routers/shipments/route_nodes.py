"""
routers/shipments/route_nodes.py

Route node endpoints and helpers: derive, enrich, assign sequences,
GET/PUT/PATCH route-nodes.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text, bindparam, String

from core.auth import Claims, require_auth
from core.db import get_db
from core.exceptions import NotFoundError
from core import constants, db_queries

from ._helpers import _parse_jsonb
from ._status_helpers import _log_system_action_pg

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Route node helpers
# ---------------------------------------------------------------------------

def _derive_route_nodes(shipment_data: dict) -> list[dict]:
    """
    Derive display-only route nodes from origin/destination port codes.
    Used when route_nodes is empty on existing shipments.
    """
    nodes = []
    origin_code = shipment_data.get("origin_port_un_code") or shipment_data.get("origin_port") or ""
    dest_code = shipment_data.get("destination_port_un_code") or shipment_data.get("dest_port") or ""

    if origin_code:
        nodes.append({
            "port_un_code": origin_code,
            "port_name": origin_code,
            "sequence": 1,
            "role": "ORIGIN",
            "scheduled_eta": None,
            "actual_eta": None,
            "scheduled_etd": shipment_data.get("etd"),
            "actual_etd": None,
        })

    if dest_code:
        nodes.append({
            "port_un_code": dest_code,
            "port_name": dest_code,
            "sequence": 2 if origin_code else 1,
            "role": "DESTINATION",
            "scheduled_eta": shipment_data.get("eta"),
            "actual_eta": None,
            "scheduled_etd": None,
            "actual_etd": None,
        })

    return nodes


def _enrich_route_nodes(conn, nodes: list[dict]) -> list[dict]:
    """Enrich route nodes with port details from ports table if available."""
    if not nodes:
        return nodes

    port_codes = [n.get("port_un_code") for n in nodes if n.get("port_un_code")]
    if not port_codes:
        return nodes

    # Batch-fetch port records
    placeholders = ", ".join(f":p{i}" for i in range(len(port_codes)))
    params = {f"p{i}": code for i, code in enumerate(port_codes)}

    rows = conn.execute(text(f"""
        SELECT un_code, name, country_code, port_type
        FROM ports
        WHERE un_code IN ({placeholders})
    """), params).fetchall()

    port_map = {}
    for r in rows:
        port_map[r[0]] = {"port_name": r[1] or "", "country": r[2] or "", "port_type": r[3] or ""}

    for node in nodes:
        port = port_map.get(node.get("port_un_code", ""))
        if port:
            node["port_name"] = port["port_name"] or node.get("port_name", "")
            node["country"] = port["country"]
            node["port_type"] = port["port_type"]

    return nodes


def _assign_sequences(nodes: list[dict]) -> list[dict]:
    """Auto-assign sequence numbers: ORIGIN=1, TRANSHIP=2..N-1, DESTINATION=N."""
    # Sort: ORIGIN first, then TRANSHIP in order, then DESTINATION
    role_order = {"ORIGIN": 0, "TRANSHIP": 1, "DESTINATION": 2}
    nodes.sort(key=lambda n: (role_order.get(n.get("role", ""), 1), n.get("sequence", 0)))

    for i, node in enumerate(nodes):
        node["sequence"] = i + 1

    return nodes


# ---------------------------------------------------------------------------
# GET /shipments/{shipment_id}/route-nodes
# ---------------------------------------------------------------------------

@router.get("/{shipment_id}/route-nodes")
async def get_route_nodes(
    shipment_id: str,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """Get route nodes for a shipment. Derives from ports if not yet saved."""
    shipment_data = db_queries.get_shipment_by_id(conn, shipment_id)
    if not shipment_data:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    # AFC users can only see their own company's shipments
    if claims.is_afc() and shipment_data.get("company_id") != claims.company_id:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    nodes = _parse_jsonb(shipment_data.get("route_nodes")) or []

    # Derive from origin/destination if no saved route nodes
    if not nodes:
        nodes = _derive_route_nodes(shipment_data)

    # Enrich with port details
    nodes = _enrich_route_nodes(conn, nodes)

    # Enrich ORIGIN/DESTINATION timing from TRACKED tasks (defense-in-depth)
    # This ensures route node display is always consistent with task data,
    # even if a write-time sync was missed.
    wf_row = conn.execute(text("""
        SELECT workflow_tasks FROM shipment_workflows WHERE order_id = :id
    """), {"id": shipment_id}).fetchone()
    if wf_row:
        wf_tasks = _parse_jsonb(wf_row[0]) or []
        pol_task = next(
            (t for t in wf_tasks if t.get("task_type") == "POL" and t.get("mode") == "TRACKED"),
            None,
        )
        pod_task = next(
            (t for t in wf_tasks if t.get("task_type") == "POD" and t.get("mode") == "TRACKED"),
            None,
        )
        for node in nodes:
            if node.get("role") == "ORIGIN" and pol_task:
                # Always overwrite from task — task is source of truth for actual timing
                if pol_task.get("actual_start"):
                    node["actual_eta"] = pol_task["actual_start"]
                if pol_task.get("actual_end"):
                    node["actual_etd"] = pol_task["actual_end"]
            elif node.get("role") == "DESTINATION" and pod_task:
                if pod_task.get("actual_start"):
                    node["actual_eta"] = pod_task["actual_start"]

    return {
        "shipment_id": shipment_id,
        "route_nodes": nodes,
        "derived": not bool(shipment_data.get("route_nodes")),
    }


# ---------------------------------------------------------------------------
# PUT /shipments/{shipment_id}/route-nodes
# ---------------------------------------------------------------------------

class RouteNodeInput(BaseModel):
    port_un_code: str
    port_name: str
    role: str
    scheduled_eta: Optional[str] = None
    actual_eta: Optional[str] = None
    scheduled_etd: Optional[str] = None
    actual_etd: Optional[str] = None


@router.put("/{shipment_id}/route-nodes")
async def save_route_nodes(
    shipment_id: str,
    nodes: list[RouteNodeInput],
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """Replace route nodes array on a shipment. AFU + AFC Admin/Manager only."""
    # Permission check
    if claims.is_afc():
        if claims.role not in ("AFC-ADMIN", "AFC-M"):
            raise HTTPException(status_code=403, detail="Only admin/manager can update route nodes")

    # Verify shipment exists
    row = conn.execute(text("""
        SELECT order_id FROM orders WHERE order_id = :id
    """), {"id": shipment_id}).fetchone()

    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    # Validate roles
    roles = [n.role for n in nodes]
    if roles.count("ORIGIN") != 1:
        raise HTTPException(status_code=400, detail="Exactly one ORIGIN node required")
    if roles.count("DESTINATION") != 1:
        raise HTTPException(status_code=400, detail="Exactly one DESTINATION node required")
    for r in roles:
        if r not in ("ORIGIN", "TRANSHIP", "DESTINATION"):
            raise HTTPException(status_code=400, detail=f"Invalid role: {r}")

    # Build node dicts and assign sequences
    node_dicts = [n.dict() for n in nodes]
    node_dicts = _assign_sequences(node_dicts)

    # Sync flat ETD/ETA from ORIGIN and DESTINATION nodes
    flat_etd = None
    flat_eta = None
    for nd in node_dicts:
        if nd["role"] == "ORIGIN" and nd.get("scheduled_etd"):
            flat_etd = nd["scheduled_etd"]
        if nd["role"] == "DESTINATION" and nd.get("scheduled_eta"):
            flat_eta = nd["scheduled_eta"]

    now = datetime.now(timezone.utc).isoformat()

    sd_clauses = ["route_nodes = CAST(:route_nodes AS jsonb)"]
    params: dict = {"route_nodes": json.dumps(node_dicts), "now": now, "id": shipment_id}
    bind_params = [bindparam("route_nodes", type_=String())]

    if flat_etd is not None:
        sd_clauses.append("etd = :etd")
        params["etd"] = flat_etd
    if flat_eta is not None:
        sd_clauses.append("eta = :eta")
        params["eta"] = flat_eta

    conn.execute(text(f"""
        UPDATE shipment_details SET {', '.join(sd_clauses)} WHERE order_id = :id
    """).bindparams(*bind_params), params)
    conn.execute(text("""
        UPDATE orders SET updated_at = :now WHERE order_id = :id
    """), params)

    # Enrich for response
    node_dicts = _enrich_route_nodes(conn, node_dicts)

    # Log
    _log_system_action_pg(conn, "ROUTE_NODES_UPDATED", shipment_id, claims.uid, claims.email)

    return {
        "shipment_id": shipment_id,
        "route_nodes": node_dicts,
    }


# ---------------------------------------------------------------------------
# PATCH /shipments/{shipment_id}/route-nodes/{sequence}
# ---------------------------------------------------------------------------

class RouteNodeTimingUpdate(BaseModel):
    scheduled_eta: Optional[str] = None
    actual_eta: Optional[str] = None
    scheduled_etd: Optional[str] = None
    actual_etd: Optional[str] = None


@router.patch("/{shipment_id}/route-nodes/{sequence}")
async def update_route_node_timing(
    shipment_id: str,
    sequence: int,
    body: RouteNodeTimingUpdate,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """Update timing on a single route node by sequence number."""
    # Permission check
    if claims.is_afc():
        if claims.role not in ("AFC-ADMIN", "AFC-M"):
            raise HTTPException(status_code=403, detail="Only admin/manager can update route nodes")

    row = conn.execute(text("""
        SELECT route_nodes FROM shipment_details WHERE order_id = :id
    """), {"id": shipment_id}).fetchone()

    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    nodes = _parse_jsonb(row[0]) or []
    if not nodes:
        raise HTTPException(status_code=400, detail="No route nodes saved — use PUT to initialize first")

    # Find node by sequence
    target = None
    for nd in nodes:
        if nd.get("sequence") == sequence:
            target = nd
            break

    if target is None:
        raise NotFoundError(f"Route node with sequence {sequence} not found")

    # Apply timing updates
    if body.scheduled_eta is not None:
        target["scheduled_eta"] = body.scheduled_eta
    if body.actual_eta is not None:
        target["actual_eta"] = body.actual_eta
    if body.scheduled_etd is not None:
        target["scheduled_etd"] = body.scheduled_etd
    if body.actual_etd is not None:
        target["actual_etd"] = body.actual_etd

    # Build update
    sd_clauses = ["route_nodes = CAST(:route_nodes AS jsonb)"]
    params: dict = {"route_nodes": json.dumps(nodes), "now": datetime.now(timezone.utc).isoformat(), "id": shipment_id}
    bind_params = [bindparam("route_nodes", type_=String())]

    # Sync flat fields if ORIGIN or DESTINATION
    if target.get("role") == "ORIGIN" and body.scheduled_etd is not None:
        sd_clauses.append("etd = :etd")
        params["etd"] = body.scheduled_etd
    if target.get("role") == "DESTINATION" and body.scheduled_eta is not None:
        sd_clauses.append("eta = :eta")
        params["eta"] = body.scheduled_eta

    conn.execute(text(f"""
        UPDATE shipment_details SET {', '.join(sd_clauses)} WHERE order_id = :id
    """).bindparams(*bind_params), params)
    conn.execute(text("""
        UPDATE orders SET updated_at = :now WHERE order_id = :id
    """), params)

    # --- Auto status progression (forward only) ---
    auto_status_changed = False
    new_status = None

    if body.actual_etd is not None and target.get("role") == "ORIGIN":
        # ATD set on ORIGIN → auto-advance to Departed (4001)
        cur = conn.execute(
            text("""
                SELECT o.status, sd.status_history
                FROM orders o
                JOIN shipment_details sd ON sd.order_id = o.order_id
                WHERE o.order_id = :id
            """),
            {"id": shipment_id},
        ).fetchone()
        if cur and (cur[0] or 0) < constants.STATUS_DEPARTED:
            new_status = constants.STATUS_DEPARTED
            history = _parse_jsonb(cur[1]) or []
            history.append({
                "status": new_status,
                "label": constants.STATUS_LABELS[new_status],
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "changed_by": claims.email,
                "note": "Auto-advanced from ATD",
            })
            _now = datetime.now(timezone.utc).isoformat()
            conn.execute(text("""
                UPDATE orders
                SET status = :status, updated_at = :now
                WHERE order_id = :id
            """), {"status": new_status, "now": _now, "id": shipment_id})
            conn.execute(text("""
                UPDATE shipment_details
                SET status_history = CAST(:history AS jsonb)
                WHERE order_id = :id
            """).bindparams(bindparam("history", type_=String())), {"history": json.dumps(history), "id": shipment_id})
            _log_system_action_pg(conn, "AUTO_STATUS_DEPARTED", shipment_id, claims.uid, claims.email)
            auto_status_changed = True
            logger.info("[route-nodes] Auto-advanced %s to Departed (4001)", shipment_id)

    elif body.actual_eta is not None and target.get("role") == "DESTINATION":
        # ATA set on DESTINATION → auto-advance to Arrived (4002)
        cur = conn.execute(
            text("""
                SELECT o.status, sd.status_history
                FROM orders o
                JOIN shipment_details sd ON sd.order_id = o.order_id
                WHERE o.order_id = :id
            """),
            {"id": shipment_id},
        ).fetchone()
        if cur and (cur[0] or 0) < constants.STATUS_ARRIVED:
            new_status = constants.STATUS_ARRIVED
            history = _parse_jsonb(cur[1]) or []
            history.append({
                "status": new_status,
                "label": constants.STATUS_LABELS[new_status],
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "changed_by": claims.email,
                "note": "Auto-advanced from ATA",
            })
            _now = datetime.now(timezone.utc).isoformat()
            conn.execute(text("""
                UPDATE orders
                SET status = :status, updated_at = :now
                WHERE order_id = :id
            """), {"status": new_status, "now": _now, "id": shipment_id})
            conn.execute(text("""
                UPDATE shipment_details
                SET status_history = CAST(:history AS jsonb)
                WHERE order_id = :id
            """).bindparams(bindparam("history", type_=String())), {"history": json.dumps(history), "id": shipment_id})
            _log_system_action_pg(conn, "AUTO_STATUS_ARRIVED", shipment_id, claims.uid, claims.email)
            auto_status_changed = True
            logger.info("[route-nodes] Auto-advanced %s to Arrived (4002)", shipment_id)

    return {
        "shipment_id": shipment_id,
        "node": target,
        "auto_status_changed": auto_status_changed,
        "new_status": new_status,
    }
