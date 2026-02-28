"""
routers/shipments.py

Shipment endpoints — V2 primary + V1 read-only.

Priority S1:  GET /api/v2/shipments/stats
              Accurate counts by querying ShipmentOrder Kind directly
              and joining with Quotation. Fixes the ~1,960 vs ~23 bug.

All other endpoints are stubs — add implementations as each is needed.
"""

import base64
import json as _json
import logging
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel

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
    V1_ACTIVE_MIN,
    V1_ACTIVE_MAX,
    V1_STATUS_BOOKING_STARTED,
    V1_STATUS_COMPLETED,
    V1_TO_V2_STATUS,
    STATUS_CONFIRMED,
    STATUS_COMPLETED,
    STATUS_CANCELLED,
    STATUS_DRAFT,
    STATUS_DRAFT_REVIEW,
    STATUS_BOOKING_PENDING,
    STATUS_BOOKING_CONFIRMED,
    STATUS_DEPARTED,
    STATUS_ARRIVED,
    V2_ACTIVE_STATUSES,
    STATUS_LABELS,
    OLD_TO_NEW_STATUS,
    PREFIX_V2_SHIPMENT,
    PREFIX_V1_SHIPMENT,
    get_status_path,
    get_status_path_list,
)
from google.cloud.datastore.query import PropertyFilter

from core.datastore import get_client, get_multi_chunked, parse_timestamp, run_query, entity_to_dict
from core.exceptions import NotFoundError, ForbiddenError

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helper — normalise mixed V1/V2 status codes on ShipmentOrder records
# ---------------------------------------------------------------------------

_V1_NATIVE_CODES = frozenset({100, 110, 4110, 10000, -1})


def _resolve_so_status_to_v2(raw_status: int) -> int:
    """
    Normalise a ShipmentOrder status field to a V2 status code.

    V1 ShipmentOrders should have native V1 codes (110, 4110, 10000) but
    write endpoints have historically stored V2 codes (3001, 5001, etc.)
    on these records. This function handles both cases.
    """
    if raw_status in _V1_NATIVE_CODES:
        return V1_TO_V2_STATUS.get(raw_status, STATUS_CONFIRMED)
    # Already a V2 code (3001, 3002, 4001, 5001, etc.) — return as-is
    return raw_status


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
        "draft":      0,
        "cancelled":  0,
        "total":      0,
    }

    # -----------------------------------------------------------------------
    # V2 records — Quotation Kind, data_version=2
    # -----------------------------------------------------------------------
    v2_query = client.query(kind="Quotation")
    v2_query.add_filter(filter=PropertyFilter("data_version", "=", 2))
    v2_query.add_filter(filter=PropertyFilter("trash", "=", False))
    if effective_company_id:
        v2_query.add_filter(filter=PropertyFilter("company_id", "=", effective_company_id))

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
        elif s in (STATUS_DRAFT, STATUS_DRAFT_REVIEW):
            stats["draft"] += 1

    # -----------------------------------------------------------------------
    # V1 records — ShipmentOrder Kind (operational status source of truth)
    # Only records that reached at least booking confirmation are shipments.
    # -----------------------------------------------------------------------
    v1_query = client.query(kind="ShipmentOrder")
    # status >= 110 means booking was confirmed — this is what makes it a shipment
    v1_query.add_filter(filter=PropertyFilter("status", ">=", V1_ACTIVE_MIN))
    if effective_company_id:
        v1_query.add_filter(filter=PropertyFilter("company_id", "=", effective_company_id))

    # First pass: collect all V1 entities
    v1_entities_list = []
    for entity in v1_query.fetch():
        if entity.get("data_version") == 2:
            continue
        v1_entities_list.append(entity)

    # Bucket by resolved status
    v1_completed_ids = []
    for entity in v1_entities_list:
        raw_status = entity.get("status", 0)
        v2_status = _resolve_so_status_to_v2(raw_status)

        if v2_status == STATUS_COMPLETED:
            stats["completed"] += 1
            # Check issued_invoice on ShipmentOrder first
            issued_so = entity.get("issued_invoice")
            if bool(issued_so):
                pass  # already invoiced — don't add to to_invoice
            else:
                # May be missing on SO — queue for Quotation lookup
                v1_completed_ids.append(entity.key.name or str(entity.key.id))
        elif v2_status == STATUS_CANCELLED:
            stats["cancelled"] += 1
        elif v2_status in V2_ACTIVE_STATUSES:
            stats["active"] += 1
        elif v2_status in (STATUS_DRAFT, STATUS_DRAFT_REVIEW):
            stats["draft"] += 1

    # Batch-fetch Quotation records to resolve issued_invoice for completed V1 shipments
    if v1_completed_ids:
        q_keys = [client.key("Quotation", sid) for sid in v1_completed_ids]
        q_entities = get_multi_chunked(client, q_keys)
        q_invoice_map = {
            (e.key.name or str(e.key.id)): e.get("issued_invoice")
            for e in q_entities
        }
        for sid in v1_completed_ids:
            issued_q = q_invoice_map.get(sid)
            # Only count as to_invoice if Quotation exists AND issued_invoice is falsy
            # If Quotation is missing entirely, skip — we cannot verify
            if sid in q_invoice_map and not bool(issued_q):
                stats["to_invoice"] += 1

    # -----------------------------------------------------------------------
    # Migrated records — ShipmentOrder Kind, data_version=2
    # These were written by the V1→V2 migration script.
    # Status is already V2 codes — treat same as Quotation V2 records.
    # -----------------------------------------------------------------------
    migrated_query = client.query(kind="ShipmentOrder")
    migrated_query.add_filter(filter=PropertyFilter("data_version", "=", 2))
    migrated_query.add_filter(filter=PropertyFilter("trash", "=", False))
    if effective_company_id:
        migrated_query.add_filter(filter=PropertyFilter("company_id", "=", effective_company_id))

    migrated_completed_ids: list[str] = []
    for entity in migrated_query.fetch():
        s = entity.get("status", 0)
        if s in V2_ACTIVE_STATUSES:
            stats["active"] += 1
        elif s == STATUS_COMPLETED:
            stats["completed"] += 1
            migrated_completed_ids.append(entity.key.name or str(entity.key.id))
        elif s == STATUS_CANCELLED:
            stats["cancelled"] += 1
        elif s in (STATUS_DRAFT, STATUS_DRAFT_REVIEW):
            stats["draft"] += 1

    # issued_invoice was not carried over by the migration script — read from
    # the original Quotation records (untouched by migration) instead.
    if migrated_completed_ids:
        q_keys = [client.key("Quotation", mid) for mid in migrated_completed_ids]
        q_entities = get_multi_chunked(client, q_keys)
        q_invoice_map = {
            (e.key.name or str(e.key.id)): e.get("issued_invoice")
            for e in q_entities
        }
        for mid in migrated_completed_ids:
            # Only count as to_invoice if Quotation record exists AND issued_invoice is falsy
            # If the Quotation entity is missing, we cannot verify — skip rather than over-count
            if mid in q_invoice_map and not bool(q_invoice_map[mid]):
                stats["to_invoice"] += 1

    stats["total"] = stats["active"] + stats["completed"] + stats["cancelled"] + stats["draft"]

    return {"status": "OK", "data": stats, "msg": "Shipment stats fetched"}


# ---------------------------------------------------------------------------
# Search shipments — in-memory filter (Datastore has no substring queries)
# ---------------------------------------------------------------------------

