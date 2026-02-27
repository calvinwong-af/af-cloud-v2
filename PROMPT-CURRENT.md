# PROMPT — Fix Stats and List Endpoints for Migrated Records
**Date:** 28 February 2026
**Target:** VS Code / Claude Opus
**File to update:** `af-server/routers/shipments.py`

---

## Context

The V1 → V2 data migration has just completed. 2,034 records were written to a
new Datastore Kind called `ShipmentOrder` with `data_version: 2` and
`migrated_from_v1: true`. These are keyed by `AFCQ-XXXXXX`.

The existing server currently queries two sources:
- `Quotation` Kind where `data_version=2` → new V2 records created by the platform
- `ShipmentOrder` Kind (old) where `status >= 110` → V1 operational records

There is now a **third source** that neither endpoint handles:
- `ShipmentOrder` Kind (new) where `data_version=2` → migrated records

This is causing two visible bugs in the platform:
1. Active count shows 2,034 (should be 22) — all migrated records counted as active
2. Completed count shows 0 (should be 2,012) — migrated completed records not found
3. Route column shows `— → —` on the list — origin/destination not resolving

---

## Understanding the Three Sources

### Source 1 — New V2 records (created by platform after migration)
- Kind: `Quotation`
- Filter: `data_version == 2`
- Key prefix: `AF-XXXXXX`
- Status: direct V2 status codes (1001, 2001, 3001 etc.)
- Origin/dest: nested dict `origin.port_un_code` / `destination.port_un_code`

### Source 2 — V1 legacy records (still on old Quotation Kind — the 22 active orders)
- Kind: `ShipmentOrder` (old Kind)
- Filter: `status >= 110`
- Key prefix: `AFCQ-XXXXXX`
- Status: V1 codes (110, 4110, 10000) — map via `V1_TO_V2_STATUS`
- Origin/dest: flat fields `origin_port_un_code` / `destination_port_un_code`

### Source 3 — Migrated records (written by migration script)
- Kind: `ShipmentOrder` (same Kind name as Source 2, but these are the NEW records)
- Filter: `data_version == 2`
- Key prefix: `AFCQ-XXXXXX`
- Status: direct V2 status codes (2001, 3001, 3002, 5001)
- Origin/dest: nested dict `origin.port_un_code` / `destination.port_un_code`
- Additional field: `migrated_from_v1: True`

**The key distinction between Source 2 and Source 3:**
Both live in the `ShipmentOrder` Kind. Source 2 records have NO `data_version`
field (or `data_version == 1`). Source 3 records have `data_version == 2`.

---

## Fix Required

### 1. Stats endpoint — `GET /api/v2/shipments/stats`

Add a third query block after the existing V1 block:

```python
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

for entity in migrated_query.fetch():
    s = entity.get("status", 0)
    if s in V2_ACTIVE_STATUSES:
        stats["active"] += 1
    elif s == STATUS_COMPLETED:
        stats["completed"] += 1
        if not bool(entity.get("issued_invoice", False)):
            stats["to_invoice"] += 1
    elif s == STATUS_CANCELLED:
        stats["cancelled"] += 1
    elif s in (STATUS_DRAFT, STATUS_DRAFT_REVIEW):
        stats["draft"] += 1
```

**Also update the existing V1 query block** to explicitly exclude migrated records:
Add `data_version != 2` filter — or more reliably, filter out records where
`data_version == 2` in the loop:

```python
for entity in v1_query.fetch():
    # Skip migrated records — they are counted in the migrated block above
    if entity.get("data_version") == 2:
        continue
    # ... existing V1 logic unchanged
```

---

### 2. List endpoint — `GET /api/v2/shipments`

**A. Add migrated records query block** (after the existing V1 block, before
company name batch-fetch):

