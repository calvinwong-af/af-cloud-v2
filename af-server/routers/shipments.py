"""
routers/shipments.py

Shipment endpoints — V2 primary + V1 read-only.

Priority S1:  GET /api/v2/shipments/stats
              Accurate counts by querying ShipmentOrder Kind directly
              and joining with Quotation. Fixes the ~1,960 vs ~23 bug.

All other endpoints are stubs — add implementations as each is needed.
"""

import base64
from typing import Optional

from fastapi import APIRouter, Depends, Query

from core.auth import Claims, require_auth, require_afu, require_afu_admin
from core.constants import (
    AFU,
    V1_ACTIVE_MIN,
    V1_ACTIVE_MAX,
    V1_STATUS_COMPLETED,
    V1_TO_V2_STATUS,
    STATUS_COMPLETED,
    STATUS_CANCELLED,
    STATUS_DRAFT,
    STATUS_DRAFT_REVIEW,
    V2_ACTIVE_STATUSES,
    PREFIX_V2_SHIPMENT,
    PREFIX_V1_SHIPMENT,
)
from core.datastore import get_client, run_query, entity_to_dict
from core.exceptions import NotFoundError

router = APIRouter()


# ---------------------------------------------------------------------------
# S1 — Shipment stats  (HIGH PRIORITY — fixes broken dashboard counts)
# ---------------------------------------------------------------------------

@router.get("/stats")
async def get_shipment_stats(
    company_id: Optional[str] = Query(None, description="Filter by company (AFC users)"),
    claims: Claims = Depends(require_auth),
):
    """
    Return accurate shipment counts for the dashboard KPI cards and tab badges.

    Strategy:
      - V2 records: query Quotation Kind where data_version=2, read status directly
      - V1 records: query ShipmentOrder Kind (the operational source of truth),
                    map V1 status codes to V2 buckets

    This fixes the bug where the Next.js layer was counting ~1,960 active
    shipments because it read Quotation.status which includes all V1 quotations,
    not just those that became shipments.
    """
    client = get_client()

    # AFC users can only see their own company — enforce this regardless of query param
    effective_company_id = None
    if claims.is_afc():
        effective_company_id = claims.company_id
    elif company_id:
        effective_company_id = company_id  # AFU filtering by a specific company

    stats = {
        "active":     0,
        "completed":  0,
        "to_invoice": 0,
        "cancelled":  0,
        "total":      0,
    }

    # -----------------------------------------------------------------------
    # V2 records — Quotation Kind, data_version=2
    # -----------------------------------------------------------------------
    v2_query = client.query(kind="Quotation")
    v2_query.add_filter("data_version", "=", 2)
    v2_query.add_filter("trash", "=", False)
    if effective_company_id:
        v2_query.add_filter("company_id", "=", effective_company_id)

    for entity in v2_query.fetch():
        s = entity.get("status", 0)
        if s in V2_ACTIVE_STATUSES:
            stats["active"] += 1
        elif s == STATUS_COMPLETED:
            stats["completed"] += 1
            # to_invoice: completed but invoice not yet issued
            if not bool(entity.get("issued_invoice", False)):
                stats["to_invoice"] += 1
        elif s == STATUS_CANCELLED:
            stats["cancelled"] += 1

    # -----------------------------------------------------------------------
    # V1 records — ShipmentOrder Kind (operational status source of truth)
    # Only records that reached at least booking confirmation are shipments.
    # -----------------------------------------------------------------------
    v1_query = client.query(kind="ShipmentOrder")
    # status >= 110 means booking was confirmed — this is what makes it a shipment
    v1_query.add_filter("status", ">=", V1_ACTIVE_MIN)
    if effective_company_id:
        v1_query.add_filter("company_id", "=", effective_company_id)

    for entity in v1_query.fetch():
        v1_status = entity.get("status", 0)
        if v1_status == V1_STATUS_COMPLETED:
            stats["completed"] += 1
            # to_invoice: completed + invoice not issued
            # issued_invoice may be bool, int 0/1, or missing — coerce safely
            issued = entity.get("issued_invoice")
            if not bool(issued):
                stats["to_invoice"] += 1
        elif v1_status == -1:  # V1 cancellation (rare — most V1 cancels are soft-deleted)
            stats["cancelled"] += 1
        else:
            # anything >= 110 and < 10000 is active
            if V1_ACTIVE_MIN <= v1_status < V1_STATUS_COMPLETED:
                stats["active"] += 1

    stats["total"] = stats["active"] + stats["completed"] + stats["cancelled"]

    return {"status": "OK", "data": stats, "msg": "Shipment stats fetched"}