@router.get("/search")
async def search_shipments(
    q: str = Query(..., min_length=3),
    limit: int = Query(8, ge=1, le=50),
    search_fields: str = Query("id"),  # "id" or "all"
    claims: Claims = Depends(require_auth),
):
    """
    Search shipments by partial ID, company name, or route port codes.

    search_fields="id"  — match shipment ID only (quick search)
    search_fields="all" — match ID + company name + origin/destination ports
    """
    client = get_client()
    q_lower = q.strip().lower()
    q_upper = q.strip().upper()

    # AFC users scoped to own company
    effective_company_id = None
    if claims.is_afc():
        effective_company_id = claims.company_id

    # Extract numeric portion for ID matching (e.g. "3780" or "AFCQ-003780")
    q_digits = "".join(c for c in q if c.isdigit())

    items: list[dict] = []
    seen_ids: set[str] = set()

    # -------------------------------------------------------------------
    # V2 records — Quotation Kind, data_version=2
    # -------------------------------------------------------------------
    v2_query = client.query(kind="Quotation")
    v2_query.add_filter(filter=PropertyFilter("data_version", "=", 2))
    v2_query.add_filter(filter=PropertyFilter("trash", "=", False))
    if effective_company_id:
        v2_query.add_filter(filter=PropertyFilter("company_id", "=", effective_company_id))

    v2_entities = list(v2_query.fetch())
    for entity in v2_entities:
        sid = entity.key.name or str(entity.key.id)
        if _id_matches(sid, q_lower, q_upper, q_digits):
            if sid not in seen_ids:
                items.append(_make_v2_summary(entity))
                seen_ids.add(sid)

    # -------------------------------------------------------------------
    # V1 records — ShipmentOrder Kind (status >= 100 = booking started+)
    # -------------------------------------------------------------------
    v1_query = client.query(kind="ShipmentOrder")
    v1_query.add_filter(filter=PropertyFilter("status", ">=", V1_STATUS_BOOKING_STARTED))
    if effective_company_id:
        v1_query.add_filter(filter=PropertyFilter("company_id", "=", effective_company_id))

    v1_shipment_orders = list(v1_query.fetch())

    # Batch-fetch Quotation records for display fields
    q_keys = [
        client.key("Quotation", e.key.name or str(e.key.id))
        for e in v1_shipment_orders
    ]
    q_entities = get_multi_chunked(client, q_keys) if q_keys else []
    q_map = {(e.key.name or str(e.key.id)): e for e in q_entities}

    for so_entity in v1_shipment_orders:
        # Skip migrated records — they have V2 structure, not V1
        if so_entity.get("data_version") == 2:
            continue
        sid = so_entity.key.name or str(so_entity.key.id)
        if sid in seen_ids:
            continue
        v1_status = so_entity.get("status", 0)
        v2_status = V1_TO_V2_STATUS.get(v1_status, STATUS_CONFIRMED)
        q_entity = q_map.get(sid)

        if _id_matches(sid, q_lower, q_upper, q_digits):
            items.append(_make_v1_summary(so_entity, q_entity, v2_status))
            seen_ids.add(sid)
        elif search_fields == "all":
            # Check port codes
            src = q_entity if q_entity else so_entity
            origin = (
                so_entity.get("origin_port_un_code", "")
                or src.get("origin_port", "")
                or src.get("port_of_loading", "")
            )
            dest = (
                so_entity.get("destination_port_un_code", "")
                or src.get("destination_port", "")
                or src.get("port_of_discharge", "")
            )
            if (origin and q_upper in origin.upper()) or (dest and q_upper in dest.upper()):
                items.append(_make_v1_summary(so_entity, q_entity, v2_status))
                seen_ids.add(sid)

    # Also check V2 port codes if search_fields=all
    if search_fields == "all":
        for entity in v2_entities:
            sid = entity.key.name or str(entity.key.id)
            if sid in seen_ids:
                continue
            origin = entity.get("origin_port", "")
            dest = entity.get("destination_port", "")
            if (origin and q_upper in origin.upper()) or (dest and q_upper in dest.upper()):
                items.append(_make_v2_summary(entity))
                seen_ids.add(sid)

    # -------------------------------------------------------------------
    # V1 fallback — Quotation Kind with has_shipment=true
    # Catches V1 shipments where ShipmentOrder is below threshold or missing
    # -------------------------------------------------------------------
    q_fallback_query = client.query(kind="Quotation")
    q_fallback_query.add_filter(filter=PropertyFilter("has_shipment", "=", True))
    if effective_company_id:
        q_fallback_query.add_filter(filter=PropertyFilter("company_id", "=", effective_company_id))

    for q_entity in q_fallback_query.fetch():
        if q_entity.get("data_version") == 2:
            continue
        sid = q_entity.key.name or str(q_entity.key.id)
        if sid in seen_ids:
            continue
        if _id_matches(sid, q_lower, q_upper, q_digits):
            v2_status = V1_TO_V2_STATUS.get(q_entity.get("status", 0), STATUS_CONFIRMED)
            # Use Quotation as both so_entity and q_entity since ShipmentOrder may be missing
            so_entity = q_map.get(sid)
            if so_entity:
                items.append(_make_v1_summary(so_entity, q_entity, v2_status))
            else:
                items.append(_make_v1_summary(q_entity, q_entity, v2_status))
            seen_ids.add(sid)

    # -------------------------------------------------------------------
    # Company name matching (search_fields=all only)
    # -------------------------------------------------------------------
    if search_fields == "all":
        all_company_ids = list({
            s["company_id"] for s in items if s.get("company_id")
        })
        # Also collect company IDs from entities NOT yet matched
        unmatched_v2 = [e for e in v2_entities if (e.key.name or str(e.key.id)) not in seen_ids]
        unmatched_v1 = [e for e in v1_shipment_orders if (e.key.name or str(e.key.id)) not in seen_ids]
        unmatched_company_ids = list({
            e.get("company_id", "") for e in unmatched_v2 + unmatched_v1 if e.get("company_id")
        })
        all_company_ids_set = set(all_company_ids) | set(unmatched_company_ids)
        names = _batch_company_names(client, list(all_company_ids_set))

        # Match unmatched entities by company name
        for entity in unmatched_v2:
            sid = entity.key.name or str(entity.key.id)
            cname = names.get(entity.get("company_id", ""), "")
            if cname and q_lower in cname.lower():
                summary = _make_v2_summary(entity)
                summary["company_name"] = cname
                items.append(summary)
                seen_ids.add(sid)

        for so_entity in unmatched_v1:
            sid = so_entity.key.name or str(so_entity.key.id)
            if sid in seen_ids:
                continue
            cname = names.get(so_entity.get("company_id", ""), "")
            if cname and q_lower in cname.lower():
                v1_status = so_entity.get("status", 0)
                v2_status = V1_TO_V2_STATUS.get(v1_status, STATUS_CONFIRMED)
                q_entity = q_map.get(sid)
                summary = _make_v1_summary(so_entity, q_entity, v2_status)
                summary["company_name"] = cname
                items.append(summary)
                seen_ids.add(sid)

        # Fill company names for items matched by ID/port
        for s in items:
            if not s["company_name"] and s.get("company_id"):
                s["company_name"] = names.get(s["company_id"], "")
    else:
        # ID-only search: still batch-fill company names for display
        company_ids = list({s["company_id"] for s in items if s.get("company_id")})
        names = _batch_company_names(client, company_ids)
        for s in items:
            if not s["company_name"] and s.get("company_id"):
                s["company_name"] = names.get(s["company_id"], "")

    # Add status_label to each result
    for s in items:
        s["status_label"] = STATUS_LABELS.get(s.get("status", 0), str(s.get("status", 0)))

    # Sort by numeric ID descending, truncate
    def _sort_key(x):
        sid = x.get("shipment_id", "")
        parts = sid.rsplit("-", 1)
        try:
            return int(parts[-1])
        except (ValueError, IndexError):
            return 0

    items.sort(key=_sort_key, reverse=True)
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


def _fmt_date(val) -> str:
    """Coerce a Datastore value to YYYY-MM-DD string using robust parsing."""
    if val is None:
        return ""
    dt = parse_timestamp(val)
    if dt is not None:
        return dt.isoformat()[:10]
    s = str(val).strip()
    return s[:10] if s else ""


_company_name_cache: dict[str, str] = {}
_company_name_cache_ts: float = 0
_COMPANY_CACHE_TTL = 300  # 5 minutes


def _batch_company_names(client, company_ids: list[str]) -> dict[str, str]:
    """Batch-fetch company names from Company Kind with 5-minute cache."""
    global _company_name_cache, _company_name_cache_ts

    if not company_ids:
        return {}

    now = time.monotonic()
    cache_fresh = (now - _company_name_cache_ts) < _COMPANY_CACHE_TTL

    # If cache is fresh and all IDs are cached, return from cache
    if cache_fresh and all(cid in _company_name_cache for cid in company_ids):
        return {cid: _company_name_cache[cid] for cid in company_ids}

    # Fetch only missing IDs from Datastore
    missing = [cid for cid in company_ids if cid not in _company_name_cache or not cache_fresh]
    if missing:
        keys = [client.key("Company", cid) for cid in missing]
        entities = get_multi_chunked(client, keys)
        for e in entities:
            eid = e.key.name or str(e.key.id)
            _company_name_cache[eid] = e.get("name", "")
        _company_name_cache_ts = now

    return {cid: _company_name_cache.get(cid, "") for cid in company_ids}


def _migrated_tab_match(tab: str, entity) -> bool:
    """Tab matching for migrated ShipmentOrder records.

    Same as _v2_tab_match except to_invoice uses bare truthiness check
    for issued_invoice (migrated records may have False, 0, None, or []).
    """
    s = entity.get("status", 0)
    if tab == "all":
        return True
    if tab == "active":
        return s in V2_ACTIVE_STATUSES
    if tab == "completed":
        return s == STATUS_COMPLETED
    if tab == "to_invoice":
        issued = entity.get("issued_invoice")
        return s == STATUS_COMPLETED and not issued
    if tab == "draft":
        return s in _DRAFT_STATUSES
    if tab == "cancelled":
        return s == STATUS_CANCELLED
    return True


def _make_migrated_summary(entity) -> dict:
    """Build summary dict for a migrated ShipmentOrder entity (data_version=2).

    These records use the V2 nested origin/destination structure:
      origin: {port_un_code: "VNSGN", type: "SEA"}
      destination: {port_un_code: "MYPKG", type: "SEA"}
    """
    origin = entity.get("origin") or {}
    destination = entity.get("destination") or {}
    updated = entity.get("updated") or entity.get("created") or ""
    return {
        "shipment_id": entity.key.name or str(entity.key.id),
        "data_version": 2,
        "migrated_from_v1": True,
        "status": entity.get("status", 0),
        "order_type": entity.get("order_type", ""),
        "transaction_type": entity.get("transaction_type", ""),
        "incoterm": entity.get("incoterm") or entity.get("incoterm_code") or "",
        "origin_port": origin.get("port_un_code", "") if isinstance(origin, dict) else "",
        "destination_port": destination.get("port_un_code", "") if isinstance(destination, dict) else "",
        "company_id": entity.get("company_id", ""),
        "company_name": "",  # batch-filled after merge
        "cargo_ready_date": _fmt_date(entity.get("cargo_ready_date")),
        "updated": _fmt_date(updated),
    }