```python
# -------------------------------------------------------------------
# Migrated records — ShipmentOrder Kind, data_version=2
# Status is V2 codes. Origin/dest use nested dict structure.
# -------------------------------------------------------------------
if not cursor:  # Only on first page — migrated records included with V2
    migrated_query = client.query(kind="ShipmentOrder")
    migrated_query.add_filter(filter=PropertyFilter("data_version", "=", 2))
    migrated_query.add_filter(filter=PropertyFilter("trash", "=", False))
    if effective_company_id:
        migrated_query.add_filter(
            filter=PropertyFilter("company_id", "=", effective_company_id)
        )
    for entity in migrated_query.fetch():
        if _migrated_tab_match(tab, entity):
            items.append(_make_migrated_summary(entity))
```

**B. Add `_migrated_tab_match` helper** — same logic as `_v2_tab_match`, reuse it:

```python
def _migrated_tab_match(tab: str, entity) -> bool:
    """Tab matching for migrated ShipmentOrder records — identical to V2."""
    return _v2_tab_match(tab, entity)
```

**C. Add `_make_migrated_summary` helper** — reads origin/dest from nested dict:

```python
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
```

**D. Update existing V1 query loop** to skip migrated records (same as stats fix):

```python
for so_entity in v1_shipment_orders:
    # Skip migrated records — already included in migrated block above
    if so_entity.get("data_version") == 2:
        continue
    # ... existing V1 loop logic unchanged
```

**E. Pagination note:** Migrated records (2,034 of them) are loaded on page 1
only (no cursor). This matches how V2 Quotation records are handled. For
subsequent pages, only V1 legacy records paginate via cursor. This is acceptable
for now — the 22 V1 legacy records are few. If migrated record volume causes
page 1 to be too large, a cursor-based solution can be added later.

---

### 3. Also update `get_shipment` single record endpoint

The `get_shipment` endpoint currently reads migrated records from `Quotation` Kind
(V2 path) but migrated records are in `ShipmentOrder` Kind. Update the `AFCQ-`
prefix branch to check `data_version`:

```python
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
```

---

## Expected Results After Fix

| Metric | Before Fix | After Fix |
|---|---|---|
| Active count | 2,034 | 22 |
| Completed count | 0 | 2,012 |
| Total count | 2,035 | 2,035 |
| Route on list | `— → —` for migrated | Port codes visible |
| Draft count | 1 | 1 (the V2 test draft) |

---

## Coding Standards Reminders

- All Datastore filters use `PropertyFilter` keyword form
- Use `get_multi_chunked` for any batch fetches
- Use `parse_timestamp` for all date parsing
- Follow existing patterns in the file exactly
- Do not modify any endpoint logic outside the sections described above

---

## Verification

After making the changes, confirm:
1. Stats endpoint returns active=22, completed=2012
2. List page Active tab shows 22 records with port codes visible
3. List page Completed tab shows 2,012 records
4. Clicking a migrated AFCQ- record detail page still works
5. No regression on the existing V2 draft record (AF-003865)

---

## Additional Fix — To Invoice Count

**Problem:** To Invoice tab shows 2,012 (all completed) instead of only uninvoiced completed records.

**Root cause:** The `issued_invoice` field on migrated records may be `False`, `0`,
`None`, missing, or an empty list `[]` depending on the V1 source data. The
current `bool(entity.get("issued_invoice", False))` check does not reliably
handle all these cases for migrated records.

**Fix:** In the migrated records block (both stats and list endpoints), replace
the `to_invoice` check with a bare truthiness check — do not pass a default
value, just check if the field is truthy:

```python
# Wrong — default False masks missing/None/[] cases
if not bool(entity.get("issued_invoice", False)):
    stats["to_invoice"] += 1

# Correct — handles bool False, int 0, None, missing, and empty list []
issued = entity.get("issued_invoice")
if not issued:
    stats["to_invoice"] += 1
```

Apply this same pattern in:
1. The migrated records block in `get_shipment_stats`
2. The migrated records block in `list_shipments` (to_invoice tab filter)

The existing V1 and V2 blocks already use this pattern correctly — do not
change those, only align the migrated block to match.

**Expected result after fix:** To Invoice count reflects only completed records
where `issued_invoice` is falsy — not all 2,012 completed records.