# ---------------------------------------------------------------------------
# List shipments — paginated, with tab filter
# ---------------------------------------------------------------------------

_DRAFT_STATUSES = frozenset({STATUS_DRAFT, STATUS_DRAFT_REVIEW})
_VALID_TABS = {"all", "active", "completed", "to_invoice", "draft", "cancelled"}

# Over-fetch multiplier for V1 — compensates for in-memory tab filtering.
# E.g. tab=cancelled has very few V1 matches so we fetch more to fill a page.
_V1_OVERFETCH = 3


def _v2_tab_match(tab: str, entity) -> bool:
    """Return True if a V2 Quotation entity belongs in the requested tab."""
    s = entity.get("status", 0)
    if tab == "all":
        return True
    if tab == "active":
        return s in V2_ACTIVE_STATUSES
    if tab == "completed":
        return s == STATUS_COMPLETED
    if tab == "to_invoice":
        return s == STATUS_COMPLETED and not bool(entity.get("issued_invoice", False))
    if tab == "draft":
        return s in _DRAFT_STATUSES
    if tab == "cancelled":
        return s == STATUS_CANCELLED
    return True


def _v1_tab_match(tab: str, v1_status: int, issued_invoice: bool) -> bool:
    """Return True if a V1 ShipmentOrder status belongs in the requested tab."""
    if tab == "all":
        return True
    if tab == "active":
        return V1_ACTIVE_MIN <= v1_status < V1_STATUS_COMPLETED
    if tab == "completed":
        return v1_status == V1_STATUS_COMPLETED
    if tab == "to_invoice":
        return v1_status == V1_STATUS_COMPLETED and not issued_invoice
    if tab == "draft":
        return False  # V1 has no draft shipments
    if tab == "cancelled":
        return v1_status == -1
    return True


def _fmt_date(val) -> str:
    """Coerce a Datastore value to YYYY-MM-DD string."""
    if val is None:
        return ""
    if hasattr(val, "isoformat"):
        return val.isoformat()[:10]
    s = str(val).strip()
    return s[:10] if s else ""


def _make_summary(
    entity,
    data_version: int,
    status: int,
    display_src=None,
) -> dict:
    """
    Build the normalised shipment summary dict.

    entity:       the primary entity (V2 Quotation or V1 ShipmentOrder)
    data_version: 1 or 2
    status:       V2-mapped status code
    display_src:  for V1, the Quotation entity holding display fields;
                  if None, reads from entity itself (V2 case)
    """
    src = display_src or entity
    updated = (
        entity.get("updated")
        or entity.get("modified")
        or entity.get("created")
        or ""
    )
    return {
        "shipment_id": entity.key.name or str(entity.key.id),
        "data_version": data_version,
        "status": status,
        "order_type": src.get("order_type", "") or src.get("quotation_type", ""),
        "transaction_type": src.get("transaction_type", ""),
        "incoterm": src.get("incoterm", ""),
        "origin_port": src.get("origin_port", "") or src.get("port_of_loading", ""),
        "destination_port": src.get("destination_port", "") or src.get("port_of_discharge", ""),
        "company_id": src.get("company_id", ""),
        "company_name": "",  # batch-filled after merge
        "cargo_ready_date": _fmt_date(src.get("cargo_ready_date")),
        "updated": _fmt_date(updated),
    }


