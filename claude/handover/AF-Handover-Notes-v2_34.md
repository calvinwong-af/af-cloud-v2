# Handover Notes — v2.34
**Date:** 02 March 2026
**Session type:** PostgreSQL 500 Error Debugging + Sort Fix

---

## Session Summary

Short focused session. Three 500 errors on shipment detail pages were diagnosed and fixed. All fixes are locally verified and ready to deploy to production. Shipment list sort order also corrected.

---

## Problems Fixed This Session

### 1. `_lazy_init_tasks_pg` — SQLAlchemy `::jsonb` Cast Syntax Error
**Symptom:** All migrated V1 shipment detail pages returned 500. Native V2 (AF-003866) worked fine.

**Root cause:** SQLAlchemy's `text()` binding uses `:param` syntax. The query used `:tasks::jsonb` which SQLAlchemy misinterprets — it sees `:tasks:` as a malformed bind parameter before the `jsonb` keyword.

**Error:**
```
psycopg2.errors.SyntaxError: syntax error at or near ":"
LINE 3: SET workflow_tasks = :tasks::jsonb, updated_at = ...
```

**Fix:** `af-server/routers/shipments.py` — replaced `::jsonb` cast with `cast(:tasks as jsonb)`:
```python
# Before
SET workflow_tasks = :tasks::jsonb, updated_at = :now

# After  
SET workflow_tasks = cast(:tasks as jsonb), updated_at = :now
```

This only fires on first access of a migrated shipment (lazy task generation). Once tasks are written, subsequent loads skip this block entirely.

---

### 2. Frontend Crash — Missing Array Fields in API Response
**Symptom:** AF-003866 (native V2) loaded fine. Detail page crashed on `TypeError: Cannot read properties of undefined (reading 'length')` for migrated records.

**Root cause:** PostgreSQL API response omits fields like `customs_clearance`, `files`, `related_orders` etc. that the V1 assembly layer always provided. Frontend component at line 1499 did `.length` on `undefined`.

**Fix:** `af-platform/src/app/actions/shipments.ts` — added normalization layer in `fetchShipmentOrderDetailAction`:
```typescript
const normalized: ShipmentOrder = {
  ...data,
  customs_clearance: data.customs_clearance ?? [],
  files: data.files ?? [],
  related_orders: data.related_orders ?? [],
  commercial_quotation_ids: data.commercial_quotation_ids ?? [],
  status_history: data.status_history ?? [],
  _company_name: data.company_name ?? data._company_name,
};
```

---

### 3. Shipment List Sort Order
**Symptom:** All migrated records share the same `updated_at` (migration timestamp — 28 Feb 2026), causing PostgreSQL to return them in arbitrary order. Native V2 records had older timestamps and appeared below the migrated ones.

**Fix:** `af-server/core/db_queries.py` — changed `list_shipments()` to sort by `countid DESC` as primary sort:
```python
# Before
ORDER BY s.updated_at DESC

# After
ORDER BY s.countid DESC
```

`countid` is the sequence integer assigned at creation — stable, unique, always reflects shipment age correctly regardless of when `updated_at` was last touched.

**Note:** This means recently updated shipments do not "bubble up". Calvin noted this is acceptable for now — operational prioritization approach to be designed later.

---

## Files Modified This Session

| File | Change |
|---|---|
| `af-server/routers/shipments.py` | `cast(:tasks as jsonb)` — fix lazy init syntax error |
| `af-platform/src/app/actions/shipments.ts` | Normalize missing array fields in detail action |
| `af-server/core/db_queries.py` | Sort `list_shipments` by `countid DESC` |

---

## Verified Locally

| Shipment | Result |
|---|---|
| AF-003866 (native V2) | ✅ Loads correctly — Route, Status, Tasks visible |
| AF-003830 (migrated V1) | ✅ Loads correctly after fix |
| AF-003844 (migrated V1) | ✅ Loads correctly after fix |
| Shipments list — Active tab | ✅ Sorted by countid DESC (AF-003867 first) |

---

## Dashboard Stats (Last Confirmed — 02 Mar 2026)
| Stat | Value |
|---|---|
| Total | 2,044 |
| Active | 23 |
| Completed | 2,019 |
| To Invoice | 8 |
| Draft | 1 |
| Cancelled | 0 |

---

## Pending — Deploy to Production

All three fixes are locally verified. Next step is to push and deploy:

```
git add af-server/routers/shipments.py
git add af-platform/src/app/actions/shipments.ts
git add af-server/core/db_queries.py
git commit -m "fix: PG 500 errors on shipment detail + list sort order"
```

Then deploy af-server and af-platform to Cloud Run.

---

## Next Session — Recommended Starting Point

1. Deploy the three fixes to production and verify on appv2.accelefreight.com
2. Calvin to update shipment data (route, status, dates) on active shipments as needed
3. Confirm PG-06/07/08/09/10/11 tests from the PG series
4. Continue with next feature or operational priority as directed
