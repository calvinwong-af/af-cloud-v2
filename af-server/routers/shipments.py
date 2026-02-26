"""
routers/shipments.py

Shipment endpoints — V2 primary + V1 read-only.

Priority S1:  GET /api/v2/shipments/stats
              Accurate counts by querying ShipmentOrder Kind directly
              and joining with Quotation. Fixes the ~1,960 vs ~23 bug.

All other endpoints are stubs — add implementations as each is needed.
"""

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

@router.get("")
async def list_shipments(
    tab: str = Query("active", description="active | completed | to_invoice | all"),
    company_id: Optional[str] = Query(None),
    cursor: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=100),
    claims: Claims = Depends(require_auth),
):
    """
    List shipments with tab-based filtering.

    Returns a mixed list of V1 and V2 shipments, normalised to a common
    summary shape. V2 records read from Quotation Kind. V1 records read
    from ShipmentOrder Kind (joined with Quotation for display fields).

    TODO: Implement full V1+V2 join and normalised response.
          For now returns a stub so the endpoint exists and is routable.
    """
    # TODO: implement full paginated list with V1+V2 merge
    return {
        "status": "OK",
        "data": {
            "items": [],
            "next_cursor": None,
            "count": 0,
        },
        "msg": "Shipment list — implementation in progress",
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