def _batch_company_names(client, company_ids: list[str]) -> dict[str, str]:
    """Batch-fetch company names from Company Kind."""
    if not company_ids:
        return {}
    keys = [client.key("Company", cid) for cid in company_ids]
    entities = client.get_multi(keys)
    return {
        (e.key.name or str(e.key.id)): e.get("name", "")
        for e in entities
        if e is not None
    }


@router.get("")
async def list_shipments(
    tab: str = Query("active", description="active | completed | to_invoice | draft | cancelled | all"),
    company_id: Optional[str] = Query(None),
    cursor: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=100),
    claims: Claims = Depends(require_auth),
):
    """
    List shipments with tab-based filtering.

    Returns a merged list of V1 and V2 shipments normalised to a common
    summary shape, sorted by updated descending.

    Strategy:
      - V2 records (few): fetched in full on page 1, filtered by tab in-memory.
      - V1 records: query Quotation Kind (has_shipment=True), batch-fetch
        ShipmentOrder for real operational status, filter by tab in-memory.
        Paginated via Datastore cursor. Over-fetched to compensate for
        in-memory filtering.
    """
    if tab not in _VALID_TABS:
        tab = "active"

    client = get_client()

    # AFC users always scoped to own company; AFU can optionally filter
    effective_company_id = None
    if claims.is_afc():
        effective_company_id = claims.company_id
    elif company_id:
        effective_company_id = company_id

    items: list[dict] = []
    v1_next_cursor: str | None = None

    # -------------------------------------------------------------------
    # V2 records — Quotation Kind, data_version=2 (few, fetch all)
    # Only included on page 1 (no cursor). On subsequent pages the cursor
    # drives V1 pagination only; V2 records are already displayed.
    # -------------------------------------------------------------------
    if not cursor:
        v2_query = client.query(kind="Quotation")
        v2_query.add_filter("data_version", "=", 2)
        v2_query.add_filter("trash", "=", False)
        if effective_company_id:
            v2_query.add_filter("company_id", "=", effective_company_id)

        for entity in v2_query.fetch():
            if _v2_tab_match(tab, entity):
                v2_status = entity.get("status", 0)
                items.append(_make_summary(entity, 2, v2_status))

    # -------------------------------------------------------------------
    # V1 records — Quotation Kind (has_shipment=True) + ShipmentOrder join
    # -------------------------------------------------------------------
    v1_query = client.query(kind="Quotation")
    v1_query.add_filter("trash", "=", False)
    v1_query.add_filter("has_shipment", "=", True)
    if effective_company_id:
        v1_query.add_filter("company_id", "=", effective_company_id)

    # Over-fetch to compensate for tab filtering (tab=all needs no extra)
    fetch_limit = limit * _V1_OVERFETCH if tab != "all" else limit
    start_cursor = base64.urlsafe_b64decode(cursor) if cursor else None

    v1_iter = v1_query.fetch(limit=fetch_limit, start_cursor=start_cursor)
    page = next(v1_iter.pages)
    v1_quotations = list(page)
    token = v1_iter.next_page_token
    v1_next_cursor = base64.urlsafe_b64encode(token).decode() if token else None

    # Batch-fetch ShipmentOrder entities for real operational status
    if v1_quotations:
        so_keys = [
            client.key("ShipmentOrder", e.key.name or str(e.key.id))
            for e in v1_quotations
        ]
        so_entities = client.get_multi(so_keys)
        so_map: dict[str, object] = {
            (e.key.name or str(e.key.id)): e
            for e in so_entities
            if e is not None
        }

        for q_entity in v1_quotations:
            qid = q_entity.key.name or str(q_entity.key.id)
            so = so_map.get(qid)
            if not so:
                continue  # orphaned Quotation without ShipmentOrder — skip

            v1_status = so.get("status", 0)
            issued_invoice = bool(so.get("issued_invoice", False))

            if not _v1_tab_match(tab, v1_status, issued_invoice):
                continue

            v2_status = V1_TO_V2_STATUS.get(v1_status, v1_status)
            items.append(_make_summary(so, 1, v2_status, display_src=q_entity))

    # -------------------------------------------------------------------
    # Batch-fetch company names
    # -------------------------------------------------------------------
    company_ids = list({s["company_id"] for s in items if s.get("company_id")})
    names = _batch_company_names(client, company_ids)
    for s in items:
        s["company_name"] = names.get(s.get("company_id", ""), "")

    # Sort merged results by updated descending, trim to requested limit
    items.sort(key=lambda x: x.get("updated", ""), reverse=True)
    result = items[:limit]

    return {
        "shipments": result,
        "next_cursor": v1_next_cursor,
        "total_shown": len(result),
    }