def _make_v2_summary(entity) -> dict:
    """Build summary dict for a V2 Quotation entity."""
    updated = entity.get("updated") or entity.get("modified") or entity.get("created") or ""
    return {
        "shipment_id": entity.key.name or str(entity.key.id),
        "data_version": 2,
        "status": entity.get("status", 0),
        "order_type": entity.get("order_type", ""),
        "transaction_type": entity.get("transaction_type", ""),
        "incoterm": entity.get("incoterm_code", "") or entity.get("incoterm", ""),
        "origin_port": entity.get("origin_port_un_code", "") or entity.get("origin_port", ""),
        "destination_port": entity.get("destination_port_un_code", "") or entity.get("destination_port", ""),
        "company_id": entity.get("company_id", ""),
        "company_name": "",  # batch-filled after merge
        "cargo_ready_date": _fmt_date(entity.get("cargo_ready_date")),
        "updated": _fmt_date(updated),
    }


def _make_v1_summary(so_entity, q_entity, v2_status: int) -> dict:
    """
    Build summary dict for a V1 shipment.

    so_entity:  ShipmentOrder entity (primary — has operational status + port codes + display fields)
    q_entity:   Quotation entity (optional fallback — only used if ShipmentOrder is missing a field)
    v2_status:  V1 status mapped to V2 status code
    """
    updated = (
        so_entity.get("updated")
        or so_entity.get("modified")
        or so_entity.get("created")
        or ""
    )
    return {
        "shipment_id": so_entity.key.name or str(so_entity.key.id),
        "data_version": 1,
        "status": v2_status,
        "order_type": so_entity.get("order_type", "") or so_entity.get("quotation_type", "") or (q_entity.get("quotation_type", "") if q_entity else ""),
        "transaction_type": so_entity.get("transaction_type", "") or (q_entity.get("transaction_type", "") if q_entity else ""),
        "incoterm": so_entity.get("incoterm_code", "") or so_entity.get("incoterm", "") or (q_entity.get("incoterm_code", "") if q_entity else ""),
        "origin_port": so_entity.get("origin_port_un_code", "") or so_entity.get("origin_port", "") or so_entity.get("port_of_loading", ""),
        "destination_port": so_entity.get("destination_port_un_code", "") or so_entity.get("destination_port", "") or so_entity.get("port_of_discharge", ""),
        "company_id": so_entity.get("company_id", ""),
        "company_name": "",  # batch-filled after merge
        "cargo_ready_date": _fmt_date(so_entity.get("cargo_ready_date") or (q_entity.get("cargo_ready_date") if q_entity else None)),
        "updated": _fmt_date(updated),
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
      - V2 records (few): fetched in full on page 1 from Quotation Kind
        (data_version=2), filtered by tab in-memory.
      - V1 records: query ShipmentOrder Kind directly with tab-appropriate
        status filters. Batch-fetch corresponding Quotation records for
        display fields. Paginated via Datastore cursor.
      - to_invoice: fetches ALL completed V1 records (no Datastore-level
        limit) because issued_invoice is filtered in-memory after fetch.
    """
    logger.info(f"[list] tab received: '{tab}' repr: {repr(tab)}")

    if tab not in _VALID_TABS:
        raise HTTPException(status_code=400, detail=f"Unrecognised tab value: {tab}")

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
        v2_query.add_filter(filter=PropertyFilter("data_version", "=", 2))
        v2_query.add_filter(filter=PropertyFilter("trash", "=", False))
        if effective_company_id:
            v2_query.add_filter(filter=PropertyFilter("company_id", "=", effective_company_id))
        v2_count = 0
        for entity in v2_query.fetch():
            if _v2_tab_match(tab, entity):
                items.append(_make_v2_summary(entity))
                v2_count += 1

        if tab == "to_invoice":
            logger.info("[to_invoice] V2 Quotation matches: %d records", v2_count)

    # -------------------------------------------------------------------
    # Migrated records — ShipmentOrder Kind, data_version=2
    # Status is V2 codes. Origin/dest use nested dict structure.
    # Note: issued_invoice was not carried over by the migration script,
    # so for to_invoice tab we fetch all completed then post-filter via
    # the original Quotation records.
    # -------------------------------------------------------------------
    if not cursor:  # Only on first page — migrated records included with V2
        migrated_query = client.query(kind="ShipmentOrder")
        migrated_query.add_filter(filter=PropertyFilter("data_version", "=", 2))
        migrated_query.add_filter(filter=PropertyFilter("trash", "=", False))
        if effective_company_id:
            migrated_query.add_filter(
                filter=PropertyFilter("company_id", "=", effective_company_id)
            )
        # For to_invoice: match as "completed", post-filter after Quotation lookup
        migrated_tab = "completed" if tab == "to_invoice" else tab
        migrated_items: list[dict] = []
        for entity in migrated_query.fetch():
            if _migrated_tab_match(migrated_tab, entity):
                migrated_items.append(_make_migrated_summary(entity))

        if tab == "to_invoice" and migrated_items:
            # Batch-fetch Quotation records to check issued_invoice
            mig_ids = [m["shipment_id"] for m in migrated_items]
            q_keys = [client.key("Quotation", mid) for mid in mig_ids]
            q_entities = get_multi_chunked(client, q_keys)
            q_invoice_map = {
                (e.key.name or str(e.key.id)): e.get("issued_invoice")
                for e in q_entities
            }
            for m in migrated_items:
                issued = q_invoice_map.get(m["shipment_id"])
                if not issued:
                    items.append(m)
        else:
            items.extend(migrated_items)

    # -------------------------------------------------------------------
    # V1 records — query ShipmentOrder Kind directly with status filters.
    # This mirrors the stats endpoint strategy and avoids the unreliable
    # has_shipment flag on Quotation Kind.
    # -------------------------------------------------------------------

    # draft and cancelled tabs have no V1 results
    if tab not in ("draft", "cancelled"):
        v1_query = client.query(kind="ShipmentOrder")

        # Fetch all V1 records that have been confirmed (status >= 100).
        # Tab filtering is done in-memory after resolving mixed V1/V2 status codes.
        # Cannot use tight Datastore-level status filters because write endpoints
        # have stored V2 codes (3001, 5001 etc.) on some V1 ShipmentOrder records.
        v1_query.add_filter(filter=PropertyFilter("status", ">=", V1_STATUS_BOOKING_STARTED))

        if effective_company_id:
            v1_query.add_filter(filter=PropertyFilter("company_id", "=", effective_company_id))

        # to_invoice: fetch ALL completed V1 records because issued_invoice
        # is filtered in-memory after fetch. Using a Datastore limit here
        # would return only N completed records, most of which may already
        # be invoiced — resulting in an empty page even when uninvoiced
        # records exist further in the dataset.
        if tab == "to_invoice":
            v1_shipment_orders = list(v1_query.fetch())
            v1_next_cursor = None  # no cursor pagination for to_invoice
        else:
            start_cursor = base64.urlsafe_b64decode(cursor) if cursor else None
            v1_iter = v1_query.fetch(limit=limit, start_cursor=start_cursor)
            page = next(v1_iter.pages)
            v1_shipment_orders = list(page)
            token = v1_iter.next_page_token
            v1_next_cursor = base64.urlsafe_b64encode(token).decode() if token else None

        if tab == "to_invoice":
            logger.info("[to_invoice] ShipmentOrder query returned: %d records", len(v1_shipment_orders))

        if v1_shipment_orders:
            # Display fields are read directly from ShipmentOrder — no Quotation batch fetch needed.
            if tab == "to_invoice":
                logger.info("[to_invoice] Processing %d ShipmentOrders (no Quotation join)", len(v1_shipment_orders))

            if tab == "to_invoice":
                # Two-pass: collect completed V1 records where SO doesn't have issued=True,
                # then batch-fetch Quotation records to verify issued_invoice
                completed_candidates = []
                for so_entity in v1_shipment_orders:
                    if so_entity.get("data_version") == 2:
                        continue
                    raw_status = so_entity.get("status", 0)
                    v2_status = _resolve_so_status_to_v2(raw_status)
                    if v2_status != STATUS_COMPLETED:
                        continue
                    so_issued = bool(so_entity.get("issued_invoice", False))
                    if so_issued:
                        continue  # definitely invoiced
                    completed_candidates.append((so_entity, v2_status))

                if completed_candidates:
                    candidate_ids = [e.key.name or str(e.key.id) for e, _ in completed_candidates]
                    q_keys = [client.key("Quotation", sid) for sid in candidate_ids]
                    q_entities = get_multi_chunked(client, q_keys)
                    q_inv_map = {
                        (e.key.name or str(e.key.id)): bool(e.get("issued_invoice", False))
                        for e in q_entities
                    }
                    for so_entity, v2_status in completed_candidates:
                        sid = so_entity.key.name or str(so_entity.key.id)
                        # OR logic: invoiced if either SO or Quotation says so
                        if q_inv_map.get(sid, False):
                            continue  # Quotation says invoiced — skip
                        items.append(_make_v1_summary(so_entity, None, v2_status))

                logger.info("[to_invoice] V1 records after two-source filter: %d",
                            sum(1 for s in items if s.get("data_version") == 1))
            else:
                # All other tabs — single-pass
                for so_entity in v1_shipment_orders:
                    if so_entity.get("data_version") == 2:
                        continue
                    raw_status = so_entity.get("status", 0)
                    v2_status = _resolve_so_status_to_v2(raw_status)
                    if tab == "active" and v2_status not in V2_ACTIVE_STATUSES:
                        continue
                    if tab == "completed" and v2_status != STATUS_COMPLETED:
                        continue
                    items.append(_make_v1_summary(so_entity, None, v2_status))

    # -------------------------------------------------------------------
    # Batch-fetch company names
    # -------------------------------------------------------------------
    company_ids = list({s["company_id"] for s in items if s.get("company_id")})
    names = _batch_company_names(client, company_ids)
    for s in items:
        s["company_name"] = names.get(s.get("company_id", ""), "")

    # Sort by shipment ID numeric suffix descending (e.g. AFCQ-003864 → 3864)
    def _id_sort_key(x):
        sid = x.get("shipment_id", "")
        parts = sid.rsplit("-", 1)
        try:
            return int(parts[-1])
        except (ValueError, IndexError):
            return 0

    items.sort(key=_id_sort_key, reverse=True)
    result = items[:limit]

    if tab == "to_invoice":
        logger.info("[to_invoice] Final response: %d shipments", len(result))

    return {
        "shipments": result,
        "next_cursor": v1_next_cursor,
        "total_shown": len(result),
    }


# ---------------------------------------------------------------------------
# Status history — read from ShipmentWorkFlow
# ---------------------------------------------------------------------------

@router.get("/{shipment_id}/status-history")
async def get_status_history(
    shipment_id: str,
    claims: Claims = Depends(require_auth),
):
    """
    Return the status change history for a shipment.

    Reads from ShipmentWorkFlow.status_history. Records created before
    this feature was added will have an empty history array.
    """
    client = get_client()
    wf_entity = client.get(client.key("ShipmentWorkFlow", shipment_id))
    if not wf_entity:
        raise NotFoundError(f"Shipment workflow {shipment_id} not found")

    # AFC users: verify company ownership via the workflow's company_id
    if claims.is_afc():
        wf_company = wf_entity.get("company_id", "")
        if wf_company != claims.company_id:
            raise NotFoundError(f"Shipment workflow {shipment_id} not found")

    history = wf_entity.get("status_history") or []
    # Ensure sorted by timestamp ascending
    history = sorted(history, key=lambda h: h.get("timestamp", ""))

    return {"status": "OK", "history": history}


# ---------------------------------------------------------------------------
# Lazy-init workflow tasks helper
# ---------------------------------------------------------------------------

def _lazy_init_tasks(client, shipment_id: str, shipment_data: dict) -> list[dict]:
    """
    Check if ShipmentWorkFlow has workflow_tasks. If empty, auto-generate
    from incoterm + transaction_type and persist. Returns the task list.
    """
    from datetime import date as _date

    wf_key = client.key("ShipmentWorkFlow", shipment_id)
    wf_entity = client.get(wf_key)

    if not wf_entity:
        return []

    existing_tasks = wf_entity.get("workflow_tasks") or []
    if existing_tasks:
        return existing_tasks

    # Need both incoterm and transaction_type to generate
    incoterm = shipment_data.get("incoterm_code") or wf_entity.get("incoterm") or ""
    txn_type = shipment_data.get("transaction_type") or wf_entity.get("transaction_type") or ""

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
        wf_entity["workflow_tasks"] = tasks
        wf_entity["updated"] = datetime.now(timezone.utc).isoformat()
        wf_entity.exclude_from_indexes = set(wf_entity.exclude_from_indexes or set()) | {"workflow_tasks"}
        client.put(wf_entity)

    return tasks


# ---------------------------------------------------------------------------
# 1b. GET /file-tags
# ---------------------------------------------------------------------------

@router.get("/file-tags")
async def get_file_tags(
    claims: Claims = Depends(require_auth),
):
    """Return all file tags from FileTags Kind."""
    client = get_client()
    query = client.query(kind="FileTags")
    results = []
    for entity in query.fetch():
        d = dict(entity)
        d["tag_id"] = entity.key.name or str(entity.key.id)
        results.append(d)
    return {"status": "OK", "data": results}


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
      AF-XXXXX   → V2 record (Quotation Kind, data_version=2)
      AF2-XXXXX  → V2 record (legacy prefix, same as AF-)
      AFCQ-XXXXX → V1 record (Quotation + ShipmentOrder join)
    """
    client = get_client()

    if shipment_id.startswith(PREFIX_V2_SHIPMENT) or shipment_id.startswith("AF2-"):
        # V2 — read from Quotation Kind
        entity = client.get(client.key("Quotation", shipment_id))
        if not entity or entity.get("data_version") != 2:
            raise NotFoundError(f"Shipment {shipment_id} not found")

        data = entity_to_dict(entity)

        # AFC users can only access their own company's shipments
        if claims.is_afc() and data.get("company_id") != claims.company_id:
            raise NotFoundError(f"Shipment {shipment_id} not found")

        # Lazy-init workflow_tasks
        data["workflow_tasks"] = _lazy_init_tasks(client, shipment_id, data)

        return {"status": "OK", "data": data, "msg": "Shipment fetched"}

    elif shipment_id.startswith(PREFIX_V1_SHIPMENT):
        # Check ShipmentOrder Kind first — may be migrated (data_version=2)
        # or V1 legacy (data_version=1 or absent)
        so_entity = client.get(client.key("ShipmentOrder", shipment_id))
        if not so_entity:
            raise NotFoundError(f"Shipment {shipment_id} not found")

        data_version = so_entity.get("data_version") or 1

        if data_version == 2:
            # Migrated record — return directly, same as V2
            data = entity_to_dict(so_entity)
            if claims.is_afc() and data.get("company_id") != claims.company_id:
                raise NotFoundError(f"Shipment {shipment_id} not found")
            return {"status": "OK", "data": data, "msg": "Shipment fetched"}
        else:
            # V1 legacy — join with Quotation for display fields
            data = entity_to_dict(so_entity)
            quotation_id = data.get("quotation_id") or data.get("shipment_order_id")
            if quotation_id:
                q_entity = client.get(client.key("Quotation", quotation_id))
                if q_entity:
                    q_data = entity_to_dict(q_entity)
                    data["quotation"] = q_data
                    # Merge key display fields from Quotation into top-level
                    # so platform reads them without needing to check data.quotation
                    for field in ("vessel_name", "voyage_number", "booking", "parties", "etd"):
                        # Use falsy check (not just None) — V1 SO fields may be empty string ""
                        if not data.get(field):
                            if q_data.get(field):
                                data[field] = q_data[field]
            # Look up human-readable port names for tooltip display
            origin_code = data.get("origin_port_un_code")
            dest_code = data.get("destination_port_un_code")
            origin_terminal = data.get("origin_terminal_id")
            dest_terminal = data.get("destination_terminal_id")
            origin_label = _get_port_label(client, origin_code, origin_terminal)
            dest_label = _get_port_label(client, dest_code, dest_terminal)
            if origin_label:
                data["origin_port_label"] = origin_label
            if dest_label:
                data["destination_port_label"] = dest_label

            if claims.is_afc() and data.get("company_id") != claims.company_id:
                raise NotFoundError(f"Shipment {shipment_id} not found")
            return {"status": "OK", "data": data, "msg": "V1 Shipment fetched"}

    else:
        raise NotFoundError(f"Invalid shipment ID format: {shipment_id}")


# ---------------------------------------------------------------------------
# Update shipment status  (V1 + V2, atomic status + history write)
# ---------------------------------------------------------------------------

# V1 ↔ V2 status mapping (new codes — v2.18)
_V1_TO_V2: dict[int, int] = {
    100:   2001,   # Created → Confirmed
    110:   3002,   # Booking Confirmed → Booking Confirmed
    4110:  4001,   # In Transit → Departed
    10000: 5001,   # Completed → Completed
}
# V2 → V1: maps V2 codes that have exact V1 equivalents.
_V2_TO_V1: dict[int, int] = {
    2001:  100,    # Confirmed → Created
    3002:  110,    # Booking Confirmed → Booking Confirmed
    4001:  4110,   # Departed → In Transit
    5001:  10000,  # Completed → Completed
    -1:    -1,     # Cancelled → Cancelled
}

# Minimum V2 status code allowed for V1 reversion (pre-booking states not allowed)
_V1_REVERT_MIN_STATUS = 2001


class UpdateStatusRequest(BaseModel):
    status: int
    allow_jump: bool = False
    reverted: bool = False


@router.patch("/{shipment_id}/status")
async def update_shipment_status(
    shipment_id: str,
    body: UpdateStatusRequest,
    claims: Claims = Depends(require_afu),
):
    """
    Update a shipment's status with atomic status + history write.

    Incoterm-aware: determines Path A (booking) or Path B (no booking)
    and validates the requested status is the correct next step on that path.

    Handles both V1 (AFCQ-) and V2 (AF- / AF2-) records.
    Appends to ShipmentWorkFlow.status_history in the same request.
    """
    logger.info(f"[status write] shipment: {shipment_id} new_status: {body.status} reverted: {body.reverted}")
    client = get_client()
    now = datetime.now(timezone.utc).isoformat()
    new_status = body.status

    # --- a. Read Quotation entity ---
    q_key = client.key("Quotation", shipment_id)
    q_entity = client.get(q_key)
    if not q_entity:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    # --- b. Determine V1 vs V2 ---
    data_version = q_entity.get("data_version") or 1
    is_v1 = shipment_id.startswith(PREFIX_V1_SHIPMENT) or data_version < 2

    # --- c. Resolve current V2 status ---
    so_entity = None
    if is_v1:
        so_key = client.key("ShipmentOrder", shipment_id)
        so_entity = client.get(so_key)
        if not so_entity:
            raise NotFoundError(f"V1 ShipmentOrder record {shipment_id} not found")
        v1_status = so_entity.get("status", 0)
        if v1_status == -1:
            current_status = -1
        else:
            current_status = _V1_TO_V2.get(v1_status, v1_status if v1_status in _V2_TO_V1 else STATUS_CONFIRMED)
    else:
        current_status = q_entity.get("status", 0)

    # --- c2. Determine incoterm-aware status path ---
    incoterm = q_entity.get("incoterm_code") or q_entity.get("incoterm") or ""
    txn_type = q_entity.get("transaction_type") or ""
    path = get_status_path(incoterm, txn_type) if incoterm and txn_type else "A"
    path_list = get_status_path_list(incoterm, txn_type) if incoterm and txn_type else None

    # --- d. Terminal state protection (skipped for reversion) ---
    if not body.reverted:
        if current_status == STATUS_COMPLETED or current_status == STATUS_CANCELLED:
            return {"status": "ERROR", "msg": "Cannot change status of a completed or cancelled shipment"}

    # --- d2. V1 reversion guard: cannot revert to pre-booking states ---
    if body.reverted and is_v1 and new_status < _V1_REVERT_MIN_STATUS:
        return {"status": "ERROR", "msg": "Cannot revert V1 record to pre-booking status"}

    # --- d3. Path B guard: reject booking statuses for non-booking paths ---
    if path == "B" and new_status in (STATUS_BOOKING_PENDING, STATUS_BOOKING_CONFIRMED):
        return {"status": "ERROR", "msg": f"Booking statuses not applicable for {incoterm} {txn_type} (Path B)"}

    # --- e. Validate transition using path-aware logic ---
    if not body.allow_jump and not body.reverted:
        if path_list and current_status in path_list and new_status != STATUS_CANCELLED:
            current_idx = path_list.index(current_status)
            # Only allow advancing to the next step on the path, or cancelling
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
        elif new_status == STATUS_CANCELLED:
            pass  # Cancellation always allowed from non-terminal
        elif not path_list:
            # Fallback if no incoterm — use simple forward check
            all_codes = [1001, 1002, 2001, 3001, 3002, 4001, 4002, 5001]
            if current_status in all_codes and new_status in all_codes:
                if all_codes.index(new_status) <= all_codes.index(current_status):
                    return {"status": "ERROR", "msg": "Cannot go backwards without revert flag"}

    # --- f. Build Quotation update ---
    q_update: dict = {
        "status": new_status,
        "last_status_updated": now,
        "updated": now,
    }

    # Append to Quotation status_history (backward compat)
    q_history = q_entity.get("status_history") or []
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
    q_update["status_history"] = list(q_history) + [q_history_entry]

    # --- g. Write Quotation ---
    for k, v in q_update.items():
        q_entity[k] = v
    q_entity.exclude_from_indexes = set(q_entity.exclude_from_indexes or set()) | {"status_history"}
    client.put(q_entity)

    # --- h. V1: also write to ShipmentOrder ---
    if is_v1 and so_entity:
        v1_new_status = _V2_TO_V1.get(new_status, new_status)
        so_entity["status"] = v1_new_status
        so_entity["last_status_updated"] = now
        so_entity["updated"] = now
        # GUARD: never tag a V1 ShipmentOrder as data_version=2
        if so_entity.get("data_version") == 2:
            so_entity["data_version"] = None
        client.put(so_entity)

    # --- i. Append to ShipmentWorkFlow.status_history ---
    wf_key = client.key("ShipmentWorkFlow", shipment_id)
    wf_entity = client.get(wf_key)
    if wf_entity:
        wf_history = wf_entity.get("status_history") or []
        wf_history_entry: dict = {
            "status": new_status,
            "status_label": STATUS_LABELS.get(new_status, str(new_status)),
            "timestamp": now,
            "changed_by": claims.uid,
        }
        if body.reverted:
            wf_history_entry["reverted"] = True
            wf_history_entry["reverted_from"] = current_status
        wf_entity["status_history"] = list(wf_history) + [wf_history_entry]
        wf_entity["updated"] = now
        if new_status == STATUS_COMPLETED:
            wf_entity["completed"] = True
        elif new_status == STATUS_CANCELLED:
            wf_entity["completed"] = False
        wf_entity.exclude_from_indexes = set(wf_entity.exclude_from_indexes or set()) | {"status_history"}
        client.put(wf_entity)

    logger.info(
        "Status updated %s: %s → %s (path %s) by %s",
        shipment_id, current_status, new_status, path, claims.uid,
    )

    return {
        "status": "OK",
        "data": {"shipment_id": shipment_id, "new_status": new_status, "path": path},
        "msg": "Status updated",
    }


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

    client = get_client()
    now = datetime.now(timezone.utc).isoformat()

    # Read the shipment record
    q_key = client.key("Quotation", shipment_id)
    q_entity = client.get(q_key)
    if not q_entity:
        # Try ShipmentOrder for migrated V1
        q_key = client.key("ShipmentOrder", shipment_id)
        q_entity = client.get(q_key)
    if not q_entity:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    # AFC company check
    if claims.is_afc() and q_entity.get("company_id") != claims.company_id:
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

    q_entity["exception"] = exception_data
    q_entity["updated"] = now
    client.put(q_entity)

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
):
    """
    Reassign a shipment to a different company. AFU staff only.

    For V1 records: writes company_id to both ShipmentOrder and Quotation.
    For V2 records: writes company_id to Quotation only.
    """
    client = get_client()
    now = datetime.now(timezone.utc).isoformat()

    # Validate company exists
    company_entity = client.get(client.key("Company", body.company_id))
    if not company_entity:
        raise NotFoundError(f"Company {body.company_id} not found")

    company_name = (
        company_entity.get("name")
        or company_entity.get("short_name")
        or body.company_id
    )

    if shipment_id.startswith(PREFIX_V2_SHIPMENT) or shipment_id.startswith("AF2-"):
        # V2 — update Quotation only
        q_key = client.key("Quotation", shipment_id)
        q_entity = client.get(q_key)
        if not q_entity:
            raise NotFoundError(f"Shipment {shipment_id} not found")

        q_entity["company_id"] = body.company_id
        q_entity["updated"] = now
        client.put(q_entity)

    elif shipment_id.startswith(PREFIX_V1_SHIPMENT):
        # V1 — update both ShipmentOrder and Quotation to keep in sync
        so_key = client.key("ShipmentOrder", shipment_id)
        so_entity = client.get(so_key)
        if not so_entity:
            raise NotFoundError(f"Shipment {shipment_id} not found")

        so_entity["company_id"] = body.company_id
        so_entity["updated"] = now

        q_key = client.key("Quotation", shipment_id)
        q_entity = client.get(q_key)

        entities_to_put = [so_entity]
        if q_entity:
            q_entity["company_id"] = body.company_id
            q_entity["updated"] = now
            entities_to_put.append(q_entity)

        client.put_multi(entities_to_put)

    else:
        raise NotFoundError(f"Invalid shipment ID format: {shipment_id}")

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


