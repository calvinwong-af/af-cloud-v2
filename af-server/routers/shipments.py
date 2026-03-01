"""
routers/shipments.py

Shipment endpoints — V2 only (post-migration).

All shipments are served from the `shipments` PostgreSQL table.
"""

import base64
import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import text

from core.auth import Claims, require_auth, require_afu, require_afu_admin
from logic.incoterm_tasks import (
    generate_tasks as generate_incoterm_tasks,
    migrate_task_on_read,
    PENDING, IN_PROGRESS, COMPLETED, BLOCKED,
    ASSIGNED, TRACKED, IGNORED,
    FREIGHT_BOOKING, EXPORT_CLEARANCE, POL, POD,
)
from core.constants import (
    AFU,
    AFC,
    AFU_ROLES,
    AFC_ADMIN,
    AFC_M,
    AFC_ROLES,
    FILES_BUCKET_NAME,
    STATUS_CONFIRMED,
    STATUS_COMPLETED,
    STATUS_CANCELLED,
    STATUS_DRAFT,
    STATUS_DRAFT_REVIEW,
    STATUS_BOOKING_PENDING,
    STATUS_BOOKING_CONFIRMED,
    STATUS_DEPARTED,
    STATUS_ARRIVED,
    V2_OPERATIONAL_STATUSES,
    STATUS_LABELS,
    PREFIX_V2_SHIPMENT,
    PREFIX_V1_SHIPMENT,
    get_status_path,
    get_status_path_list,
)

from core.db import get_db
from core import db_queries
from core.exceptions import NotFoundError, ForbiddenError

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helper: parse JSONB values that may come back as str or dict
# ---------------------------------------------------------------------------