# ---------------------------------------------------------------------------
# Get single shipment by ID
# ---------------------------------------------------------------------------

@router.get("/{shipment_id}")
async def get_shipment(
    shipment_id: str,
    claims: Claims = Depends(require_auth),
):
    """
    Get a single shipment by ID.

    Detects V1 vs V2 by prefix:
      AF2-XXXXX  → V2 record (Quotation Kind, data_version=2)
      AFCQ-XXXXX → V1 record (Quotation + ShipmentOrder join)
    """
    client = get_client()

    if shipment_id.startswith(PREFIX_V2_SHIPMENT):
        # V2 — read from Quotation Kind
        entity = client.get(client.key("Quotation", shipment_id))
        if not entity or entity.get("data_version") != 2:
            raise NotFoundError(f"Shipment {shipment_id} not found")

        data = entity_to_dict(entity)

        # AFC users can only access their own company's shipments
        if claims.is_afc() and data.get("company_id") != claims.company_id:
            raise NotFoundError(f"Shipment {shipment_id} not found")

        return {"status": "OK", "data": data, "msg": "Shipment fetched"}

    elif shipment_id.startswith(PREFIX_V1_SHIPMENT):
        # V1 — read ShipmentOrder (operational) + Quotation (commercial)
        # This matches what v1-assembly.ts does in the Next.js layer
        so_entity = client.get(client.key("ShipmentOrder", shipment_id))
        if not so_entity:
            raise NotFoundError(f"Shipment {shipment_id} not found")

        data = entity_to_dict(so_entity)
        quotation_id = data.get("quotation_id") or data.get("shipment_order_id")
        if quotation_id:
            q_entity = client.get(client.key("Quotation", quotation_id))
            if q_entity:
                data["quotation"] = entity_to_dict(q_entity)

        if claims.is_afc() and data.get("company_id") != claims.company_id:
            raise NotFoundError(f"Shipment {shipment_id} not found")

        return {"status": "OK", "data": data, "msg": "V1 Shipment fetched"}

    else:
        raise NotFoundError(f"Invalid shipment ID format: {shipment_id}")


# ---------------------------------------------------------------------------
# Update shipment status  (V2 only — V1 status changes go through old server)
# ---------------------------------------------------------------------------

@router.put("/{shipment_id}/status/{status_code}")
async def update_shipment_status(
    shipment_id: str,
    status_code: int,
    claims: Claims = Depends(require_afu),
):
    """
    Advance a V2 shipment through its status lifecycle.

    Only AFU staff can change status.
    Status transition validation is enforced (can't skip stages).

    TODO: Implement transition validation and write.
    """
    # TODO: validate transition, write to Datastore, create workflow event
    return {
        "status": "OK",
        "data": {"shipment_id": shipment_id, "new_status": status_code},
        "msg": "Status update — implementation in progress",
    }


# ---------------------------------------------------------------------------
# Create shipment  (V2 only)
# ---------------------------------------------------------------------------

@router.post("")
async def create_shipment(
    claims: Claims = Depends(require_auth),
):
    """
    Create a new V2 ShipmentOrder.

    Currently handled by shipments-write.ts in the Next.js layer.
    This endpoint will replace that once the server is wired up.

    TODO: Move creation logic from Next.js Server Action to here.
    """
    return {
        "status": "OK",
        "data": None,
        "msg": "Shipment create — implementation in progress",
    }
