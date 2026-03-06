"""
routers/shipments/core.py

Core shipment endpoints: stats, search, list, get single, status-history,
create manual, delete.

NOTE: get_file_tags (GET /file-tags) is registered here rather than in files.py
to ensure it is added to the router BEFORE GET /{shipment_id}, preserving
FastAPI's route matching priority (static routes before parameterised).
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

from core.auth import Claims, require_auth, require_afu, require_afu_admin
from core.db import get_db
from core import db_queries
from core.exceptions import NotFoundError
from core.constants import (
    AFC_ADMIN,
    AFC_M,
    STATUS_CONFIRMED,
    STATUS_LABELS,
    STATUS_DRAFT,
    STATUS_DRAFT_REVIEW,
    PREFIX_V2_SHIPMENT,
    PREFIX_V1_SHIPMENT,
)
from logic.incoterm_tasks import generate_tasks as generate_incoterm_tasks

from ._helpers import _parse_jsonb
from ._status_helpers import _log_system_action_pg

logger = logging.getLogger(__name__)

router = APIRouter(redirect_slashes=False)


# ---------------------------------------------------------------------------
# S1 — Shipment stats
# ---------------------------------------------------------------------------

@router.get("/stats")
async def get_shipment_stats(
    company_id: Optional[str] = Query(None, description="Filter by company (AFC users)"),
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """
    Return shipment counts for the dashboard KPI cards and tab badges.
    """
    # AFC users can only see their own company — enforce this regardless of query param
    effective_company_id = None
    if claims.is_afc():
        effective_company_id = claims.company_id
    elif company_id:
        effective_company_id = company_id

    stats = db_queries.get_shipment_stats(conn, effective_company_id)

    return {"status": "OK", "data": stats, "msg": "Shipment stats fetched"}


# ---------------------------------------------------------------------------
# Search shipments — SQL ILIKE
# ---------------------------------------------------------------------------

@router.get("/search")
async def search_shipments(
    q: str = Query(..., min_length=3),
    limit: int = Query(8, ge=1, le=50),
    offset: int = Query(0, ge=0),
    search_fields: str = Query("id"),  # "id" or "all"
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """
    Search shipments by partial ID, company name, or route port codes.
    """
    q_lower = q.strip().lower()
    q_upper = q.strip().upper()

    # AFC users scoped to own company
    effective_company_id = None
    if claims.is_afc():
        effective_company_id = claims.company_id

    # Extract numeric portion for ID matching (e.g. "3780" or "AFCQ-003780")
    q_digits = "".join(c for c in q if c.isdigit())

    if search_fields == "all":
        # Full search across id, company name, ports
        items = db_queries.search_shipments(conn, q, effective_company_id, limit, offset)
    else:
        # ID-only search
        params: dict = {"q": f"%{q}%", "limit": limit, "offset": offset}
        where = "o.trash = FALSE"
        if effective_company_id:
            where += " AND o.company_id = :company_id"
            params["company_id"] = effective_company_id

        rows = conn.execute(text(f"""
            SELECT o.order_id AS shipment_id, 2 AS data_version, o.migrated_from_v1,
                   o.status, sd.order_type_detail, sd.transaction_type, sd.incoterm_code AS incoterm,
                   sd.origin_port, sd.dest_port AS destination_port,
                   o.company_id, c.name AS company_name,
                   sd.cargo_ready_date::text, o.updated_at::text AS updated
            FROM orders o
            JOIN shipment_details sd ON sd.order_id = o.order_id
            LEFT JOIN companies c ON c.id = o.company_id
            WHERE {where}
              AND o.order_id ILIKE :q
            ORDER BY o.updated_at DESC
            LIMIT :limit OFFSET :offset
        """), params).fetchall()

        items = []
        for r in rows:
            items.append({
                "shipment_id": r[0],
                "data_version": r[1],
                "migrated_from_v1": r[2] or False,
                "status": r[3],
                "status_label": STATUS_LABELS.get(r[3], str(r[3])),
                "order_type": r[4] or "",
                "transaction_type": r[5] or "",
                "incoterm": r[6] or "",
                "origin_port": r[7] or "",
                "destination_port": r[8] or "",
                "company_id": r[9] or "",
                "company_name": r[10] or "",
                "cargo_ready_date": (r[11] or "")[:10] if r[11] else "",
                "updated": (r[12] or "")[:10] if r[12] else "",
            })

    # Add status_label to each result (may already be set by search_shipments)
    for s in items:
        if "status_label" not in s:
            s["status_label"] = STATUS_LABELS.get(s.get("status", 0), str(s.get("status", 0)))

    # Approximate total: if we got a full page, there may be more
    total = offset + len(items)
    next_cursor = str(offset + limit) if len(items) == limit else None

    return {"results": items[:limit], "total": total, "next_cursor": next_cursor}


def _id_matches(shipment_id: str, q_lower: str, q_upper: str, q_digits: str) -> bool:
    """Check if a shipment ID matches the search query."""
    sid_lower = shipment_id.lower()
    # Exact full ID match (e.g. "AFCQ-003780")
    if q_lower == sid_lower or q_upper == shipment_id.upper():
        return True
    # Partial match on the full ID string
    if q_lower in sid_lower:
        return True
    # Numeric portion match (e.g. "3780" matches "AFCQ-003780")
    if q_digits:
        sid_parts = shipment_id.rsplit("-", 1)
        if len(sid_parts) == 2:
            try:
                sid_num = str(int(sid_parts[1]))  # strip leading zeros
                if q_digits in sid_num:
                    return True
            except ValueError:
                pass
    return False


# ---------------------------------------------------------------------------
# List shipments — paginated, with tab filter
# ---------------------------------------------------------------------------

_DRAFT_STATUSES = frozenset({STATUS_DRAFT, STATUS_DRAFT_REVIEW})
_VALID_TABS = {"all", "active", "completed", "to_invoice", "draft", "cancelled"}


def _fmt_date(val) -> str:
    """Coerce a value to YYYY-MM-DD string."""
    if val is None:
        return ""
    s = str(val).strip()
    return s[:10] if s else ""


async def list_shipments(
    tab: str = Query("active", description="active | completed | to_invoice | draft | cancelled | all"),
    company_id: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """
    List shipments with tab-based filtering and offset pagination.
    """
    logger.info(f"[list] tab received: '{tab}' repr: {repr(tab)}")

    if tab not in _VALID_TABS:
        raise HTTPException(status_code=400, detail=f"Unrecognised tab value: {tab}")

    # AFC users always scoped to own company; AFU can optionally filter
    effective_company_id = None
    if claims.is_afc():
        effective_company_id = claims.company_id
    elif company_id:
        effective_company_id = company_id

    items, total = db_queries.list_shipments(conn, tab, effective_company_id, limit, offset)

    next_cursor = str(offset + limit) if (offset + limit) < total else None

    return {
        "shipments": items,
        "next_cursor": next_cursor,
        "total": total,
        "total_shown": len(items),
    }


# ---------------------------------------------------------------------------
# Status history — read from shipment_workflows
# ---------------------------------------------------------------------------

@router.get("/{shipment_id}/status-history")
async def get_status_history(
    shipment_id: str,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """
    Return the status change history for a shipment.

    Reads from shipment_workflows.status_history. Records created before
    this feature was added will have an empty history array.
    """
    row = conn.execute(text("""
        SELECT sw.status_history, sw.company_id
        FROM shipment_workflows sw
        WHERE sw.order_id = :id
    """), {"id": shipment_id}).fetchone()

    if not row:
        raise NotFoundError(f"Shipment workflow {shipment_id} not found")

    # AFC users: verify company ownership via the workflow's company_id
    if claims.is_afc():
        wf_company = row[1] or ""
        if wf_company != claims.company_id:
            raise NotFoundError(f"Shipment workflow {shipment_id} not found")

    history = _parse_jsonb(row[0]) or []
    # Ensure sorted by timestamp ascending
    history = sorted(history, key=lambda h: h.get("timestamp", ""))

    return {"status": "OK", "history": history}


# ---------------------------------------------------------------------------
# Lazy-init workflow tasks helper (PostgreSQL version)
# ---------------------------------------------------------------------------

def _lazy_init_tasks_pg(conn, shipment_id: str, shipment_data: dict) -> list[dict]:
    """
    Check if shipment_workflows has workflow_tasks. If empty, auto-generate
    from incoterm + transaction_type and persist. Returns the task list.
    """
    from datetime import date as _date

    row = conn.execute(text("""
        SELECT workflow_tasks
        FROM shipment_workflows
        WHERE order_id = :id
    """), {"id": shipment_id}).fetchone()

    if not row:
        return []

    existing_tasks = _parse_jsonb(row[0]) or []
    if existing_tasks:
        return existing_tasks

    # Need both incoterm and transaction_type to generate
    incoterm = shipment_data.get("incoterm_code") or ""
    txn_type = shipment_data.get("transaction_type") or ""

    if not incoterm or not txn_type:
        return []

    # Parse date fields for due date calculation
    def _parse_date(val) -> _date | None:
        if not val:
            return None
        if isinstance(val, _date):
            return val
        try:
            return _date.fromisoformat(str(val)[:10])
        except (ValueError, TypeError):
            return None

    cargo_ready_date = _parse_date(shipment_data.get("cargo_ready_date"))

    tasks = generate_incoterm_tasks(
        incoterm=incoterm,
        transaction_type=txn_type,
        etd=None,
        eta=None,
        cargo_ready_date=cargo_ready_date,
        updated_by="system",
    )

    if tasks:
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(text("""
            UPDATE shipment_workflows
            SET workflow_tasks = cast(:tasks as jsonb), updated_at = :now
            WHERE order_id = :id
        """), {"tasks": json.dumps(tasks), "now": now, "id": shipment_id})

    return tasks


# ---------------------------------------------------------------------------
# GET /file-tags
# Registered here (before /{shipment_id}) to ensure route priority.
# ---------------------------------------------------------------------------

@router.get("/file-tags")
async def get_file_tags(
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """Return all file tags from file_tags table."""
    rows = conn.execute(text("SELECT id, label, color FROM file_tags")).fetchall()
    results = []
    for r in rows:
        results.append({
            "tag_id": r[0],
            "name": r[1] or "",
            "color": r[2] or "",
        })
    return {"status": "OK", "data": results}


# ---------------------------------------------------------------------------
# Get single shipment by ID
# ---------------------------------------------------------------------------

@router.get("/{shipment_id}")
async def get_shipment(
    shipment_id: str,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """
    Get a single shipment by ID.

    AF-XXXXX   -> V2 record
    AF2-XXXXX  -> V2 record (legacy prefix, same as AF-)
    AFCQ-XXXXX -> resolves to migrated AF- record
    """
    if shipment_id.startswith(PREFIX_V2_SHIPMENT) or shipment_id.startswith("AF2-"):
        # V2 — read from shipments table
        data = db_queries.get_shipment_by_id(conn, shipment_id)
        if not data:
            raise NotFoundError(f"Shipment {shipment_id} not found")

        if claims.is_afc() and data.get("company_id") != claims.company_id:
            raise NotFoundError(f"Shipment {shipment_id} not found")

        data["workflow_tasks"] = _lazy_init_tasks_pg(conn, shipment_id, data)

        return {"status": "OK", "data": data, "msg": "Shipment fetched"}

    elif shipment_id.startswith(PREFIX_V1_SHIPMENT):
        # AFCQ- request -> resolve to migrated AF- record
        af_id = f"AF-{shipment_id[5:]}"
        data = db_queries.get_shipment_by_id(conn, af_id)
        if data:
            if claims.is_afc() and data.get("company_id") != claims.company_id:
                raise NotFoundError(f"Shipment {shipment_id} not found")
            data["workflow_tasks"] = _lazy_init_tasks_pg(conn, af_id, data)
            return {"status": "OK", "data": data, "msg": "Shipment fetched (migrated)"}

        raise NotFoundError(f"Shipment {shipment_id} not found")

    else:
        raise NotFoundError(f"Invalid shipment ID format: {shipment_id}")


# ---------------------------------------------------------------------------
# Create shipment (V2 — manual entry)
# ---------------------------------------------------------------------------

class CreateManualShipmentRequest(BaseModel):
    order_type: str                          # SEA_FCL | SEA_LCL | AIR
    transaction_type: str                    # IMPORT | EXPORT | DOMESTIC
    company_id: str
    origin_port_un_code: str
    origin_terminal_id: str | None = None
    origin_label: str | None = None
    destination_port_un_code: str
    destination_terminal_id: str | None = None
    destination_label: str | None = None
    incoterm_code: str
    cargo_description: str = "General Cargo"
    cargo_hs_code: str | None = None
    cargo_is_dg: bool = False
    containers: list | None = None           # SEA_FCL: [{container_size, container_type, quantity}]
    packages: list | None = None             # SEA_LCL / AIR: [{packaging_type, quantity, gross_weight_kg, volume_cbm}]
    shipper: dict | None = None              # {name, address, contact_person, phone, email, company_id, company_contact_id}
    consignee: dict | None = None
    notify_party: dict | None = None
    cargo_ready_date: str | None = None
    etd: str | None = None
    eta: str | None = None
    is_test: bool = False
    initial_status: str | None = None  # 'draft' | 'confirmed' — AFU only, defaults to 'draft'


async def create_shipment_manual(
    body: CreateManualShipmentRequest,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    """
    Create a new V2 ShipmentOrder (manual entry).
    Replaces the old Datastore-based createShipmentOrder() in shipments-write.ts.
    """
    # 1. Validate required fields
    if body.order_type not in ("SEA_FCL", "SEA_LCL", "AIR"):
        raise HTTPException(status_code=400, detail="order_type must be SEA_FCL, SEA_LCL, or AIR")
    if body.transaction_type not in ("IMPORT", "EXPORT", "DOMESTIC"):
        raise HTTPException(status_code=400, detail="transaction_type must be IMPORT, EXPORT, or DOMESTIC")
    if not body.company_id:
        raise HTTPException(status_code=400, detail="company_id is required")
    if not body.origin_port_un_code:
        raise HTTPException(status_code=400, detail="origin_port_un_code is required")
    if not body.destination_port_un_code:
        raise HTTPException(status_code=400, detail="destination_port_un_code is required")
    if not body.incoterm_code:
        raise HTTPException(status_code=400, detail="incoterm_code is required")

    # 2. Validate company exists
    company_row = conn.execute(text("SELECT id FROM companies WHERE id = :id"), {"id": body.company_id}).fetchone()
    if not company_row:
        raise HTTPException(status_code=404, detail=f"Company {body.company_id} not found")

    now = datetime.now(timezone.utc).isoformat()

    # 3. Generate shipment ID
    shipment_id, new_countid = db_queries.next_shipment_id(conn)

    # 4. Build origin/destination JSONB
    origin = {
        "type": "PORT",
        "port_un_code": body.origin_port_un_code,
        "terminal_id": body.origin_terminal_id,
        "city_id": None,
        "address": None,
        "country_code": None,
        "label": body.origin_label or body.origin_port_un_code,
    }
    destination = {
        "type": "PORT",
        "port_un_code": body.destination_port_un_code,
        "terminal_id": body.destination_terminal_id,
        "city_id": None,
        "address": None,
        "country_code": None,
        "label": body.destination_label or body.destination_port_un_code,
    }

    # 5. Build cargo JSONB
    cargo = {
        "description": body.cargo_description or "General Cargo",
        "hs_code": body.cargo_hs_code,
        "is_dg": body.cargo_is_dg,
        "dg_class": None,
        "dg_un_number": None,
    }

    # 6. Build type_details JSONB
    if body.order_type == "SEA_FCL":
        type_details = {"type": "SEA_FCL", "containers": body.containers or []}
    else:
        type_details = {"type": body.order_type, "packages": body.packages or []}

    # 7. Build parties JSONB
    parties = {}
    if body.shipper:
        parties["shipper"] = body.shipper
    if body.consignee:
        parties["consignee"] = body.consignee
    if body.notify_party:
        parties["notify_party"] = body.notify_party

    # 8. Initial status
    allowed_create_statuses = {'draft', 'confirmed'}
    requested = (body.initial_status or 'draft').lower()
    if requested not in allowed_create_statuses:
        requested = 'draft'

    if requested == 'confirmed':
        str_status = 'confirmed'
        str_sub_status = 'confirmed'
        status_label = 'Confirmed'
    else:
        str_status = 'draft'
        str_sub_status = None
        status_label = 'Draft'

    # 9. Status history
    initial_history = [{
        "status": str_status,
        "label": status_label,
        "timestamp": now,
        "changed_by": claims.email,
        "note": "Manually created",
    }]

    # 10. Creator
    creator = {"uid": claims.uid, "email": claims.email}

    # 11a. INSERT into orders
    conn.execute(text("""
        INSERT INTO orders (
            order_id, order_type, countid, company_id,
            status, sub_status, issued_invoice,
            cargo, parties, scope,
            trash, created_by, created_at, updated_at,
            migrated_from_v1, completed, is_test
        ) VALUES (
            :id, 'shipment', :countid, :company_id,
            :status, :sub_status, FALSE,
            CAST(:cargo AS jsonb), CAST(:parties AS jsonb), NULL,
            FALSE, CAST(:creator AS jsonb), :now, :now,
            FALSE, FALSE, :is_test
        )
    """), {
        "id": shipment_id,
        "countid": new_countid,
        "company_id": body.company_id,
        "status": str_status,
        "sub_status": str_sub_status,
        "now": now,
        "cargo": json.dumps(cargo),
        "parties": json.dumps(parties),
        "creator": json.dumps(creator),
        "is_test": body.is_test,
    })

    # 11b. INSERT into shipment_details
    conn.execute(text("""
        INSERT INTO shipment_details (
            order_id, incoterm_code, transaction_type, order_type_detail,
            origin_port, origin_terminal, dest_port, dest_terminal,
            type_details, bl_document, exception_data, route_nodes,
            status_history, cargo_ready_date
        ) VALUES (
            :id, :incoterm_code, :transaction_type, :order_type_detail,
            :origin_port, :origin_terminal, :dest_port, :dest_terminal,
            CAST(:type_details AS jsonb), NULL, NULL, NULL,
            CAST(:status_history AS jsonb), :cargo_ready_date
        )
    """), {
        "id": shipment_id,
        "incoterm_code": body.incoterm_code,
        "transaction_type": body.transaction_type,
        "order_type_detail": body.order_type,
        "origin_port": body.origin_port_un_code,
        "origin_terminal": body.origin_terminal_id,
        "dest_port": body.destination_port_un_code,
        "dest_terminal": body.destination_terminal_id,
        "type_details": json.dumps(type_details),
        "status_history": json.dumps(initial_history),
        "cargo_ready_date": body.cargo_ready_date,
    })

    # 12. Auto-generate tasks
    from datetime import date as _date
    etd_date = None
    if body.etd:
        try:
            etd_date = _date.fromisoformat(body.etd[:10])
        except (ValueError, TypeError):
            pass

    tasks = generate_incoterm_tasks(
        incoterm=body.incoterm_code,
        transaction_type=body.transaction_type,
        etd=etd_date,
        updated_by=claims.email,
    )

    # Seed POL/POD task timing from request (single source of truth)
    for task in tasks:
        if task.get("mode") == "TRACKED":
            if task.get("task_type") == "POL" and body.etd:
                task["scheduled_end"] = body.etd
            elif task.get("task_type") == "POD" and body.eta:
                task["scheduled_start"] = body.eta

    # 13. Workflow history
    wf_history = [{
        "status": str_status,
        "status_label": status_label,
        "timestamp": now,
        "changed_by": claims.uid,
    }]

    # 14. INSERT into shipment_workflows
    conn.execute(text("""
        INSERT INTO shipment_workflows (
            order_id, company_id, status_history, workflow_tasks,
            completed, created_at, updated_at
        ) VALUES (
            :order_id, :company_id, CAST(:status_history AS jsonb), CAST(:workflow_tasks AS jsonb),
            FALSE, :now, :now
        )
    """), {
        "order_id": shipment_id,
        "company_id": body.company_id,
        "status_history": json.dumps(wf_history),
        "workflow_tasks": json.dumps(tasks),
        "now": now,
    })

    # 15. Log
    _log_system_action_pg(conn, "SHIPMENT_CREATED_MANUAL", shipment_id, claims.uid, claims.email)

    logger.info("Shipment %s created manually by %s", shipment_id, claims.uid)

    # 16. Return
    return {
        "status": "OK",
        "data": {"shipment_id": shipment_id},
        "msg": "Shipment created",
    }


# ---------------------------------------------------------------------------
# PATCH /shipments/{shipment_id}/cargo — Update DG status
# ---------------------------------------------------------------------------

class PatchCargoRequest(BaseModel):
    is_dg: bool
    dg_description: Optional[str] = None


@router.patch("/{shipment_id}/cargo")
async def update_shipment_cargo(
    shipment_id: str,
    body: PatchCargoRequest,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    """Update is_dg and dg_description on the shipment cargo JSON."""
    row = conn.execute(
        text("SELECT cargo FROM orders WHERE order_id = :id AND trash = FALSE"),
        {"id": shipment_id},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Shipment not found")

    cargo = dict(row[0]) if row[0] else {}
    cargo["is_dg"] = body.is_dg
    if body.dg_description is not None:
        cargo["dg_description"] = body.dg_description
    elif not body.is_dg:
        cargo.pop("dg_description", None)

    conn.execute(
        text("UPDATE orders SET cargo = :cargo, updated_at = NOW() WHERE order_id = :id"),
        {"cargo": json.dumps(cargo), "id": shipment_id},
    )
    conn.commit()
    return {"status": "OK", "data": {"is_dg": body.is_dg}}


# ---------------------------------------------------------------------------
# PATCH /shipments/{shipment_id}/port — Update origin or destination port
# ---------------------------------------------------------------------------

_VALID_PORT_FIELDS = ["origin_port_un_code", "destination_port_un_code"]


class UpdatePortRequest(BaseModel):
    field: str   # 'origin_port_un_code' or 'destination_port_un_code'
    port_un_code: str
    terminal_id: str | None = None


@router.patch("/{shipment_id}/port")
async def update_shipment_port(
    shipment_id: str,
    body: UpdatePortRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Update origin or destination port code on a shipment."""
    if body.field not in _VALID_PORT_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid field. Must be one of: {', '.join(_VALID_PORT_FIELDS)}",
        )
    if not body.port_un_code.strip():
        raise HTTPException(status_code=400, detail="port_un_code is required")

    port_code = body.port_un_code.strip().upper()

    row = conn.execute(
        text("""
            SELECT o.order_id, sd.route_nodes
            FROM orders o
            JOIN shipment_details sd ON sd.order_id = o.order_id
            WHERE o.order_id = :id AND o.trash = FALSE
        """),
        {"id": shipment_id},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Shipment not found")

    now = datetime.now(timezone.utc).isoformat()

    # Map field name to flat column
    col = "origin_port" if body.field == "origin_port_un_code" else "dest_port"
    terminal_col = "origin_terminal" if body.field == "origin_port_un_code" else "dest_terminal"
    terminal_val = body.terminal_id.strip() if body.terminal_id else None

    conn.execute(
        text(f"UPDATE shipment_details SET {col} = :port, {terminal_col} = :terminal WHERE order_id = :id"),
        {"port": port_code, "terminal": terminal_val, "id": shipment_id},
    )
    conn.execute(
        text("UPDATE orders SET updated_at = :now WHERE order_id = :id"),
        {"now": now, "id": shipment_id},
    )

    # Also update the corresponding route node if present
    nodes = _parse_jsonb(row[1]) or []
    if isinstance(nodes, list):
        node_role = "ORIGIN" if body.field == "origin_port_un_code" else "DESTINATION"
        changed = False
        for node in nodes:
            if node.get("role") == node_role:
                node["port_un_code"] = port_code
                changed = True
        if changed:
            conn.execute(
                text("UPDATE shipment_details SET route_nodes = CAST(:rn AS jsonb) WHERE order_id = :id"),
                {"rn": json.dumps(nodes), "id": shipment_id},
            )

    _log_system_action_pg(conn, "SHIPMENT_PORT_UPDATED", shipment_id, claims.uid, claims.email)
    return {"status": "OK"}


# ---------------------------------------------------------------------------
# Update incoterm
# ---------------------------------------------------------------------------

class UpdateIncotermRequest(BaseModel):
    incoterm_code: str | None = None  # None to clear


@router.patch("/{shipment_id}/incoterm")
async def update_incoterm(
    shipment_id: str,
    body: UpdateIncotermRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Update incoterm on a shipment. AFU only."""
    row = conn.execute(text("""
        SELECT order_id FROM orders WHERE order_id = :id
    """), {"id": shipment_id}).fetchone()

    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    now = datetime.now(timezone.utc).isoformat()
    conn.execute(text("""
        UPDATE shipment_details SET incoterm_code = :incoterm_code
        WHERE order_id = :id
    """), {
        "incoterm_code": body.incoterm_code,
        "id": shipment_id,
    })
    conn.execute(text("""
        UPDATE orders SET updated_at = :now WHERE order_id = :id
    """), {"now": now, "id": shipment_id})

    _log_system_action_pg(conn, "INCOTERM_UPDATED", shipment_id, claims.uid, claims.email)
    return {"status": "OK", "msg": "Incoterm updated"}


# ---------------------------------------------------------------------------
# Delete shipment (soft + hard)
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# PATCH /shipments/{shipment_id}/booking — Update booking / transport fields
# ---------------------------------------------------------------------------

class UpdateBookingRequest(BaseModel):
    # Sea fields (stored in booking JSONB)
    booking_reference: Optional[str] = None
    carrier_agent: Optional[str] = None
    vessel_name: Optional[str] = None
    voyage_number: Optional[str] = None
    # Air fields — flat columns on shipments table
    mawb_number: Optional[str] = None
    hawb_number: Optional[str] = None
    awb_type: Optional[str] = None
    # Air fields — stored in booking JSONB
    flight_number: Optional[str] = None
    flight_date: Optional[str] = None  # YYYY-MM-DD


@router.patch("/{shipment_id}/booking")
async def update_booking(
    shipment_id: str,
    body: UpdateBookingRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Update booking / transport fields on a shipment. AFU only."""
    # 1. Fetch shipment
    row = conn.execute(text("""
        SELECT sd.order_id, sd.booking FROM shipment_details sd
        JOIN orders o ON o.order_id = sd.order_id
        WHERE sd.order_id = :id AND o.trash = FALSE
    """), {"id": shipment_id}).fetchone()
    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    now = datetime.now(timezone.utc).isoformat()

    # 2. Update booking JSONB fields (sea + flight)
    booking_jsonb_fields = {
        "booking_reference": body.booking_reference,
        "carrier_agent": body.carrier_agent,
        "vessel_name": body.vessel_name,
        "voyage_number": body.voyage_number,
        "flight_number": body.flight_number,
        "flight_date": body.flight_date,
    }

    # Check which fields were explicitly sent
    sent_fields = body.__fields_set__
    jsonb_updates = {k: v for k, v in booking_jsonb_fields.items() if k in sent_fields}

    if jsonb_updates:
        booking = _parse_jsonb(row[1]) or {}
        if not isinstance(booking, dict):
            booking = {}
        for key, val in jsonb_updates.items():
            if val == "":
                booking[key] = None
            else:
                booking[key] = val
        conn.execute(text("""
            UPDATE shipment_details SET booking = CAST(:booking AS jsonb)
            WHERE order_id = :id
        """), {"booking": json.dumps(booking), "id": shipment_id})

    # 3. Update air flat columns (on shipment_details)
    flat_col_map = {
        "mawb_number": "mawb_number",
        "hawb_number": "hawb_number",
        "awb_type": "awb_type",
    }
    flat_updates = {}
    for field_name, col_name in flat_col_map.items():
        if field_name in sent_fields:
            val = getattr(body, field_name)
            flat_updates[col_name] = None if val == "" else val

    if flat_updates:
        set_clauses = [f"{col} = :{col}" for col in flat_updates]
        params = {**flat_updates, "id": shipment_id}
        conn.execute(text(f"""
            UPDATE shipment_details SET {', '.join(set_clauses)} WHERE order_id = :id
        """), params)

    # Update orders.updated_at
    conn.execute(text("""
        UPDATE orders SET updated_at = :now WHERE order_id = :id
    """), {"now": now, "id": shipment_id})

    # 4. Log + commit
    _log_system_action_pg(conn, "BOOKING_UPDATED", shipment_id, claims.uid, claims.email)
    return {"status": "OK", "msg": "Booking updated"}


# ---------------------------------------------------------------------------
# Delete shipment (soft + hard)
# ---------------------------------------------------------------------------

@router.delete("/{shipment_id}")
async def delete_shipment(
    shipment_id: str,
    hard: bool = Query(False),
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    """
    Delete a shipment. Soft delete by default (sets trash=TRUE).
    Hard delete (permanent row removal) restricted to AFU-Admin.
    """
    # Hard delete is permanent — restricted to AFU-Admin via endpoint auth above

    # Verify shipment exists
    row = conn.execute(text("SELECT order_id, trash FROM orders WHERE order_id = :id"), {"id": shipment_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Shipment {shipment_id} not found")

    now = datetime.now(timezone.utc).isoformat()

    if hard:
        # Hard delete — log BEFORE deletion
        _log_system_action_pg(conn, "SHIPMENT_HARD_DELETED", shipment_id, claims.uid, claims.email)
        conn.execute(text("DELETE FROM shipment_files WHERE order_id = :id"), {"id": shipment_id})
        conn.execute(text("DELETE FROM shipment_workflows WHERE order_id = :id"), {"id": shipment_id})
        conn.execute(text("DELETE FROM shipment_details WHERE order_id = :id"), {"id": shipment_id})
        conn.execute(text("DELETE FROM orders WHERE order_id = :id"), {"id": shipment_id})
        logger.info("Shipment %s hard-deleted by %s", shipment_id, claims.uid)
        return {"deleted": True, "shipment_id": shipment_id, "mode": "hard"}
    else:
        # Soft delete
        if row[1]:  # trash column
            raise HTTPException(status_code=400, detail="Shipment already deleted")

        conn.execute(text("""
            UPDATE orders SET trash = TRUE, updated_at = :now WHERE order_id = :id
        """), {"id": shipment_id, "now": now})

        _log_system_action_pg(conn, "SHIPMENT_SOFT_DELETED", shipment_id, claims.uid, claims.email)
        logger.info("Shipment %s soft-deleted by %s", shipment_id, claims.uid)
        return {"deleted": True, "shipment_id": shipment_id, "mode": "soft"}