def _match_port_un_code(client, port_text: str) -> str | None:
    """Match free-text port name to a Geography Kind UN code."""
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
        entity = client.get(client.key("Geography", port_text_upper))
        if entity:
            logger.info("[port_match] Direct UN code hit: %s", port_text_upper)
            return port_text_upper

    # Search Port Kind for matching name
    query = client.query(kind="Port")
    best_match = None
    sample_logged = False
    for entity in query.fetch():
        name = (entity.get("name") or "").upper()
        un_code = (entity.get("un_code") or entity.key.name or "").upper()
        if not sample_logged:
            logger.info("[port_match] Sample Port record — key: '%s', un_code: '%s', name: '%s'",
                        entity.key.name, un_code, name)
            sample_logged = True
        if name == port_text_upper:
            logger.info("[port_match] Exact name match: %s -> %s", port_text_upper, un_code)
            return un_code
        if port_text_upper in name or name in port_text_upper:
            logger.info("[port_match] Contains match: '%s' ~ '%s' -> %s", port_text_upper, name, un_code)
            best_match = un_code

    logger.info("[port_match] Result for '%s': %s", port_text_upper, best_match)
    return best_match


def _match_company(client, consignee_name: str) -> list[dict]:
    """Match consignee name against Company Kind. Returns top 3 matches."""
    if not consignee_name:
        return []
    name_lower = consignee_name.lower().strip()
    logger.info("[company_match] Looking for: '%s'", name_lower)
    query = client.query(kind="Company")
    matches: list[dict] = []

    import re as _re
    def _normalise(s: str) -> str:
        """Strip punctuation, collapse spaces for fuzzy comparison."""
        s = s.lower()
        s = _re.sub(r'[^a-z0-9\s]', ' ', s)  # remove punctuation
        s = _re.sub(r'\s+', ' ', s).strip()   # collapse whitespace
        return s

    name_norm = _normalise(name_lower)
    name_words = [w for w in name_norm.split() if len(w) > 2]

    for entity in query.fetch():
        company_name = entity.get("name") or ""
        if not company_name:
            continue
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
                "company_id": entity.key.name or str(entity.key.id),
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
):
    """
    Parse a Bill of Lading PDF or image using Claude API.
    Returns structured extracted data + company matches + derived fields.
    """
    import json
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
    ds_client = get_client()

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
    origin_un_code = _match_port_un_code(ds_client, origin_parsed_label)
    destination_un_code = _match_port_un_code(ds_client, destination_parsed_label)

    # Initial status
    initial_status = _determine_initial_status(parsed.get("on_board_date"))

    # Company matching
    company_matches = _match_company(ds_client, parsed.get("consignee_name") or "")

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
):
    """
    Create a V2 shipment from parsed BL data.
    Creates Quotation + ShipmentWorkFlow + auto-generates tasks.
    """
    client = get_client()
    now = datetime.now(timezone.utc).isoformat()

    # Generate shipment ID — scan-based global max (same logic as shipments-write.ts)
    # Scans ShipmentOrderV2CountId for V2 max and Quotation keys for V1 AFCQ- max.
    # Ensures the AF- sequence never collides with AFCQ- or previously issued AF- IDs.

    # 1. Max V2 countid from ShipmentOrderV2CountId
    v2_query = client.query(kind="ShipmentOrderV2CountId")
    v2_entities = list(v2_query.fetch())
    v2_max = 0
    for e in v2_entities:
        val = e.get("countid") or 0
        if isinstance(val, (int, float)) and int(val) > v2_max:
            v2_max = int(val)

    # 2. Max V1 countid from AFCQ- Quotation keys
    v1_query = client.query(kind="Quotation")
    v1_query.keys_only()
    v1_entities = list(v1_query.fetch())
    v1_max = 0
    for e in v1_entities:
        key_name = e.key.name or ""
        if key_name.startswith("AFCQ-"):
            try:
                num = int(key_name[5:])
                if num > v1_max:
                    v1_max = num
            except ValueError:
                pass

    # 3. Also scan AF- and AF2- keys to catch any previously issued V2 IDs
    for e in v1_entities:
        key_name = e.key.name or ""
        for prefix in ("AF-", "AF2-"):
            if key_name.startswith(prefix):
                try:
                    num = int(key_name[len(prefix):])
                    if num > v2_max:
                        v2_max = num
                except ValueError:
                    pass

    new_countid = max(v2_max, v1_max) + 1
    shipment_id = f"AF-{new_countid:06d}"

    # Register in ShipmentOrderV2CountId (matches the atomic write pattern in shipments-write.ts)
    counter_key = client.key("ShipmentOrderV2CountId", shipment_id)
    counter_entity = client.entity(counter_key)
    counter_entity["countid"] = new_countid
    counter_entity["created"] = now
    client.put(counter_entity)

    # Build Quotation entity
    q_key = client.key("Quotation", shipment_id)
    q_entity = client.entity(q_key)
    q_entity.update({
        "quotation_id": shipment_id,
        "countid": new_countid,
        "data_version": 2,
        "company_id": body.company_id or "",
        "order_type": body.order_type,
        "transaction_type": body.transaction_type,
        "incoterm_code": body.incoterm_code,
        "status": body.initial_status,
        "issued_invoice": False,
        "last_status_updated": now,
        "status_history": [{
            "status": body.initial_status,
            "label": STATUS_LABELS.get(body.initial_status, str(body.initial_status)),
            "timestamp": now,
            "changed_by": claims.email,
            "note": "Created from BL upload",
        }],
        "parent_id": None,
        "related_orders": [],
        "commercial_quotation_ids": [],
        "origin": {
            "type": "PORT",
            "port_un_code": body.origin_port_un_code,
            "terminal_id": body.origin_terminal_id,
            "city_id": None,
            "address": None,
            "country_code": None,
            "label": body.origin_label or body.origin_port_un_code or "",
        } if body.origin_port_un_code else None,
        "destination": {
            "type": "PORT",
            "port_un_code": body.destination_port_un_code,
            "terminal_id": body.destination_terminal_id,
            "city_id": None,
            "address": None,
            "country_code": None,
            "label": body.destination_label or body.destination_port_un_code or "",
        } if body.destination_port_un_code else None,
        "origin_port_un_code": body.origin_port_un_code or "",
        "origin_terminal_id": body.origin_terminal_id or None,
        "destination_port_un_code": body.destination_port_un_code or "",
        "destination_terminal_id": body.destination_terminal_id or None,
        "cargo": {
            "description": body.cargo_description or "",
            "hs_code": None,
            "is_dg": False,
            "dg_class": None,
            "dg_un_number": None,
        },
        "type_details": None,
        "booking": {
            "carrier": body.carrier,
            "booking_reference": body.waybill_number,
            "vessel_name": body.vessel_name,
            "voyage_number": body.voyage_number,
        },
        "parties": {
            "shipper": {"name": body.shipper_name, "address": body.shipper_address, "contact_person": None, "phone": None, "email": None, "company_id": None, "company_contact_id": None} if body.shipper_name else None,
            "consignee": {"name": body.consignee_name, "address": body.consignee_address, "contact_person": None, "phone": None, "email": None, "company_id": body.company_id, "company_contact_id": None} if body.consignee_name else None,
            "notify_party": {"name": body.notify_party_name, "address": None, "contact_person": None, "phone": None, "email": None, "company_id": None, "company_contact_id": None} if body.notify_party_name else None,
        },
        "customs_clearance": [],
        "exception": None,
        "tracking_id": None,
        "files": [],
        "trash": False,
        "cargo_ready_date": None,
        "etd": body.etd,
        "eta": None,
        "creator": {"uid": claims.uid, "email": claims.email},
        "user": claims.email,
        "created": now,
        "updated": now,
        "customer_reference": body.customer_reference,
    })
    q_entity.exclude_from_indexes = {"status_history", "booking", "parties", "cargo", "type_details", "origin", "destination", "customs_clearance"}
    client.put(q_entity)

    # Create ShipmentWorkFlow
    wf_key = client.key("ShipmentWorkFlow", shipment_id)
    wf_entity = client.entity(wf_key)

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

    wf_entity.update({
        "shipment_id": shipment_id,
        "company_id": body.company_id or "",
        "status_history": [{
            "status": body.initial_status,
            "status_label": STATUS_LABELS.get(body.initial_status, str(body.initial_status)),
            "timestamp": now,
            "changed_by": claims.uid,
        }],
        "workflow_tasks": tasks,
        "completed": False,
        "created": now,
        "updated": now,
    })
    wf_entity.exclude_from_indexes = {"status_history", "workflow_tasks"}
    client.put(wf_entity)

    logger.info("Shipment %s created from BL by %s", shipment_id, claims.uid)

    return {
        "status": "OK",
        "data": {"shipment_id": shipment_id},
        "msg": "Shipment created from BL",
    }


