"""
routers/shipments.py

Shipment endpoints — V2 primary + V1 read-only.

Priority S1:  GET /api/v2/shipments/stats
              Accurate counts by querying ShipmentOrder Kind directly
              and joining with Quotation. Fixes the ~1,960 vs ~23 bug.

All other endpoints are stubs — add implementations as each is needed.
"""

import base64
import logging
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from core.auth import Claims, require_auth, require_afu, require_afu_admin
from logic.incoterm_tasks import (
    generate_tasks as generate_incoterm_tasks,
    PENDING, IN_PROGRESS, COMPLETED, BLOCKED,
    FREIGHT_BOOKING, EXPORT_CLEARANCE,
)
from core.constants import (
    AFU,
    AFU_ROLES,
    AFC_ADMIN,
    AFC_M,
    V1_ACTIVE_MIN,
    V1_ACTIVE_MAX,
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
from core.exceptions import NotFoundError

logger = logging.getLogger(__name__)

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

    for entity in v1_query.fetch():
        # Skip migrated records — they are counted in the migrated block below
        if entity.get("data_version") == 2:
            continue
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
            issued = q_invoice_map.get(mid)
            if not issued:
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
    # V1 records — ShipmentOrder Kind (status >= 110 = confirmed shipments)
    # -------------------------------------------------------------------
    v1_query = client.query(kind="ShipmentOrder")
    v1_query.add_filter(filter=PropertyFilter("status", ">=", V1_ACTIVE_MIN))
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

        # Apply tab-specific status filters at the Datastore level
        if tab == "active":
            v1_query.add_filter(filter=PropertyFilter("status", ">=", V1_ACTIVE_MIN))
            v1_query.add_filter(filter=PropertyFilter("status", "<", V1_STATUS_COMPLETED))
        elif tab in ("completed", "to_invoice"):
            v1_query.add_filter(filter=PropertyFilter("status", "=", V1_STATUS_COMPLETED))
        else:
            # tab == "all": all shipments that reached booking confirmation
            v1_query.add_filter(filter=PropertyFilter("status", ">=", V1_ACTIVE_MIN))

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

            v1_to_invoice_count = 0
            for so_entity in v1_shipment_orders:
                # Skip migrated records — already included in migrated block above
                if so_entity.get("data_version") == 2:
                    continue
                v1_status = so_entity.get("status", 0)

                # to_invoice: further filter — completed but invoice not issued.
                if tab == "to_invoice":
                    so_issued = so_entity.get("issued_invoice")
                    if bool(so_issued):
                        continue
                    v1_to_invoice_count += 1

                # Map V1 status → V2; unmapped codes default to Confirmed (2001)
                v2_status = V1_TO_V2_STATUS.get(v1_status, STATUS_CONFIRMED)
                items.append(_make_v1_summary(so_entity, None, v2_status))

            if tab == "to_invoice":
                logger.info("[to_invoice] After issued_invoice filter: %d records", v1_to_invoice_count)

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
                    data["quotation"] = entity_to_dict(q_entity)
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

{
  "waybill_number": "string or null",
  "booking_number": "string or null",
  "carrier": "string or null",
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
    origin_label: str | None = None
    destination_port_un_code: str | None = None
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
            "city_id": None,
            "address": None,
            "country_code": None,
            "label": body.origin_label or body.origin_port_un_code or "",
        } if body.origin_port_un_code else None,
        "destination": {
            "type": "PORT",
            "port_un_code": body.destination_port_un_code,
            "city_id": None,
            "address": None,
            "country_code": None,
            "label": body.destination_label or body.destination_port_un_code or "",
        } if body.destination_port_un_code else None,
        "origin_port_un_code": body.origin_port_un_code or "",
        "destination_port_un_code": body.destination_port_un_code or "",
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
    assigned_to: Optional[str] = None
    third_party_name: Optional[str] = None
    due_date: Optional[str] = None
    due_date_override: Optional[bool] = None
    notes: Optional[str] = None
    visibility: Optional[str] = None


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

    # --- Apply updates ---
    if body.status is not None:
        task["status"] = body.status
        if body.status == COMPLETED:
            task["completed_at"] = now

    if body.assigned_to is not None:
        task["assigned_to"] = body.assigned_to

    if body.third_party_name is not None:
        task["third_party_name"] = body.third_party_name

    if body.due_date is not None:
        task["due_date"] = body.due_date
        task["due_date_override"] = True
    elif body.due_date_override is not None:
        task["due_date_override"] = body.due_date_override

    if body.notes is not None:
        task["notes"] = body.notes

    if body.visibility is not None:
        task["visibility"] = body.visibility

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