def _parse_jsonb(val):
    """Parse a JSONB value from the database (may already be dict or str)."""
    if val is None:
        return None
    if isinstance(val, (dict, list)):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except (ValueError, TypeError):
            return val
    return val


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
        items = db_queries.search_shipments(conn, q, effective_company_id, limit)
    else:
        # ID-only search
        params: dict = {"q": f"%{q}%", "limit": limit}
        where = "s.trash = FALSE"
        if effective_company_id:
            where += " AND s.company_id = :company_id"
            params["company_id"] = effective_company_id

        rows = conn.execute(text(f"""
            SELECT s.id AS shipment_id, 2 AS data_version, s.migrated_from_v1,
                   s.status, s.order_type, s.transaction_type, s.incoterm_code AS incoterm,
                   s.origin_port, s.dest_port AS destination_port,
                   s.company_id, c.name AS company_name,
                   s.cargo_ready_date::text, s.updated_at::text AS updated
            FROM shipments s
            LEFT JOIN companies c ON c.id = s.company_id
            WHERE {where}
              AND s.id ILIKE :q
            ORDER BY s.updated_at DESC
            LIMIT :limit
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

    return {"results": items[:limit]}


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


@router.get("")
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
        WHERE sw.shipment_id = :id
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
        WHERE shipment_id = :id
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

    etd = _parse_date(shipment_data.get("etd"))
    eta = _parse_date(shipment_data.get("eta"))
    cargo_ready_date = _parse_date(shipment_data.get("cargo_ready_date"))

    tasks = generate_incoterm_tasks(
        incoterm=incoterm,
        transaction_type=txn_type,
        etd=etd,
        eta=eta,
        cargo_ready_date=cargo_ready_date,
        updated_by="system",
    )

    if tasks:
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(text("""
            UPDATE shipment_workflows
            SET workflow_tasks = cast(:tasks as jsonb), updated_at = :now
            WHERE shipment_id = :id
        """), {"tasks": json.dumps(tasks), "now": now, "id": shipment_id})

    return tasks


# ---------------------------------------------------------------------------
# 1b. GET /file-tags
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
        SELECT status, incoterm_code, transaction_type, status_history
        FROM shipments
        WHERE id = :id
    """), {"id": shipment_id}).fetchone()

    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    # --- b. Current status ---
    current_status = row[0] or 0
    incoterm = row[1] or ""
    txn_type = row[2] or ""
    q_history = _parse_jsonb(row[3]) or []

    # --- c2. Determine incoterm-aware status path ---
    path = get_status_path(incoterm, txn_type) if incoterm and txn_type else "A"
    path_list = get_status_path_list(incoterm, txn_type) if incoterm and txn_type else None

    # --- d. Terminal state protection (skipped for reversion) ---
    if not body.reverted:
        if current_status == STATUS_COMPLETED or current_status == STATUS_CANCELLED:
            return {"status": "ERROR", "msg": "Cannot change status of a completed or cancelled shipment"}

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
            all_codes = [1001, 1002, 2001, 3001, 3002, 4001, 4002, 5001]
            current_ord = all_codes.index(current_status) if current_status in all_codes else -1
            new_ord = all_codes.index(new_status) if new_status in all_codes else -1
            if current_ord >= 0 and new_ord >= 0 and new_ord <= current_ord:
                return {"status": "ERROR", "msg": "Cannot go backwards without revert flag"}
        elif not path_list:
            # Fallback if no incoterm — use simple forward check
            all_codes = [1001, 1002, 2001, 3001, 3002, 4001, 4002, 5001]
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

    # --- g. Write shipment ---
    conn.execute(text("""
        UPDATE shipments
        SET status = :new_status,
            updated_at = :now,
            status_history = CAST(:history AS jsonb)
        WHERE id = :id
    """), {
        "new_status": new_status,
        "now": now,
        "history": json.dumps(new_q_history),
        "id": shipment_id,
    })

    # --- h. Append to shipment_workflows.status_history ---
    wf_row = conn.execute(text("""
        SELECT status_history FROM shipment_workflows WHERE shipment_id = :id
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

        completed_val = None
        if new_status == STATUS_COMPLETED:
            completed_val = True
        elif new_status == STATUS_CANCELLED:
            completed_val = False

        if completed_val is not None:
            conn.execute(text("""
                UPDATE shipment_workflows
                SET status_history = CAST(:history AS jsonb), updated_at = :now, completed = :completed
                WHERE shipment_id = :id
            """), {"history": json.dumps(new_wf_history), "now": now, "completed": completed_val, "id": shipment_id})
        else:
            conn.execute(text("""
                UPDATE shipment_workflows
                SET status_history = CAST(:history AS jsonb), updated_at = :now
                WHERE shipment_id = :id
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
    """Update the issued_invoice flag. AFU staff only. Shipment must be completed (5001)."""
    now = datetime.now(timezone.utc).isoformat()

    row = conn.execute(text("""
        SELECT status FROM shipments WHERE id = :id
    """), {"id": shipment_id}).fetchone()

    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    if row[0] != STATUS_COMPLETED:
        return {"status": "ERROR", "msg": "Invoiced flag can only be set on completed shipments"}

    conn.execute(text("""
        UPDATE shipments SET issued_invoice = :issued_invoice, updated_at = :now WHERE id = :id
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
        SELECT id, company_id FROM shipments WHERE id = :id
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
        UPDATE shipments
        SET exception_data = CAST(:exception AS jsonb), updated_at = :now
        WHERE id = :id
    """), {"exception": json.dumps(exception_data), "now": now, "id": shipment_id})

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
        SELECT id FROM shipments WHERE id = :id
    """), {"id": shipment_id}).fetchone()

    if not shipment_row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    conn.execute(text("""
        UPDATE shipments SET company_id = :company_id, updated_at = :now WHERE id = :id
    """), {"company_id": body.company_id, "now": now, "id": shipment_id})

    logger.info("Reassigned %s to company %s by %s", shipment_id, body.company_id, claims.uid)

    return {
        "status": "OK",
        "data": {"company_id": body.company_id, "company_name": company_name},
        "msg": "Company reassigned",
    }


# ---------------------------------------------------------------------------
# Parse BL — Claude API extraction
# ---------------------------------------------------------------------------

_BL_EXTRACTION_PROMPT = """You are extracting structured data from a Bill of Lading or Sea Waybill.
Return ONLY valid JSON, no preamble, no markdown, no code fences.
Use null for any field not present.

For containers: extract container details if present (FCL shipments). Set to null if no container numbers are found (LCL/loose cargo).
For cargo_items: extract individual cargo line items for LCL/loose cargo shipments (pallets, cartons, etc.). Set to null if the BL only lists containers.

The carrier_agent field is the party issuing the BL — may be a carrier, NVOCC, co-loader, or freight forwarder acting as agent.

{
  "waybill_number": "string or null",
  "booking_number": "string or null",
  "carrier_agent": "string or null — the party issuing the BL",
  "vessel_name": "string or null",
  "voyage_number": "string or null",
  "port_of_loading": "string or null",
  "port_of_discharge": "string or null",
  "on_board_date": "string or null — format YYYY-MM-DD if possible",
  "freight_terms": "string or null — PREPAID or COLLECT",
  "shipper_name": "string or null",
  "shipper_address": "string or null",
  "consignee_name": "string or null",
  "consignee_address": "string or null",
  "notify_party_name": "string or null",
  "cargo_description": "string or null",
  "total_weight_kg": "number or null",
  "total_packages": "string or null",
  "delivery_status": "string or null",
  "containers": [
    {
      "container_number": "string or null",
      "container_type": "string or null",
      "seal_number": "string or null",
      "packages": "string or null",
      "weight_kg": "number or null"
    }
  ],
  "cargo_items": [
    {
      "description": "string or null",
      "quantity": "string or null — e.g. 2 PALLET(S)",
      "gross_weight": "string or null — e.g. 2190.00 kg",
      "measurement": "string or null — e.g. 2.1600 M3"
    }
  ]
}"""


_PORT_ALIASES: dict[str, str] = {
    "PORT KELANG":     "MYPKG",
    "KELANG":          "MYPKG",
    "PORT KLANG":      "MYPKG",
    "KLANG":           "MYPKG",
    "TANJUNG PELEPAS": "MYTPP",
    "PTP":             "MYTPP",
    "TANJUNG PRIOK":   "IDJKT",
    "PRIOK":           "IDJKT",
    "JAKARTA":         "IDJKT",
    "LAEM CHABANG":    "THLCH",
    "HAIPHONG":        "VNHPH",
    "HO CHI MINH":     "VNSGN",
    "SAIGON":          "VNSGN",
    "VUNG TAU":        "VNVUT",
    "SHANGHAI":        "CNSHA",
    "NINGBO":          "CNNBO",
    "SHENZHEN":        "CNSZX",
    "YANTIAN":         "CNYTN",
    "GUANGZHOU":       "CNGZU",
    "NANSHA":          "CNNSA",
    "BUSAN":           "KRPUS",
    "PUSAN":           "KRPUS",
    "HAMBURG":         "DEHAM",
    "BREMERHAVEN":     "DEBRV",
    "ROTTERDAM":       "NLRTM",
    "ANTWERP":         "BEANR",
    "FELIXSTOWE":      "GBFXT",
    "SINGAPORE":       "SGSIN",
    "HONG KONG":       "HKHKG",
    "DUBAI":           "AEDXB",
    "JEBEL ALI":       "AEJEA",
    "COLOMBO":         "LKCMB",
    "CHENNAI":         "INMAA",
    "MUNDRA":          "INMUN",
    "NHAVA SHEVA":     "INNSA",
    "JAWAHARLAL NEHRU":"INNSA",
    "SYDNEY":          "AUSYD",
    "MELBOURNE":       "AUMEL",
    "LOS ANGELES":     "USLAX",
    "LONG BEACH":      "USLGB",
    "NEW YORK":        "USNYC",
    "SAVANNAH":        "USSAV",
    "PIRAEUS":         "GRPIR",
}


def _match_port_un_code(conn, port_text: str) -> str | None:
    """Match free-text port name to a ports table UN code."""
    if not port_text:
        return None
    port_text_upper = port_text.upper().strip()
    logger.info("[port_match] Looking for: '%s'", port_text_upper)

    # Check alias dictionary first
    if port_text_upper in _PORT_ALIASES:
        logger.info("[port_match] Alias hit: '%s' -> %s", port_text_upper, _PORT_ALIASES[port_text_upper])
        return _PORT_ALIASES[port_text_upper]

    # Quick check: if it looks like a UN code already (5 uppercase letters)
    if len(port_text_upper) == 5 and port_text_upper.isalpha():
        row = conn.execute(text("""
            SELECT id FROM geography WHERE id = :code
        """), {"code": port_text_upper}).fetchone()
        if row:
            logger.info("[port_match] Direct UN code hit: %s", port_text_upper)
            return port_text_upper

    # Search ports table for matching name
    rows = conn.execute(text("""
        SELECT un_code, name FROM ports
        WHERE UPPER(name) = :exact
        LIMIT 1
    """), {"exact": port_text_upper}).fetchall()

    if rows:
        logger.info("[port_match] Exact name match: %s -> %s", port_text_upper, rows[0][0])
        return rows[0][0]

    # Contains match
    row = conn.execute(text("""
        SELECT un_code, name FROM ports
        WHERE UPPER(name) LIKE :pattern OR :search LIKE '%' || UPPER(name) || '%'
        LIMIT 1
    """), {"pattern": f"%{port_text_upper}%", "search": port_text_upper}).fetchone()

    if row:
        logger.info("[port_match] Contains match: '%s' ~ '%s' -> %s", port_text_upper, row[1], row[0])
        return row[0]

    logger.info("[port_match] No match for '%s'", port_text_upper)
    return None


def _match_company(conn, consignee_name: str) -> list[dict]:
    """Match consignee name against companies table. Returns top 3 matches."""
    if not consignee_name:
        return []
    name_lower = consignee_name.lower().strip()
    logger.info("[company_match] Looking for: '%s'", name_lower)

    import re as _re

    def _normalise(s: str) -> str:
        """Strip punctuation, collapse spaces for fuzzy comparison."""
        s = s.lower()
        s = _re.sub(r'[^a-z0-9\s]', ' ', s)  # remove punctuation
        s = _re.sub(r'\s+', ' ', s).strip()   # collapse whitespace
        return s

    name_norm = _normalise(name_lower)
    name_words = [w for w in name_norm.split() if len(w) > 2]

    # Fetch companies matching by ILIKE for pre-filtering, then score in Python
    rows = conn.execute(text("""
        SELECT id, name FROM companies
        WHERE trash = FALSE AND name IS NOT NULL AND name != ''
    """)).fetchall()

    matches: list[dict] = []
    for r in rows:
        company_name = r[1]
        company_norm = _normalise(company_name)

        # Score: exact normalised match = 1.0, contains = 0.8, word overlap = 0.5+
        score = 0.0
        if company_norm == name_norm:
            score = 1.0
        elif name_norm in company_norm or company_norm in name_norm:
            score = 0.8
        else:
            # Word overlap on normalised strings
            company_words = set(company_norm.split())
            matched = sum(1 for w in name_words if w in company_words)
            if matched >= 2:
                score = 0.5 + (matched / max(len(name_words), 1)) * 0.3

        if score > 0.3:
            logger.info("[company_match] Hit: '%s' norm:'%s' (score %.2f)", company_name, company_norm, score)
            matches.append({
                "company_id": r[0],
                "name": company_name,
                "score": round(score, 2),
            })

    matches.sort(key=lambda m: m["score"], reverse=True)
    logger.info("[company_match] Total matches for '%s': %d", name_lower, len(matches))
    return matches[:3]


def _determine_initial_status(on_board_date: str | None) -> int:
    """Determine initial status based on on_board_date."""
    if not on_board_date:
        return STATUS_BOOKING_CONFIRMED  # 3002

    try:
        from datetime import date as _date
        obd = _date.fromisoformat(on_board_date[:10])
        today = _date.today()
        if obd > today:
            return STATUS_BOOKING_CONFIRMED  # 3002 — vessel departs in future
        else:
            return STATUS_DEPARTED  # 4001 — vessel already departed
    except (ValueError, TypeError):
        return STATUS_BOOKING_CONFIRMED


@router.post("/parse-bl")
async def parse_bl(
    file: UploadFile = File(...),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """
    Parse a Bill of Lading PDF or image using Claude API.
    Returns structured extracted data + company matches + derived fields.
    """
    import os

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    # Read file bytes
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    # Determine media type
    content_type = file.content_type or ""
    if "pdf" in content_type:
        media_type = "application/pdf"
    elif "png" in content_type:
        media_type = "image/png"
    elif "jpeg" in content_type or "jpg" in content_type:
        media_type = "image/jpeg"
    elif "webp" in content_type:
        media_type = "image/webp"
    else:
        # Try to detect from filename
        fname = (file.filename or "").lower()
        if fname.endswith(".pdf"):
            media_type = "application/pdf"
        elif fname.endswith(".png"):
            media_type = "image/png"
        elif fname.endswith((".jpg", ".jpeg")):
            media_type = "image/jpeg"
        else:
            media_type = "application/pdf"  # default

    # Call Claude API
    import anthropic
    client_ai = anthropic.Anthropic(api_key=api_key)

    try:
        if media_type == "application/pdf":
            message = client_ai.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=4096,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": base64.b64encode(file_bytes).decode(),
                            },
                        },
                        {"type": "text", "text": _BL_EXTRACTION_PROMPT},
                    ],
                }],
            )
        else:
            message = client_ai.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=4096,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": base64.b64encode(file_bytes).decode(),
                            },
                        },
                        {"type": "text", "text": _BL_EXTRACTION_PROMPT},
                    ],
                }],
            )
    except Exception as e:
        logger.error("Claude API call failed: %s", e)
        raise HTTPException(status_code=502, detail=f"AI parsing failed: {str(e)}")

    # Parse response
    raw_text = message.content[0].text if message.content else ""
    # Strip any markdown code fences if present
    raw_text = raw_text.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.split("\n", 1)[1] if "\n" in raw_text else raw_text[3:]
    if raw_text.endswith("```"):
        raw_text = raw_text[:-3].strip()
    if raw_text.startswith("json"):
        raw_text = raw_text[4:].strip()

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        logger.error("Failed to parse Claude response as JSON: %s", raw_text[:500])
        raise HTTPException(status_code=502, detail="AI returned invalid JSON")

    # Derive fields

    # Order type: containers = FCL, otherwise check delivery_status
    containers = parsed.get("containers") or []
    delivery_status = (parsed.get("delivery_status") or "").upper()
    if containers and len(containers) > 0:
        order_type = "SEA_FCL"
    elif "LCL" in delivery_status:
        order_type = "SEA_LCL"
    else:
        order_type = "SEA_FCL"

    # Port matching
    origin_parsed_label = (parsed.get("port_of_loading") or "").strip()
    destination_parsed_label = (parsed.get("port_of_discharge") or "").strip()
    origin_un_code = _match_port_un_code(conn, origin_parsed_label)
    destination_un_code = _match_port_un_code(conn, destination_parsed_label)

    # Initial status
    initial_status = _determine_initial_status(parsed.get("on_board_date"))

    # Company matching
    company_matches = _match_company(conn, parsed.get("consignee_name") or "")

    return {
        "parsed": parsed,
        "order_type": order_type,
        "origin_un_code": origin_un_code,
        "origin_parsed_label": origin_parsed_label or None,
        "destination_un_code": destination_un_code,
        "destination_parsed_label": destination_parsed_label or None,
        "initial_status": initial_status,
        "company_matches": company_matches,
    }


# ---------------------------------------------------------------------------
# Create shipment from BL  (V2 only)
# ---------------------------------------------------------------------------

class CreateFromBLRequest(BaseModel):
    order_type: str = "SEA_FCL"
    transaction_type: str = "IMPORT"
    incoterm_code: str = "CNF"
    company_id: str | None = None
    origin_port_un_code: str | None = None
    origin_terminal_id: str | None = None
    origin_label: str | None = None
    destination_port_un_code: str | None = None
    destination_terminal_id: str | None = None
    destination_label: str | None = None
    cargo_description: str | None = None
    cargo_weight_kg: float | None = None
    etd: str | None = None
    initial_status: int = 3002
    carrier: str | None = None
    waybill_number: str | None = None
    vessel_name: str | None = None
    voyage_number: str | None = None
    shipper_name: str | None = None
    shipper_address: str | None = None
    consignee_name: str | None = None
    consignee_address: str | None = None
    notify_party_name: str | None = None
    containers: list | None = None
    customer_reference: str | None = None


@router.post("/create-from-bl")
async def create_from_bl(
    body: CreateFromBLRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """
    Create a V2 shipment from parsed BL data.
    Creates shipment + shipment_workflow + auto-generates tasks.
    """
    now = datetime.now(timezone.utc).isoformat()

    # Generate shipment ID from sequence
    shipment_id, new_countid = db_queries.next_shipment_id(conn)

    # Build origin/destination JSONB
    origin = None
    if body.origin_port_un_code:
        origin = {
            "type": "PORT",
            "port_un_code": body.origin_port_un_code,
            "terminal_id": body.origin_terminal_id,
            "city_id": None,
            "address": None,
            "country_code": None,
            "label": body.origin_label or body.origin_port_un_code or "",
        }

    destination = None
    if body.destination_port_un_code:
        destination = {
            "type": "PORT",
            "port_un_code": body.destination_port_un_code,
            "terminal_id": body.destination_terminal_id,
            "city_id": None,
            "address": None,
            "country_code": None,
            "label": body.destination_label or body.destination_port_un_code or "",
        }

    cargo = {
        "description": body.cargo_description or "",
        "hs_code": None,
        "is_dg": False,
        "dg_class": None,
        "dg_un_number": None,
    }

    booking = {
        "carrier": body.carrier,
        "booking_reference": body.waybill_number,
        "vessel_name": body.vessel_name,
        "voyage_number": body.voyage_number,
    }

    parties = {}
    if body.shipper_name:
        parties["shipper"] = {"name": body.shipper_name, "address": body.shipper_address, "contact_person": None, "phone": None, "email": None, "company_id": None, "company_contact_id": None}
    if body.consignee_name:
        parties["consignee"] = {"name": body.consignee_name, "address": body.consignee_address, "contact_person": None, "phone": None, "email": None, "company_id": body.company_id, "company_contact_id": None}
    if body.notify_party_name:
        parties["notify_party"] = {"name": body.notify_party_name, "address": None, "contact_person": None, "phone": None, "email": None, "company_id": None, "company_contact_id": None}

    initial_history = [{
        "status": body.initial_status,
        "label": STATUS_LABELS.get(body.initial_status, str(body.initial_status)),
        "timestamp": now,
        "changed_by": claims.email,
        "note": "Created from BL upload",
    }]

    creator = {"uid": claims.uid, "email": claims.email}

    # Type details for containers
    type_details = None
    if body.containers:
        type_details = {"containers": body.containers}

    # Insert into shipments table
    conn.execute(text("""
        INSERT INTO shipments (
            id, countid, company_id, order_type, transaction_type, incoterm_code,
            status, issued_invoice, status_history,
            origin_port, origin_terminal, dest_port, dest_terminal,
            cargo, type_details, booking, parties, bl_document,
            exception_data, route_nodes, trash,
            cargo_ready_date, etd, eta, creator,
            migrated_from_v1, created_at, updated_at
        ) VALUES (
            :id, :countid, :company_id, :order_type, :transaction_type, :incoterm_code,
            :status, FALSE, CAST(:status_history AS jsonb),
            :origin_port, :origin_terminal, :dest_port, :dest_terminal,
            CAST(:cargo AS jsonb), CAST(:type_details AS jsonb), CAST(:booking AS jsonb), CAST(:parties AS jsonb), NULL,
            NULL, NULL, FALSE,
            NULL, :etd, NULL, CAST(:creator AS jsonb),
            FALSE, :now, :now
        )
    """), {
        "id": shipment_id,
        "countid": new_countid,
        "company_id": body.company_id or "",
        "order_type": body.order_type,
        "transaction_type": body.transaction_type,
        "incoterm_code": body.incoterm_code,
        "status": body.initial_status,
        "now": now,
        "status_history": json.dumps(initial_history),
        "origin_port": body.origin_port_un_code or "",
        "origin_terminal": body.origin_terminal_id,
        "dest_port": body.destination_port_un_code or "",
        "dest_terminal": body.destination_terminal_id,
        "cargo": json.dumps(cargo),
        "type_details": json.dumps(type_details) if type_details else None,
        "booking": json.dumps(booking),
        "parties": json.dumps(parties),
        "creator": json.dumps(creator),
        "etd": body.etd,
    })

    # Auto-generate tasks
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

    wf_history = [{
        "status": body.initial_status,
        "status_label": STATUS_LABELS.get(body.initial_status, str(body.initial_status)),
        "timestamp": now,
        "changed_by": claims.uid,
    }]

    # Insert into shipment_workflows table
    conn.execute(text("""
        INSERT INTO shipment_workflows (
            shipment_id, company_id, status_history, workflow_tasks,
            completed, created_at, updated_at
        ) VALUES (
            :shipment_id, :company_id, CAST(:status_history AS jsonb), CAST(:workflow_tasks AS jsonb),
            FALSE, :now, :now
        )
    """), {
        "shipment_id": shipment_id,
        "company_id": body.company_id or "",
        "status_history": json.dumps(wf_history),
        "workflow_tasks": json.dumps(tasks),
        "now": now,
    })

    logger.info("Shipment %s created from BL by %s", shipment_id, claims.uid)

    return {
        "status": "OK",
        "data": {"shipment_id": shipment_id},
        "msg": "Shipment created from BL",
    }


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


@router.post("")
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
        type_details = {"containers": body.containers or []}
    else:
        type_details = {"packages": body.packages or []}

    # 7. Build parties JSONB
    parties = {}
    if body.shipper:
        parties["shipper"] = body.shipper
    if body.consignee:
        parties["consignee"] = body.consignee
    if body.notify_party:
        parties["notify_party"] = body.notify_party

    # 8. Initial status = 1002 (Draft Review)
    status = STATUS_CONFIRMED

    # 9. Status history
    initial_history = [{
        "status": status,
        "label": STATUS_LABELS.get(status, str(status)),
        "timestamp": now,
        "changed_by": claims.email,
        "note": "Manually created",
    }]

    # 10. Creator
    creator = {"uid": claims.uid, "email": claims.email}

    # 11. INSERT into shipments
    conn.execute(text("""
        INSERT INTO shipments (
            id, countid, company_id, order_type, transaction_type, incoterm_code,
            status, issued_invoice, status_history,
            origin_port, origin_terminal, dest_port, dest_terminal,
            cargo, type_details, parties, bl_document,
            exception_data, route_nodes, trash,
            cargo_ready_date, etd, eta, creator,
            migrated_from_v1, created_at, updated_at
        ) VALUES (
            :id, :countid, :company_id, :order_type, :transaction_type, :incoterm_code,
            :status, FALSE, CAST(:status_history AS jsonb),
            :origin_port, :origin_terminal, :dest_port, :dest_terminal,
            CAST(:cargo AS jsonb), CAST(:type_details AS jsonb), CAST(:parties AS jsonb), NULL,
            NULL, NULL, FALSE,
            :cargo_ready_date, :etd, :eta, CAST(:creator AS jsonb),
            FALSE, :now, :now
        )
    """), {
        "id": shipment_id,
        "countid": new_countid,
        "company_id": body.company_id,
        "order_type": body.order_type,
        "transaction_type": body.transaction_type,
        "incoterm_code": body.incoterm_code,
        "status": status,
        "now": now,
        "status_history": json.dumps(initial_history),
        "origin_port": body.origin_port_un_code,
        "origin_terminal": body.origin_terminal_id,
        "dest_port": body.destination_port_un_code,
        "dest_terminal": body.destination_terminal_id,
        "cargo": json.dumps(cargo),
        "type_details": json.dumps(type_details),
        "parties": json.dumps(parties),
        "creator": json.dumps(creator),
        "cargo_ready_date": body.cargo_ready_date,
        "etd": body.etd,
        "eta": body.eta,
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

    # 13. Workflow history
    wf_history = [{
        "status": status,
        "status_label": STATUS_LABELS.get(status, str(status)),
        "timestamp": now,
        "changed_by": claims.uid,
    }]

    # 14. INSERT into shipment_workflows
    conn.execute(text("""
        INSERT INTO shipment_workflows (
            shipment_id, company_id, status_history, workflow_tasks,
            completed, created_at, updated_at
        ) VALUES (
            :shipment_id, :company_id, CAST(:status_history AS jsonb), CAST(:workflow_tasks AS jsonb),
            FALSE, :now, :now
        )
    """), {
        "shipment_id": shipment_id,
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
# Delete shipment (soft + hard)
# ---------------------------------------------------------------------------

ENVIRONMENT = os.environ.get("ENVIRONMENT", "production")


@router.delete("/{shipment_id}")
async def delete_shipment(
    shipment_id: str,
    hard: bool = Query(False),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """
    Delete a shipment. Soft delete by default (sets trash=TRUE).
    Hard delete (permanent row removal) only permitted in development environment.
    """
    # Environment guard for hard delete
    if hard and ENVIRONMENT != "development":
        raise HTTPException(status_code=403, detail="Hard delete only permitted in development environment")

    # Verify shipment exists
    row = conn.execute(text("SELECT id, trash FROM shipments WHERE id = :id"), {"id": shipment_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Shipment {shipment_id} not found")

    now = datetime.now(timezone.utc).isoformat()

    if hard:
        # Hard delete — log BEFORE deletion
        _log_system_action_pg(conn, "SHIPMENT_HARD_DELETED", shipment_id, claims.uid, claims.email)
        conn.execute(text("DELETE FROM shipment_files WHERE shipment_id = :id"), {"id": shipment_id})
        conn.execute(text("DELETE FROM shipment_workflows WHERE shipment_id = :id"), {"id": shipment_id})
        conn.execute(text("DELETE FROM shipments WHERE id = :id"), {"id": shipment_id})
        logger.info("Shipment %s hard-deleted by %s", shipment_id, claims.uid)
        return {"deleted": True, "shipment_id": shipment_id, "mode": "hard"}
    else:
        # Soft delete
        if row[1]:  # trash column
            raise HTTPException(status_code=400, detail="Shipment already deleted")

        conn.execute(text("""
            UPDATE shipments SET trash = TRUE, updated_at = :now WHERE id = :id
        """), {"id": shipment_id, "now": now})
        conn.execute(text("""
            UPDATE shipment_workflows SET trash = TRUE, updated_at = :now WHERE shipment_id = :id
        """), {"id": shipment_id, "now": now})

        _log_system_action_pg(conn, "SHIPMENT_SOFT_DELETED", shipment_id, claims.uid, claims.email)
        logger.info("Shipment %s soft-deleted by %s", shipment_id, claims.uid)
        return {"deleted": True, "shipment_id": shipment_id, "mode": "soft"}


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
    if body.scheduled_start is not None:
        task["scheduled_start"] = body.scheduled_start
    if body.scheduled_end is not None:
        task["scheduled_end"] = body.scheduled_end
    if body.actual_start is not None:
        task["actual_start"] = body.actual_start
    if body.actual_end is not None:
        task["actual_end"] = body.actual_end
        task["completed_at"] = body.actual_end

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

    logger.info("Task %s updated on %s by %s", task_id, shipment_id, claims.uid)

    response: dict = {"status": "OK", "data": task, "msg": "Task updated"}
    if warning:
        response["warning"] = warning
    return response


# ---------------------------------------------------------------------------
# File management helpers
# ---------------------------------------------------------------------------

def _resolve_gcs_path(company_id: str, shipment_id: str, filename: str) -> str:
    """
    Build GCS upload path matching existing Files entity patterns.
    Pattern: company/{company_id}/shipments/{shipment_id}/{filename}
    """
    safe_company = company_id or "unknown"
    return f"company/{safe_company}/shipments/{shipment_id}/{filename}"


def _file_row_to_dict(row) -> dict:
    """Convert a shipment_files row to a response dict."""
    cols = row._mapping
    d = dict(cols)
    d["file_id"] = d.get("id")
    d["file_tags"] = _parse_jsonb(d.get("file_tags")) or []
    d["created"] = str(d.get("created_at") or "")
    d["updated"] = str(d.get("updated_at") or "")
    return d


def _save_file_to_gcs(bucket, gcs_path: str, file_bytes: bytes, content_type: str = "application/octet-stream"):
    """Upload bytes to GCS at the given path."""
    blob = bucket.blob(gcs_path)
    blob.upload_from_string(file_bytes, content_type=content_type)


def _create_file_record(
    conn,
    shipment_id: str,
    company_id: str,
    file_name: str,
    gcs_path: str,
    file_size_kb: float,
    file_tags: list,
    visibility: bool,
    uploader_uid: str,
    uploader_email: str,
) -> dict:
    """Insert a file record into shipment_files and return it as dict."""
    now = datetime.now(timezone.utc).isoformat()

    row = conn.execute(text("""
        INSERT INTO shipment_files (
            shipment_id, company_id, file_name, file_location,
            file_tags, file_description, file_size_kb, visibility,
            notification_sent, uploaded_by_uid, uploaded_by_email,
            trash, created_at, updated_at
        ) VALUES (
            :shipment_id, :company_id, :file_name, :file_location,
            CAST(:file_tags AS jsonb), NULL, :file_size_kb, :visibility,
            FALSE, :uploaded_by_uid, :uploaded_by_email,
            FALSE, :now, :now
        )
        RETURNING *
    """), {
        "shipment_id": shipment_id,
        "company_id": company_id,
        "file_name": file_name,
        "file_location": gcs_path,
        "file_tags": json.dumps(file_tags or []),
        "file_size_kb": round(file_size_kb, 2),
        "visibility": visibility,
        "uploaded_by_uid": uploader_uid,
        "uploaded_by_email": uploader_email,
        "now": now,
    }).fetchone()

    return _file_row_to_dict(row)


# ---------------------------------------------------------------------------
# 1a. GET /shipments/{shipment_id}/files
# ---------------------------------------------------------------------------

@router.get("/{shipment_id}/files")
async def list_shipment_files(
    shipment_id: str,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """List files for a shipment. AFC regular users only see visible files."""
    where = "shipment_id = :shipment_id AND trash = FALSE"
    params: dict = {"shipment_id": shipment_id}

    # AFC regular users: only visible files
    if claims.is_afc() and claims.role not in (AFC_ADMIN, AFC_M):
        where += " AND visibility = TRUE"

    rows = conn.execute(text(f"""
        SELECT * FROM shipment_files
        WHERE {where}
        ORDER BY created_at DESC
    """), params).fetchall()

    results = [_file_row_to_dict(r) for r in rows]

    return {"status": "OK", "data": results}


# ---------------------------------------------------------------------------
# 1c. POST /shipments/{shipment_id}/files
# ---------------------------------------------------------------------------

@router.post("/{shipment_id}/files")
async def upload_shipment_file(
    shipment_id: str,
    file: UploadFile = File(...),
    file_tags: str = Form("[]"),
    visibility: str = Form("true"),
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """Upload a file to a shipment. AFU or AFC Admin/Manager only."""
    # Permission check
    if claims.is_afc() and claims.role not in (AFC_ADMIN, AFC_M):
        raise ForbiddenError("Only staff or company admins/managers can upload files")

    # Parse form fields
    try:
        tags_list = json.loads(file_tags)
    except (ValueError, TypeError):
        tags_list = []
    vis_bool = visibility.lower() in ("true", "1", "yes")

    # Read the shipment to get company_id
    row = conn.execute(text("""
        SELECT company_id FROM shipments WHERE id = :id
    """), {"id": shipment_id}).fetchone()

    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    company_id = row[0] or ""

    # Read file
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    file_size_kb = len(file_bytes) / 1024.0
    original_name = file.filename or "untitled"

    # Build GCS path
    gcs_path = _resolve_gcs_path(company_id, shipment_id, original_name)

    # Upload to GCS
    from google.cloud import storage as gcs_storage
    gcs_client = gcs_storage.Client(project="cloud-accele-freight")
    bucket = gcs_client.bucket(FILES_BUCKET_NAME)
    content_type = file.content_type or "application/octet-stream"
    _save_file_to_gcs(bucket, gcs_path, file_bytes, content_type)

    # Create file record
    file_record = _create_file_record(
        conn=conn,
        shipment_id=shipment_id,
        company_id=company_id,
        file_name=original_name,
        gcs_path=gcs_path,
        file_size_kb=file_size_kb,
        file_tags=tags_list,
        visibility=vis_bool,
        uploader_uid=claims.uid,
        uploader_email=claims.email,
    )

    logger.info("File uploaded for %s by %s: %s", shipment_id, claims.uid, original_name)

    return {"status": "OK", "data": file_record, "msg": "File uploaded"}


# ---------------------------------------------------------------------------
# 1d. PATCH /shipments/{shipment_id}/files/{file_id}
# ---------------------------------------------------------------------------

class UpdateFileRequest(BaseModel):
    file_tags: list | None = None
    visibility: bool | None = None


@router.patch("/{shipment_id}/files/{file_id}")
async def update_shipment_file(
    shipment_id: str,
    file_id: int,
    body: UpdateFileRequest,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """Update file tags and/or visibility. AFU or AFC Admin/Manager."""
    if claims.is_afc() and claims.role not in (AFC_ADMIN, AFC_M):
        raise ForbiddenError("Only staff or company admins/managers can edit files")

    now = datetime.now(timezone.utc).isoformat()

    row = conn.execute(text("""
        SELECT id, shipment_id FROM shipment_files WHERE id = :id
    """), {"id": file_id}).fetchone()

    if not row:
        raise NotFoundError(f"File {file_id} not found")
    if row[1] != shipment_id:
        raise NotFoundError(f"File {file_id} not found on shipment {shipment_id}")

    updates = ["updated_at = :now"]
    params: dict = {"now": now, "id": file_id}

    if body.file_tags is not None:
        updates.append("file_tags = CAST(:file_tags AS jsonb)")
        params["file_tags"] = json.dumps(body.file_tags)

    # AFC Admin/Manager cannot change visibility
    if body.visibility is not None:
        if claims.is_afc():
            raise ForbiddenError("Only AF staff can change file visibility")
        updates.append("visibility = :visibility")
        params["visibility"] = body.visibility

    conn.execute(text(f"""
        UPDATE shipment_files SET {', '.join(updates)} WHERE id = :id
    """), params)

    # Re-fetch for response
    updated_row = conn.execute(text("SELECT * FROM shipment_files WHERE id = :id"), {"id": file_id}).fetchone()

    return {"status": "OK", "data": _file_row_to_dict(updated_row), "msg": "File updated"}


# ---------------------------------------------------------------------------
# 1e. DELETE /shipments/{shipment_id}/files/{file_id}
# ---------------------------------------------------------------------------

@router.delete("/{shipment_id}/files/{file_id}")
async def delete_shipment_file(
    shipment_id: str,
    file_id: int,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Soft-delete a file. AFU only."""
    now = datetime.now(timezone.utc).isoformat()

    row = conn.execute(text("""
        SELECT id, shipment_id FROM shipment_files WHERE id = :id
    """), {"id": file_id}).fetchone()

    if not row:
        raise NotFoundError(f"File {file_id} not found")
    if row[1] != shipment_id:
        raise NotFoundError(f"File {file_id} not found on shipment {shipment_id}")

    conn.execute(text("""
        UPDATE shipment_files SET trash = TRUE, updated_at = :now WHERE id = :id
    """), {"now": now, "id": file_id})

    logger.info("File %d soft-deleted on %s by %s", file_id, shipment_id, claims.uid)
    return {"deleted": True, "file_id": file_id}


# ---------------------------------------------------------------------------
# 1f. GET /shipments/{shipment_id}/files/{file_id}/download
# ---------------------------------------------------------------------------

@router.get("/{shipment_id}/files/{file_id}/download")
async def download_shipment_file(
    shipment_id: str,
    file_id: int,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """Generate a signed GCS URL for file download."""
    row = conn.execute(text("""
        SELECT id, shipment_id, visibility, file_location FROM shipment_files WHERE id = :id
    """), {"id": file_id}).fetchone()

    if not row:
        raise NotFoundError(f"File {file_id} not found")
    if row[1] != shipment_id:
        raise NotFoundError(f"File {file_id} not found on shipment {shipment_id}")

    # AFC regular: only visible files
    if claims.is_afc() and claims.role not in (AFC_ADMIN, AFC_M):
        if not row[2]:  # visibility
            raise NotFoundError(f"File {file_id} not found")

    file_location = row[3] or ""
    if not file_location:
        raise HTTPException(status_code=500, detail="File location not set")

    from google.cloud import storage as gcs_storage
    from datetime import timedelta
    gcs_client = gcs_storage.Client(project="cloud-accele-freight")
    bucket = gcs_client.bucket(FILES_BUCKET_NAME)
    blob = bucket.blob(file_location)

    signed_url = blob.generate_signed_url(
        version="v4",
        expiration=timedelta(minutes=15),
        method="GET",
    )

    return {"download_url": signed_url}


# ---------------------------------------------------------------------------
# 2a. PATCH /shipments/{shipment_id}/bl  — Update from BL
# ---------------------------------------------------------------------------

@router.patch("/{shipment_id}/bl")
async def update_from_bl(
    shipment_id: str,
    waybill_number: Optional[str] = Form(None),
    carrier: Optional[str] = Form(None),
    carrier_agent: Optional[str] = Form(None),
    vessel_name: Optional[str] = Form(None),
    voyage_number: Optional[str] = Form(None),
    etd: Optional[str] = Form(None),
    shipper_name: Optional[str] = Form(None),
    shipper_address: Optional[str] = Form(None),
    consignee_name: Optional[str] = Form(None),
    consignee_address: Optional[str] = Form(None),
    notify_party_name: Optional[str] = Form(None),
    bl_shipper_name: Optional[str] = Form(None),
    bl_shipper_address: Optional[str] = Form(None),
    bl_consignee_name: Optional[str] = Form(None),
    bl_consignee_address: Optional[str] = Form(None),
    force_update: Optional[str] = Form(None),
    containers: Optional[str] = Form(None),
    cargo_items: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """
    Update a shipment from parsed BL data. AFU only.
    Accepts multipart/form-data with optional BL PDF file.
    """
    # Read file bytes immediately — stream cannot be re-read later
    file_bytes = await file.read() if file else None
    file_content_type = file.content_type if file else None
    file_original_name = file.filename if file else None

    now = datetime.now(timezone.utc).isoformat()

    # Load shipment
    row = conn.execute(text("""
        SELECT id, company_id, booking, parties, bl_document, type_details, trash
        FROM shipments WHERE id = :id
    """), {"id": shipment_id}).fetchone()

    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")
    if row[6]:  # trash
        raise HTTPException(status_code=410, detail=f"Shipment {shipment_id} has been deleted")

    company_id = row[1] or ""
    booking = _parse_jsonb(row[2]) or {}
    if not isinstance(booking, dict):
        booking = {}
    parties = _parse_jsonb(row[3]) or {}
    if not isinstance(parties, dict):
        parties = {}
    bl_doc = _parse_jsonb(row[4]) or {}
    if not isinstance(bl_doc, dict):
        bl_doc = {}
    type_details = _parse_jsonb(row[5]) or {}
    if not isinstance(type_details, dict):
        type_details = {}

    # Merge booking fields (don't replace whole dict)
    if waybill_number is not None:
        booking["booking_reference"] = waybill_number
    # Write carrier_agent as new field alongside existing carrier (backward compat)
    if carrier_agent is not None:
        booking["carrier_agent"] = carrier_agent
    elif carrier is not None:
        booking["carrier_agent"] = carrier
    if vessel_name is not None:
        booking["vessel_name"] = vessel_name
    if voyage_number is not None:
        booking["voyage_number"] = voyage_number

    # Also write flat fields so detail-page readers see updated values
    flat_updates: dict = {}
    # vessel_name and voyage_number live in booking JSONB only — no flat columns
    if etd is not None:
        flat_updates["etd"] = etd

    # Merge parties — shipper + consignee (don't replace whole parties dict)
    # Only write to parties if currently empty — unless force_update is set
    is_force = force_update == "true"

    if shipper_name is not None or shipper_address is not None:
        shipper = parties.get("shipper") or {}
        if not isinstance(shipper, dict):
            shipper = {}
        if (is_force or not shipper.get("name")) and shipper_name is not None:
            shipper["name"] = shipper_name
        if (is_force or not shipper.get("address")) and shipper_address is not None:
            shipper["address"] = shipper_address
        parties["shipper"] = shipper

    if consignee_name is not None or consignee_address is not None:
        consignee = parties.get("consignee") or {}
        if not isinstance(consignee, dict):
            consignee = {}
        if (is_force or not consignee.get("name")) and consignee_name is not None:
            consignee["name"] = consignee_name
        if (is_force or not consignee.get("address")) and consignee_address is not None:
            consignee["address"] = consignee_address
        parties["consignee"] = consignee

    if notify_party_name is not None:
        notify_party = parties.get("notify_party") or {}
        if not isinstance(notify_party, dict):
            notify_party = {}
        if is_force or not notify_party.get("name"):
            notify_party["name"] = notify_party_name
        parties["notify_party"] = notify_party

    # Write raw parsed BL values to bl_document (always overwrite — audit record)
    if bl_shipper_name is not None or bl_shipper_address is not None:
        bl_doc["shipper"] = {
            "name": bl_shipper_name,
            "address": bl_shipper_address,
        }
    if bl_consignee_name is not None or bl_consignee_address is not None:
        bl_doc["consignee"] = {
            "name": bl_consignee_name,
            "address": bl_consignee_address,
        }

    # Containers — replace array if provided and non-empty
    if containers is not None:
        try:
            containers_list = json.loads(containers)
        except (ValueError, TypeError):
            containers_list = None
        if containers_list:
            type_details["containers"] = containers_list

    # Cargo items — replace array if provided and non-empty (LCL shipments)
    if cargo_items is not None:
        try:
            cargo_items_list = json.loads(cargo_items)
        except (ValueError, TypeError):
            cargo_items_list = None
        if cargo_items_list:
            type_details["cargo_items"] = cargo_items_list

    # Build UPDATE statement
    set_clauses = [
        "booking = CAST(:booking AS jsonb)",
        "parties = CAST(:parties AS jsonb)",
        "bl_document = CAST(:bl_document AS jsonb)",
        "type_details = CAST(:type_details AS jsonb)",
        "updated_at = :now",
    ]
    params: dict = {
        "booking": json.dumps(booking),
        "parties": json.dumps(parties),
        "bl_document": json.dumps(bl_doc) if bl_doc else None,
        "type_details": json.dumps(type_details) if type_details else None,
        "now": now,
        "id": shipment_id,
    }

    if "etd" in flat_updates:
        set_clauses.append("etd = :etd_flat")
        params["etd_flat"] = flat_updates["etd"]

    # Unblock export clearance if waybill set
    if waybill_number:
        _maybe_unblock_export_clearance_pg(conn, shipment_id, claims.uid)

    logger.info("[bl_update] Writing to shipments %s", shipment_id)
    try:
        conn.execute(text(f"""
            UPDATE shipments SET {', '.join(set_clauses)} WHERE id = :id
        """), params)
    except Exception as e:
        logger.error("[bl_update] Failed to write shipment %s: %s", shipment_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to save shipment: {str(e)}")

    # Log to system_logs
    _log_system_action_pg(conn, "BL_UPDATED", shipment_id, claims.uid, claims.email)

    # Auto-save BL file if provided (file_bytes read at top of handler)
    if file_bytes:
        original_name = file_original_name or f"BL_{shipment_id}.pdf"
        gcs_path = _resolve_gcs_path(company_id, shipment_id, original_name)

        from google.cloud import storage as gcs_storage
        gcs_client = gcs_storage.Client(project="cloud-accele-freight")
        bucket = gcs_client.bucket(FILES_BUCKET_NAME)
        content_type = file_content_type or "application/pdf"
        _save_file_to_gcs(bucket, gcs_path, file_bytes, content_type)

        _create_file_record(
            conn=conn,
            shipment_id=shipment_id,
            company_id=company_id,
            file_name=original_name,
            gcs_path=gcs_path,
            file_size_kb=len(file_bytes) / 1024.0,
            file_tags=["bl"],
            visibility=True,
            uploader_uid=claims.uid,
            uploader_email=claims.email,
        )

    logger.info("BL update applied to %s by %s", shipment_id, claims.uid)

    return {
        "status": "OK",
        "data": {
            "shipment_id": shipment_id,
            "booking": booking,
            "parties": parties,
            "bl_document": bl_doc,
            "etd": flat_updates.get("etd"),
        },
        "msg": "Shipment updated from BL",
    }


# ---------------------------------------------------------------------------
# PATCH /shipments/{shipment_id}/parties
# ---------------------------------------------------------------------------

class UpdatePartiesRequest(BaseModel):
    shipper_name: Optional[str] = None
    shipper_address: Optional[str] = None
    consignee_name: Optional[str] = None
    consignee_address: Optional[str] = None
    notify_party_name: Optional[str] = None
    notify_party_address: Optional[str] = None


@router.patch("/{shipment_id}/parties")
async def update_parties(
    shipment_id: str,
    body: UpdatePartiesRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """
    Update shipper/consignee on a shipment. AFU only.
    Merges into existing parties dict — preserves notify_party and other fields.
    Does NOT touch bl_document.
    """
    now = datetime.now(timezone.utc).isoformat()

    row = conn.execute(text("""
        SELECT parties FROM shipments WHERE id = :id
    """), {"id": shipment_id}).fetchone()

    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    parties = _parse_jsonb(row[0]) or {}
    if not isinstance(parties, dict):
        parties = {}

    # Merge shipper
    # "" clears a field, non-empty string sets it, None (absent) = don't touch
    if body.shipper_name is not None or body.shipper_address is not None:
        shipper = parties.get("shipper") or {}
        if not isinstance(shipper, dict):
            shipper = {}
        if body.shipper_name is not None:
            shipper["name"] = body.shipper_name
        if body.shipper_address is not None:
            shipper["address"] = body.shipper_address
        if not shipper.get("name") and not shipper.get("address"):
            parties.pop("shipper", None)
        else:
            parties["shipper"] = shipper

    # Merge consignee
    if body.consignee_name is not None or body.consignee_address is not None:
        consignee = parties.get("consignee") or {}
        if not isinstance(consignee, dict):
            consignee = {}
        if body.consignee_name is not None:
            consignee["name"] = body.consignee_name
        if body.consignee_address is not None:
            consignee["address"] = body.consignee_address
        if not consignee.get("name") and not consignee.get("address"):
            parties.pop("consignee", None)
        else:
            parties["consignee"] = consignee

    # Merge notify_party
    if body.notify_party_name is not None or body.notify_party_address is not None:
        notify_party = parties.get("notify_party") or {}
        if not isinstance(notify_party, dict):
            notify_party = {}
        if body.notify_party_name is not None:
            notify_party["name"] = body.notify_party_name
        if body.notify_party_address is not None:
            notify_party["address"] = body.notify_party_address
        if not notify_party.get("name") and not notify_party.get("address"):
            parties.pop("notify_party", None)
        else:
            parties["notify_party"] = notify_party

    conn.execute(text("""
        UPDATE shipments SET parties = CAST(:parties AS jsonb), updated_at = :now WHERE id = :id
    """), {"parties": json.dumps(parties), "now": now, "id": shipment_id})

    _log_system_action_pg(conn, "PARTIES_UPDATED", shipment_id, claims.uid, claims.email)

    return {
        "status": "OK",
        "data": {"parties": parties},
    }


def _maybe_unblock_export_clearance_pg(conn, shipment_id: str, user_id: str):
    """Unblock EXPORT_CLEARANCE if FREIGHT_BOOKING is completed and waybill is set."""
    wf_row = conn.execute(text("""
        SELECT workflow_tasks FROM shipment_workflows WHERE shipment_id = :id
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
            WHERE shipment_id = :id
        """), {"tasks": json.dumps(tasks), "now": now, "id": shipment_id})
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
        SELECT id FROM shipments WHERE id = :id
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

    set_clauses = ["route_nodes = CAST(:route_nodes AS jsonb)", "updated_at = :now"]
    params: dict = {"route_nodes": json.dumps(node_dicts), "now": now, "id": shipment_id}

    if flat_etd is not None:
        set_clauses.append("etd = :etd")
        params["etd"] = flat_etd
    if flat_eta is not None:
        set_clauses.append("eta = :eta")
        params["eta"] = flat_eta

    conn.execute(text(f"""
        UPDATE shipments SET {', '.join(set_clauses)} WHERE id = :id
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
        SELECT route_nodes FROM shipments WHERE id = :id
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
    set_clauses = ["route_nodes = CAST(:route_nodes AS jsonb)", "updated_at = :now"]
    params: dict = {"route_nodes": json.dumps(nodes), "now": datetime.now(timezone.utc).isoformat(), "id": shipment_id}

    # Sync flat fields if ORIGIN or DESTINATION
    if target.get("role") == "ORIGIN" and body.scheduled_etd is not None:
        set_clauses.append("etd = :etd")
        params["etd"] = body.scheduled_etd
    if target.get("role") == "DESTINATION" and body.scheduled_eta is not None:
        set_clauses.append("eta = :eta")
        params["eta"] = body.scheduled_eta

    conn.execute(text(f"""
        UPDATE shipments SET {', '.join(set_clauses)} WHERE id = :id
    """), params)

    return {
        "shipment_id": shipment_id,
        "node": target,
    }