# ---------------------------------------------------------------------------
# Create shipment  (V2 only — stub)
# ---------------------------------------------------------------------------

@router.post("/create-manual")
async def create_shipment(
    claims: Claims = Depends(require_auth),
):
    """
    Create a new V2 ShipmentOrder (manual entry).

    Currently handled by shipments-write.ts in the Next.js layer.
    This endpoint will replace that once the server is wired up.
    """
    return {
        "status": "OK",
        "data": None,
        "msg": "Shipment create — implementation in progress",
    }


# ---------------------------------------------------------------------------
# GET /shipments/{shipment_id}/tasks
# ---------------------------------------------------------------------------

@router.get("/{shipment_id}/tasks")
async def get_shipment_tasks(
    shipment_id: str,
    claims: Claims = Depends(require_auth),
):
    """
    Get the workflow tasks for a shipment.
    Auto-generates tasks on first access if incoterm + transaction_type are set.
    """
    client = get_client()

    # Fetch shipment data for AFC company check and lazy init
    q_entity = client.get(client.key("Quotation", shipment_id))
    if not q_entity:
        # Try ShipmentOrder for V1
        q_entity = client.get(client.key("ShipmentOrder", shipment_id))
    if not q_entity:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    shipment_data = entity_to_dict(q_entity)

    # AFC users can only see their own company's shipments
    if claims.is_afc() and shipment_data.get("company_id") != claims.company_id:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    tasks = _lazy_init_tasks(client, shipment_id, shipment_data)

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
):
    """
    Update a single task within workflow_tasks on ShipmentWorkFlow.
    Permission enforcement:
      AFU: all fields
      AFC_ADMIN / AFC_M: all except visibility
      AFC (regular): read-only — 403
    """
    client = get_client()
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

    # --- Load ShipmentWorkFlow ---
    wf_key = client.key("ShipmentWorkFlow", shipment_id)
    wf_entity = client.get(wf_key)
    if not wf_entity:
        raise NotFoundError(f"ShipmentWorkFlow for {shipment_id} not found")

    tasks: list[dict] = wf_entity.get("workflow_tasks") or []

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

    # --- FREIGHT_BOOKING completion → unblock EXPORT_CLEARANCE ---
    if body.status == COMPLETED and task.get("task_type") == FREIGHT_BOOKING:
        # Check shipment for booking_reference
        q_entity = client.get(client.key("Quotation", shipment_id))
        booking_ref = ""
        if q_entity:
            booking = q_entity.get("booking") or {}
            booking_ref = booking.get("booking_reference", "") if isinstance(booking, dict) else ""
            if not booking_ref:
                booking_ref = q_entity.get("booking_reference", "") or ""

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
    wf_entity["workflow_tasks"] = tasks
    wf_entity["updated"] = now
    wf_entity.exclude_from_indexes = set(wf_entity.exclude_from_indexes or set()) | {"workflow_tasks"}
    client.put(wf_entity)

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


