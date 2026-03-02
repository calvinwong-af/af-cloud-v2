# Handover Notes — v2.25
**Date:** 01 March 2026
**Session type:** Bug Fix + Handover

---

## Session Summary

Parties update clear/null semantics bug fixed. Edit Parties modal now correctly clears fields when the user deletes all text — previously cleared fields were silently ignored and old values persisted.

---

## Fix Applied This Session

### Parties Update — Clear/Null Semantics Bug
**Root cause:** Two-layer mismatch between frontend and server.

1. **Frontend** (`EditPartiesModal`): converted `""` to `null` via `|| null` coercion before submitting. `null` in the JSON body was received by Python as `None`.
2. **Server** (`update_parties`): skipped any field where `body.field is None`, treating "absent" and "null" identically — no way to explicitly clear a field.

**Fix:**
- Frontend: removed `|| null` coercion — sends `""` for cleared fields instead of `null`
- Server: after merging, if both `name` and `address` on a party sub-object are empty/falsy, the sub-object is removed from `parties` entirely (`parties.pop(...)`)
- Same cleanup logic applied to shipper, consignee, and notify_party blocks

**Standard established:** For PATCH endpoints managing structured sub-objects, `""` = clear field, non-empty string = set field. Field absent from the outer object = don't touch. This avoids the null/absent ambiguity.

**Files modified:**
- `af-platform/src/app/(platform)/shipments/[id]/page.tsx` — EditPartiesModal sends `""` instead of `null`
- `af-server/routers/shipments.py` — `update_parties` cleanup for empty party sub-objects

---

## Open Issue — Order List Filter (V1 tab pagination)

**Status:** Identified, not yet fixed. Needs a VS Code prompt.

### The Problem

The `list_shipments` endpoint fetches a raw Datastore page of `limit=25` records from ShipmentOrder, then applies the tab filter **in-memory** afterwards. This means:

- A page of 25 V1 ShipmentOrder records may yield fewer than 25 results after filtering (e.g. only 8 active records in that page)
- The UI shows 8 results and offers "Load More" — but clicking it advances the cursor past those 25 records, skipping the next 25, then filtering again
- Result: fewer results shown than actually exist, and "Load More" doesn't reliably surface them

This was a necessary trade-off when the mixed V1/V2 status code contamination was fixed (v2.29 — broadened query from tight status filters to `status >= 100`, filtering in-memory). The old tight Datastore filters were broken; the broad in-memory approach is correct but needs over-fetch compensation.

### The Fix

**Strategy: over-fetch with in-memory fill-to-limit**

Instead of fetching exactly `limit` records and filtering in-memory (which under-delivers), fetch in batches until `limit` filtered results are accumulated or Datastore is exhausted:

```python
# Pseudocode
results = []
batch_limit = limit * 3  # fetch more than needed to compensate for filter dropout
current_cursor = start_cursor

while len(results) < limit:
    page = fetch(batch_limit, cursor=current_cursor)
    for entity in page:
        if passes_tab_filter(entity):
            results.append(entity)
    if page.next_cursor is None or len(page) < batch_limit:
        break  # exhausted
    current_cursor = page.next_cursor
    if len(results) >= limit:
        break

return results[:limit], current_cursor_after_last_consumed_record
```

The cursor returned to the client should be the cursor **after the last batch page that was consumed**, not after the last filtered result. This ensures "Load More" picks up from the right place.

**Scope:** Only affects V1 records on `active`, `completed`, and `all` tabs. `to_invoice` already fetches all records (no cursor). `draft` and `cancelled` skip V1 entirely.

**Note for Opus:** The fix is purely in `af-server/routers/shipments.py` in `list_shipments`. The frontend does not need changes — it already handles cursors and "load more" correctly.

---

## Test Status

See `AF-Test-List.md` for full test matrix. New items added this session:

| # | Test | Status |
|---|---|---|
| EP-01 | Edit Parties — clear notify party → save → party removed immediately | ✅ PASSED |
| EP-02 | Edit Parties — clear notify party → save → refresh → party still gone | ✅ PASSED |
| EP-03 | Edit Parties — set notify party name → save → appears immediately | ✅ PASSED |
| EP-04 | Edit Parties — clear shipper name, keep address → address preserved | ✅ PASSED |
| EP-05 | Edit Parties — clear both shipper name and address → shipper removed | ✅ PASSED |
| OF-01 | Active tab — shows all active shipments (no under-delivery due to filter) | PENDING |
| OF-02 | Load More on Active tab — advances correctly, no skipped records | PENDING |
| OF-03 | Completed tab — shows all completed shipments | PENDING |

---

## Next Session — Recommended Starting Point

1. Test Edit Parties fix (EP-01 through EP-05) to confirm parties clear/save correctly
2. Prepare VS Code prompt for the Order List Filter fix (OF series) — over-fetch strategy in `list_shipments`
3. Continue with PT series (MYPKG_N migration scripts) when ready to run against Datastore