def _file_entity_to_dict(entity) -> dict:
    """Convert a Files Datastore entity to a response dict."""
    d = dict(entity)
    d["file_id"] = entity.key.id
    return d


def _save_file_to_gcs(bucket, gcs_path: str, file_bytes: bytes, content_type: str = "application/octet-stream"):
    """Upload bytes to GCS at the given path."""
    blob = bucket.blob(gcs_path)
    blob.upload_from_string(file_bytes, content_type=content_type)


def _create_file_entity(
    client,
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
    """Create a Files entity in Datastore and return it as dict."""
    now = datetime.now(timezone.utc).isoformat()

    # Use incomplete key for auto-ID
    key = client.key("Files")
    entity = client.entity(key)
    entity.update({
        "shipment_order_id": shipment_id,
        "company_id": company_id,
        "category": "shipments",
        "file_name": file_name,
        "file_location": gcs_path,
        "file_tags": file_tags or [],
        "file_description": None,
        "file_size": round(file_size_kb, 2),
        "visibility": visibility,
        "notification_sent": False,
        "permission": {"role": "AFU", "owner": uploader_uid},
        "user": uploader_email,
        "created": now,
        "updated": now,
        "trash": False,
    })
    entity.exclude_from_indexes = {"file_tags", "permission", "file_description"}
    client.put(entity)

    return _file_entity_to_dict(entity)


# ---------------------------------------------------------------------------
# 1a. GET /shipments/{shipment_id}/files
# ---------------------------------------------------------------------------

@router.get("/{shipment_id}/files")
async def list_shipment_files(
    shipment_id: str,
    claims: Claims = Depends(require_auth),
):
    """List files for a shipment. AFC regular users only see visible files."""
    client = get_client()

    query = client.query(kind="Files")
    query.add_filter(filter=PropertyFilter("shipment_order_id", "=", shipment_id))
    query.add_filter(filter=PropertyFilter("trash", "=", False))

    results = []
    for entity in query.fetch():
        # AFC regular users: only visible files
        if claims.is_afc() and claims.role not in (AFC_ADMIN, AFC_M):
            if not entity.get("visibility", True):
                continue
        results.append(_file_entity_to_dict(entity))

    # Sort by created DESC
    results.sort(key=lambda f: f.get("created", ""), reverse=True)

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
):
    """Upload a file to a shipment. AFU or AFC Admin/Manager only."""
    # Permission check
    if claims.is_afc() and claims.role not in (AFC_ADMIN, AFC_M):
        raise ForbiddenError("Only staff or company admins/managers can upload files")

    client = get_client()

    # Parse form fields
    try:
        tags_list = _json.loads(file_tags)
    except (ValueError, TypeError):
        tags_list = []
    vis_bool = visibility.lower() in ("true", "1", "yes")

    # Read the shipment to get company_id
    q_entity = client.get(client.key("Quotation", shipment_id))
    if not q_entity:
        q_entity = client.get(client.key("ShipmentOrder", shipment_id))
    if not q_entity:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    company_id = q_entity.get("company_id", "")

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

    # Create Files entity
    file_record = _create_file_entity(
        client=client,
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
):
    """Update file tags and/or visibility. AFU or AFC Admin/Manager."""
    if claims.is_afc() and claims.role not in (AFC_ADMIN, AFC_M):
        raise ForbiddenError("Only staff or company admins/managers can edit files")

    client = get_client()
    now = datetime.now(timezone.utc).isoformat()

    key = client.key("Files", file_id)
    entity = client.get(key)
    if not entity:
        raise NotFoundError(f"File {file_id} not found")
    if entity.get("shipment_order_id") != shipment_id:
        raise NotFoundError(f"File {file_id} not found on shipment {shipment_id}")

    if body.file_tags is not None:
        entity["file_tags"] = body.file_tags

    # AFC Admin/Manager cannot change visibility
    if body.visibility is not None:
        if claims.is_afc():
            raise ForbiddenError("Only AF staff can change file visibility")
        entity["visibility"] = body.visibility

    entity["updated"] = now
    client.put(entity)

    return {"status": "OK", "data": _file_entity_to_dict(entity), "msg": "File updated"}


# ---------------------------------------------------------------------------
# 1e. DELETE /shipments/{shipment_id}/files/{file_id}
# ---------------------------------------------------------------------------

@router.delete("/{shipment_id}/files/{file_id}")
async def delete_shipment_file(
    shipment_id: str,
    file_id: int,
    claims: Claims = Depends(require_afu),
):
    """Soft-delete a file. AFU only."""
    client = get_client()
    now = datetime.now(timezone.utc).isoformat()

    key = client.key("Files", file_id)
    entity = client.get(key)
    if not entity:
        raise NotFoundError(f"File {file_id} not found")
    if entity.get("shipment_order_id") != shipment_id:
        raise NotFoundError(f"File {file_id} not found on shipment {shipment_id}")

    entity["trash"] = True
    entity["updated"] = now
    client.put(entity)

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
):
    """Generate a signed GCS URL for file download."""
    client = get_client()

    key = client.key("Files", file_id)
    entity = client.get(key)
    if not entity:
        raise NotFoundError(f"File {file_id} not found")
    if entity.get("shipment_order_id") != shipment_id:
        raise NotFoundError(f"File {file_id} not found on shipment {shipment_id}")

    # AFC regular: only visible files
    if claims.is_afc() and claims.role not in (AFC_ADMIN, AFC_M):
        if not entity.get("visibility", True):
            raise NotFoundError(f"File {file_id} not found")

    file_location = entity.get("file_location", "")
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
):
    """
    Update a shipment from parsed BL data. AFU only.
    Accepts multipart/form-data with optional BL PDF file.
    """
    # Read file bytes immediately — stream cannot be re-read later
    file_bytes = await file.read() if file else None
    file_content_type = file.content_type if file else None
    file_original_name = file.filename if file else None

    client = get_client()
    now = datetime.now(timezone.utc).isoformat()

    # V1 detection
    is_v1 = shipment_id.startswith(PREFIX_V1_SHIPMENT)
    so_entity = None
    if is_v1:
        so_entity = client.get(client.key("ShipmentOrder", shipment_id))

    # Load Quotation entity
    q_key = client.key("Quotation", shipment_id)
    q_entity = client.get(q_key)
    if not q_entity:
        raise NotFoundError(f"Shipment {shipment_id} not found")
    if q_entity.get("trash"):
        raise HTTPException(status_code=410, detail=f"Shipment {shipment_id} has been deleted")

    # Merge booking fields (don't replace whole dict)
    booking = q_entity.get("booking") or {}
    if not isinstance(booking, dict):
        booking = {}
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
    q_entity["booking"] = booking

    # Also write flat fields so detail-page readers see updated values
    if vessel_name is not None:
        q_entity["vessel_name"] = vessel_name
    if voyage_number is not None:
        q_entity["voyage_number"] = voyage_number

    # ETD
    if etd is not None:
        q_entity["etd"] = etd

    # Merge parties — shipper + consignee (don't replace whole parties dict)
    # Only write to parties if currently empty — unless force_update is set
    is_force = force_update == "true"
    parties = q_entity.get("parties") or {}
    if not isinstance(parties, dict):
        parties = {}

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

    q_entity["parties"] = parties

    # Write raw parsed BL values to bl_document (always overwrite — audit record)
    bl_doc = q_entity.get("bl_document") or {}
    if not isinstance(bl_doc, dict):
        bl_doc = {}
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
    if bl_doc:
        q_entity["bl_document"] = bl_doc

    # Containers — replace array if provided and non-empty
    if containers is not None:
        try:
            containers_list = _json.loads(containers)
        except (ValueError, TypeError):
            containers_list = None
        if containers_list:
            td = q_entity.get("type_details") or {}
            if not isinstance(td, dict):
                td = {}
            td["containers"] = containers_list
            q_entity["type_details"] = td

    # Cargo items — replace array if provided and non-empty (LCL shipments)
    if cargo_items is not None:
        try:
            cargo_items_list = _json.loads(cargo_items)
        except (ValueError, TypeError):
            cargo_items_list = None
        if cargo_items_list:
            td = q_entity.get("type_details") or {}
            if not isinstance(td, dict):
                td = {}
            td["cargo_items"] = cargo_items_list
            q_entity["type_details"] = td

    q_entity["updated"] = now

    # Safe exclude_from_indexes — V1 entities may not support reassignment
    try:
        existing = set(q_entity.exclude_from_indexes or set())
        q_entity.exclude_from_indexes = existing | {"booking", "parties", "type_details", "bl_document"}
    except (TypeError, AttributeError):
        pass  # V1 entities may not support this — skip silently

    # Unblock export clearance if waybill set
    if waybill_number:
        _maybe_unblock_export_clearance(client, shipment_id, claims.uid)

    logger.info("[bl_update] Writing to Quotation %s, is_v1=%s", shipment_id, is_v1)
    try:
        client.put(q_entity)
    except Exception as e:
        logger.error("[bl_update] Failed to write Quotation %s: %s", shipment_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to save shipment: {str(e)}")

    # For V1, also write flat fields to ShipmentOrder so detail endpoint returns them
    if is_v1 and so_entity:
        so_changed = False
        if waybill_number:
            so_entity["booking_reference"] = waybill_number
            so_changed = True
        if vessel_name is not None:
            so_entity["vessel_name"] = vessel_name
            so_changed = True
        if voyage_number is not None:
            so_entity["voyage_number"] = voyage_number
            so_changed = True
        if so_changed:
            so_entity["updated"] = now
            # GUARD: never tag a V1 ShipmentOrder as data_version=2
            if so_entity.get("data_version") == 2:
                so_entity["data_version"] = None
            try:
                client.put(so_entity)
            except Exception as e:
                logger.error("[bl_update] Failed to write ShipmentOrder %s: %s", shipment_id, str(e))

    # Log to AFSystemLogs
    _log_system_action(client, "BL_UPDATED", shipment_id, claims.uid, claims.email)

    # Auto-save BL file if provided (file_bytes read at top of handler)
    if file_bytes:
        company_id = q_entity.get("company_id", "")
        original_name = file_original_name or f"BL_{shipment_id}.pdf"
        gcs_path = _resolve_gcs_path(company_id, shipment_id, original_name)

        from google.cloud import storage as gcs_storage
        gcs_client = gcs_storage.Client(project="cloud-accele-freight")
        bucket = gcs_client.bucket(FILES_BUCKET_NAME)
        content_type = file_content_type or "application/pdf"
        _save_file_to_gcs(bucket, gcs_path, file_bytes, content_type)

        _create_file_entity(
            client=client,
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
            "booking": dict(q_entity.get("booking") or {}),
            "parties": dict(q_entity.get("parties") or {}),
            "bl_document": dict(q_entity.get("bl_document") or {}),
            "etd": q_entity.get("etd"),
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
):
    """
    Update shipper/consignee on a shipment. AFU only.
    Merges into existing parties dict — preserves notify_party and other fields.
    Does NOT touch bl_document.
    """
    client = get_client()
    now = datetime.now(timezone.utc).isoformat()

    q_key = client.key("Quotation", shipment_id)
    q_entity = client.get(q_key)
    if not q_entity:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    parties = q_entity.get("parties") or {}
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

    q_entity["parties"] = parties
    q_entity["updated"] = now

    try:
        existing = set(q_entity.exclude_from_indexes or set())
        q_entity.exclude_from_indexes = existing | {"parties"}
    except (TypeError, AttributeError):
        pass

    client.put(q_entity)

    # V1: also write to ShipmentOrder if it exists
    is_v1 = shipment_id.startswith(PREFIX_V1_SHIPMENT)
    if is_v1:
        so_entity = client.get(client.key("ShipmentOrder", shipment_id))
        if so_entity:
            so_entity["parties"] = parties
            so_entity["updated"] = now
            # GUARD: never tag a V1 ShipmentOrder as data_version=2
            if so_entity.get("data_version") == 2:
                so_entity["data_version"] = None
            try:
                client.put(so_entity)
            except Exception as e:
                logger.error("[update_parties] Failed to write ShipmentOrder %s: %s", shipment_id, str(e))

    _log_system_action(client, "PARTIES_UPDATED", shipment_id, claims.uid, claims.email)

    return {
        "status": "OK",
        "data": {"parties": parties},
    }


def _maybe_unblock_export_clearance(client, shipment_id: str, user_id: str):
    """Unblock EXPORT_CLEARANCE if FREIGHT_BOOKING is completed and waybill is set."""
    wf_key = client.key("ShipmentWorkFlow", shipment_id)
    wf_entity = client.get(wf_key)
    if not wf_entity:
        return

    tasks = wf_entity.get("workflow_tasks") or []
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
        wf_entity["workflow_tasks"] = tasks
        wf_entity["updated"] = now
        wf_entity.exclude_from_indexes = set(wf_entity.exclude_from_indexes or set()) | {"workflow_tasks"}
        client.put(wf_entity)
        logger.info("EXPORT_CLEARANCE unblocked for %s", shipment_id)


def _get_port_label(client, un_code: str | None, terminal_id: str | None = None) -> str | None:
    """
    Look up a port's human-readable label from the Port Kind.
    Returns "<name>, <country>" if found, or None if not found / un_code is None.
    If terminal_id is provided, looks up the terminal name from the port's terminals array
    and returns "<name> (<terminal_name>), <country>".
    Port Kind uses un_code as the entity key.
    """
    if not un_code:
        return None
    try:
        entity = client.get(client.key("Port", un_code))
        if entity:
            name = entity.get("name")
            country = entity.get("country")
            # Check for terminal-specific label
            if terminal_id:
                terminals = entity.get("terminals", [])
                for t in terminals:
                    if t.get("terminal_id") == terminal_id:
                        terminal_name = t.get("name")
                        if terminal_name and name and country:
                            return f"{name} ({terminal_name}), {country}"
                        elif terminal_name and name:
                            return f"{name} ({terminal_name})"
                        break
            if name and country:
                return f"{name}, {country}"
            elif name:
                return name
    except Exception:
        pass
    return None


def _log_system_action(client, action: str, entity_id: str, uid: str, email: str):
    """Write a log entry to AFSystemLogs Kind."""
    now = datetime.now(timezone.utc).isoformat()
    log_key = client.key("AFSystemLogs")
    log_entity = client.entity(log_key)
    log_entity.update({
        "action": action,
        "entity_id": entity_id,
        "uid": uid,
        "email": email,
        "timestamp": now,
    })
    client.put(log_entity)


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
    dest_code = shipment_data.get("destination_port_un_code") or shipment_data.get("destination_port") or ""

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


def _enrich_route_nodes(client, nodes: list[dict]) -> list[dict]:
    """Enrich route nodes with port details from Port Kind if available."""
    if not nodes:
        return nodes

    port_codes = [n.get("port_un_code") for n in nodes if n.get("port_un_code")]
    if not port_codes:
        return nodes

    # Batch-fetch Port entities
    port_keys = [client.key("Port", code) for code in port_codes]
    port_entities = get_multi_chunked(client, port_keys)

    port_map = {}
    for entity in port_entities:
        if entity:
            code = entity.key.name or entity.key.id_or_name
            port_map[code] = entity

    for node in nodes:
        port = port_map.get(node.get("port_un_code", ""))
        if port:
            node["port_name"] = port.get("port_name") or port.get("name") or node.get("port_name", "")
            node["country"] = port.get("country") or port.get("country_code") or ""
            node["port_type"] = port.get("port_type") or ""

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
):
    """Get route nodes for a shipment. Derives from ports if not yet saved."""
    client = get_client()

    q_entity = client.get(client.key("Quotation", shipment_id))
    if not q_entity:
        q_entity = client.get(client.key("ShipmentOrder", shipment_id))
    if not q_entity:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    shipment_data = entity_to_dict(q_entity)

    # AFC users can only see their own company's shipments
    if claims.is_afc() and shipment_data.get("company_id") != claims.company_id:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    nodes = shipment_data.get("route_nodes") or []

    # Derive from origin/destination if no saved route nodes
    if not nodes:
        nodes = _derive_route_nodes(shipment_data)

    # Enrich with port details
    nodes = _enrich_route_nodes(client, nodes)

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
):
    """Replace route nodes array on a shipment. AFU + AFC Admin/Manager only."""
    client = get_client()

    # Permission check
    if claims.is_afc():
        if claims.role not in ("AFC-ADMIN", "AFC-M"):
            raise HTTPException(status_code=403, detail="Only admin/manager can update route nodes")

    # V1 shipments are read-only for route nodes
    if shipment_id.startswith(PREFIX_V1_SHIPMENT):
        raise HTTPException(status_code=400, detail="Cannot write route nodes to V1 shipments")

    q_entity = client.get(client.key("Quotation", shipment_id))
    if not q_entity:
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

    # Write to Quotation entity
    q_entity["route_nodes"] = node_dicts
    q_entity.exclude_from_indexes = set(q_entity.exclude_from_indexes or set()) | {"route_nodes"}

    # Sync flat ETD/ETA from ORIGIN and DESTINATION nodes
    for nd in node_dicts:
        if nd["role"] == "ORIGIN" and nd.get("scheduled_etd"):
            q_entity["etd"] = nd["scheduled_etd"]
        if nd["role"] == "DESTINATION" and nd.get("scheduled_eta"):
            q_entity["eta"] = nd["scheduled_eta"]

    q_entity["updated"] = datetime.now(timezone.utc).isoformat()
    client.put(q_entity)

    # Enrich for response
    node_dicts = _enrich_route_nodes(client, node_dicts)

    # Log
    _log_system_action(client, "ROUTE_NODES_UPDATED", shipment_id, claims.uid, claims.email)

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
):
    """Update timing on a single route node by sequence number."""
    client = get_client()

    # Permission check
    if claims.is_afc():
        if claims.role not in ("AFC-ADMIN", "AFC-M"):
            raise HTTPException(status_code=403, detail="Only admin/manager can update route nodes")

    if shipment_id.startswith(PREFIX_V1_SHIPMENT):
        raise HTTPException(status_code=400, detail="Cannot write route nodes to V1 shipments")

    q_entity = client.get(client.key("Quotation", shipment_id))
    if not q_entity:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    nodes = q_entity.get("route_nodes") or []
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

    # Sync flat fields if ORIGIN or DESTINATION
    if target.get("role") == "ORIGIN" and body.scheduled_etd is not None:
        q_entity["etd"] = body.scheduled_etd
    if target.get("role") == "DESTINATION" and body.scheduled_eta is not None:
        q_entity["eta"] = body.scheduled_eta

    q_entity["route_nodes"] = nodes
    q_entity.exclude_from_indexes = set(q_entity.exclude_from_indexes or set()) | {"route_nodes"}
    q_entity["updated"] = datetime.now(timezone.utc).isoformat()
    client.put(q_entity)

    return {
        "shipment_id": shipment_id,
        "node": target,
    }
