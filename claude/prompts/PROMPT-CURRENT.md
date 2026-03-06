# Prompt v5.06 — Status Consistency Sweep (Backend + Frontend)

## Background

The unified orders architecture (v5.00 migration) changed `orders.status` from numeric integer codes to string values (`'draft'`, `'confirmed'`, `'in_progress'`, `'completed'`, `'cancelled'`) with a separate `orders.sub_status` column for granular state (`'booking_pending'`, `'booking_confirmed'`, `'in_transit'`, `'arrived'`, `'confirmed'`).

The backend write paths were fixed in v5.04 to correctly write string status. However, multiple read paths on both backend and frontend still assume numeric status codes. This prompt is a full sweep fix across every affected surface.

---

## Inconsistencies to Fix

### Backend

#### 1. `af-server/routers/shipments/core.py` — Search endpoint: `status_label` lookup broken

In `search_shipments` (the ID-only search path), status_label is set as:
```python
s["status_label"] = STATUS_LABELS.get(s.get("status", 0), str(s.get("status", 0)))
```
`STATUS_LABELS` is keyed by **integer** (e.g. `{1001: "Draft"}`). But `s["status"]` is now a **string** (`"draft"`, `"in_progress"` etc.). This lookup always returns the raw string as fallback, so the search API returns `status_label = "in_progress"` instead of `"In Progress"`.

**Fix:** Replace with `get_status_display(status, sub_status)` from `constants.py`:
```python
from core.constants import get_status_display
# ...
s["status_label"] = get_status_display(s.get("status", ""), s.get("sub_status"))
```
Apply this fix to **all three places** in `core.py` where `status_label` is assigned:
- In the ID-only search path (inside the `else` block of `search_fields == "all"`)
- In the loop after `items` is built: `if "status_label" not in s: s["status_label"] = ...`
- In `db_queries.search_shipments()` in `db_queries.py` (same issue there)

#### 2. `af-server/core/db_queries.py` — `search_shipments`: `status_label` broken

Same issue as above:
```python
"status_label": STATUS_LABELS.get(r[3], r[3] or ""),
```
`r[3]` is the string status column. Fix with `get_status_display`:
```python
from core.constants import get_status_display
# ...
"status_label": get_status_display(r[3] or "", r[4]),   # r[4] is sub_status
```
Note: `search_shipments` in `db_queries.py` must also select `sub_status` — check the SELECT and add `o.sub_status` if missing.

#### 3. `af-server/routers/shipments/core.py` — `get_shipment_by_id` (via `db_queries.py`): `status` returned as raw string to frontend

The detail endpoint returns `data["status"]` as the raw DB string (`"in_progress"`), but the frontend `ShipmentOrder` type declares `status: ShipmentOrderStatus` (numeric union). The frontend `StatusCard` attempts `pathList.indexOf(currentStatus)` on a string value, always getting `-1`.

**Fix:** In `db_queries.get_shipment_by_id()`, after building the `data` dict, add a **numeric status translation** for API compat:
```python
from core.constants import STRING_STATUS_TO_NUMERIC, SUB_STATUS_TO_NUMERIC

# Convert string status → numeric for frontend compat
raw_status = data.get("status", "draft")
raw_sub = data.get("sub_status")
if isinstance(raw_status, str) and not raw_status.lstrip('-').isdigit():
    # Precise mapping via sub_status when in_progress
    if raw_sub and raw_sub in SUB_STATUS_TO_NUMERIC:
        data["status"] = SUB_STATUS_TO_NUMERIC[raw_sub]
    else:
        data["status"] = STRING_STATUS_TO_NUMERIC.get(raw_status, 1001)
# Always include sub_status for frontend reference
data["sub_status"] = raw_sub
```

This is the correct fix: the **DB stores strings** (correct), the **API returns numerics** (required by the frontend type contract). The translation happens only at the API serialization boundary. Do NOT change the DB schema or the write paths.

#### 4. `af-server/core/db_queries.py` — `list_shipments`: `status` returned as raw string to frontend

Same issue as #3 but for the list endpoint. The `list_shipments` function builds items with:
```python
"status": r[3],   # raw string from DB
```

Apply the same numeric conversion:
```python
from core.constants import STRING_STATUS_TO_NUMERIC, SUB_STATUS_TO_NUMERIC

raw_status = r[3] or "draft"
raw_sub = r[4]   # sub_status column
if raw_sub and raw_sub in SUB_STATUS_TO_NUMERIC:
    numeric_status = SUB_STATUS_TO_NUMERIC[raw_sub]
elif raw_status and not raw_status.lstrip('-').isdigit():
    numeric_status = STRING_STATUS_TO_NUMERIC.get(raw_status, 1001)
else:
    numeric_status = int(raw_status) if raw_status else 1001

items.append({
    ...
    "status": numeric_status,   # numeric for frontend
    "sub_status": raw_sub,      # retain for reference
    ...
})
```

---

### Frontend

#### 5. `af-platform/src/app/(platform)/shipments/[id]/_components.tsx` — `StatusCard`: stepper broken on string status

`StatusCard` reads `order.status` and does `pathList.indexOf(currentStatus)`. If status is a string (from the raw API before fix #3), this returns `-1` and the stepper shows nothing.

**Fix:** Add a `normalizeToNumeric` helper at the top of `StatusCard` that converts string+sub_status → numeric for all internal stepper/path logic. Even after fix #3 lands on the backend, this acts as a defensive guard:

```ts
function normalizeToNumeric(status: unknown, subStatus?: string | null): number {
  if (typeof status === 'number') return status;
  const s = String(status ?? '').toLowerCase().trim();
  const ss = (subStatus ?? '').toLowerCase().trim();
  if (s === 'draft') return 1001;
  if (s === 'confirmed') return 2001;
  if (s === 'in_progress') {
    if (ss === 'booking_pending') return 3001;
    if (ss === 'booking_confirmed') return 3002;
    if (ss === 'in_transit') return 4001;
    if (ss === 'arrived') return 4002;
    return 3001;
  }
  if (s === 'completed') return 5001;
  if (s === 'cancelled') return -1;
  const n = parseInt(s, 10);
  return isNaN(n) ? 1001 : n;
}
```

Then at the top of the `StatusCard` component body replace:
```ts
const currentStatus = order.status;
```
with:
```ts
const rawSubStatus = (order as Record<string, unknown>).sub_status as string | null | undefined;
const currentStatus = normalizeToNumeric(order.status, rawSubStatus) as ShipmentOrderStatus;
```

Also fix `PartiesCard` — it checks:
```ts
const canEditParties = accountType === 'AFU' && order.status !== 5001 && order.status !== -1;
```
Replace with a local numeric normalization:
```ts
const numericStatus = normalizeToNumeric(order.status, (order as Record<string, unknown>).sub_status as string | null);
const canEditParties = accountType === 'AFU' && numericStatus !== 5001 && numericStatus !== -1;
```

#### 6. `af-platform/src/components/shipments/ShipmentOrderTable.tsx` — `StatusIcon`: keyed by numeric, breaks on string status

`StatusIcon` uses `iconMap[order.status]` where `iconMap` is keyed by numeric codes. If `order.status` is a string, `iconMap["in_progress"]` returns `undefined` and falls back to the Draft icon for everything.

The list API fix (#4) will return numerics, but add the same `normalizeToNumeric` helper defensively inside `StatusIcon`:

```ts
function normalizeStatusToNumeric(status: unknown, subStatus?: string | null): number {
  if (typeof status === 'number') return status;
  const s = String(status ?? '').toLowerCase().trim();
  const ss = (subStatus ?? '').toLowerCase().trim();
  if (s === 'draft') return 1001;
  if (s === 'confirmed') return 2001;
  if (s === 'in_progress') {
    if (ss === 'booking_pending') return 3001;
    if (ss === 'booking_confirmed') return 3002;
    if (ss === 'in_transit') return 4001;
    if (ss === 'arrived') return 4002;
    return 3001;
  }
  if (s === 'completed') return 5001;
  if (s === 'cancelled') return -1;
  const n = parseInt(s, 10);
  return isNaN(n) ? 1001 : n;
}
```

Then in `StatusIcon`:
```ts
function StatusIcon({ order }: { order: ShipmentOrder }) {
  const numericStatus = normalizeStatusToNumeric(
    order.status,
    (order as Record<string, unknown>).sub_status as string | null
  );
  const label = SHIPMENT_STATUS_LABELS[numericStatus] ?? `${order.status}`;
  const entry = iconMap[numericStatus] ?? iconMap[1001];
  // ... rest unchanged but use numericStatus instead of order.status
}
```

Also update the invoice icon check: `order.status === 5001` → `numericStatus === 5001`.

#### 7. `af-platform/src/app/(platform)/orders/shipments/page.tsx` — Search summary badges: broken numeric comparisons

The search summary block contains:
```ts
const ACTIVE_STATUSES = new Set([3001, 3002, 4001, 4002]);
const NATIVE_ACTIVE = (r: ShipmentOrder) => r.status === 2001 && !r.migrated_from_v1;
const activeCount = searchResults.filter(r => ACTIVE_STATUSES.has(r.status as number) || NATIVE_ACTIVE(r)).length;
const completedCount = searchResults.filter(r => r.status === 5001 || (r.status === 2001 && r.migrated_from_v1)).length;
```
These comparisons work once fix #4 lands (list returns numerics). Add defensive normalization using the same helper to be safe. Replace the filter callbacks:
```ts
const activeCount = searchResults.filter(r => {
  const ns = normalizeStatusToNumeric(r.status, (r as Record<string, unknown>).sub_status as string | null);
  return ACTIVE_STATUSES.has(ns) || (ns === 2001 && !r.migrated_from_v1);
}).length;
const completedCount = searchResults.filter(r => {
  const ns = normalizeStatusToNumeric(r.status, (r as Record<string, unknown>).sub_status as string | null);
  return ns === 5001 || (ns === 2001 && !!r.migrated_from_v1);
}).length;
```

#### 8. `af-platform/src/app/(platform)/shipments/[id]/_components.tsx` — Sub-step dialog: remove numeric code display

In the sub-step radio list dialog, each option renders:
```tsx
<span className="text-xs text-[var(--text-muted)]">({s.status})</span>
```
**Remove this span entirely.** Show only the label.

---

## Shared Helper Strategy

`normalizeToNumeric` / `normalizeStatusToNumeric` is the **same function** needed in 3 frontend locations. To avoid duplication, add it once to `af-platform/src/lib/types.ts` as an exported utility:

```ts
/**
 * Normalize a status value (may be numeric, numeric string, or string label)
 * to the canonical numeric status code used throughout the UI.
 * The sub_status column is used for precise mapping when status is 'in_progress'.
 */
export function normalizeStatusToNumeric(status: unknown, subStatus?: string | null): number {
  if (typeof status === 'number') return status;
  const s = String(status ?? '').toLowerCase().trim();
  const ss = (subStatus ?? '').toLowerCase().trim();
  if (s === 'draft') return 1001;
  if (s === 'confirmed') return 2001;
  if (s === 'in_progress') {
    if (ss === 'booking_pending') return 3001;
    if (ss === 'booking_confirmed') return 3002;
    if (ss === 'in_transit') return 4001;
    if (ss === 'arrived') return 4002;
    return 3001;
  }
  if (s === 'completed') return 5001;
  if (s === 'cancelled') return -1;
  const n = parseInt(s, 10);
  return isNaN(n) ? 1001 : n;
}
```

Then import it in all 3 frontend files instead of duplicating.

---

## Summary of Files to Modify

| # | File | Change |
|---|------|--------|
| 1 | `af-server/routers/shipments/core.py` | Fix `status_label` lookups in search to use `get_status_display()` |
| 2 | `af-server/core/db_queries.py` | Fix `status_label` in `search_shipments`; add `sub_status` to SELECT; convert `status` to numeric in `list_shipments` and `get_shipment_by_id` at API boundary |
| 3 | `af-platform/src/lib/types.ts` | Add exported `normalizeStatusToNumeric()` utility |
| 4 | `af-platform/src/app/(platform)/shipments/[id]/_components.tsx` | Use `normalizeStatusToNumeric` in `StatusCard` and `PartiesCard`; remove numeric code from sub-step dialog |
| 5 | `af-platform/src/components/shipments/ShipmentOrderTable.tsx` | Use `normalizeStatusToNumeric` in `StatusIcon` |
| 6 | `af-platform/src/app/(platform)/orders/shipments/page.tsx` | Use `normalizeStatusToNumeric` in search summary badge filters |

---

## Do NOT Change

- `orders.status` / `orders.sub_status` DB columns — string values are correct and stay
- `af-server/routers/shipments/status.py` — write path is already correct (v5.04)
- `af-server/routers/shipments/core.py` — create path is already correct (v5.05)
- `NUMERIC_TO_STRING_STATUS` and related constants — already correct
- The `ShipmentOrderStatus` TypeScript type — stays as numeric union
- Any test files

---

## Verification Checklist

After completing all changes:

1. **AF-003861 detail page** — stepper correctly shows position based on `in_progress` + `arrived` sub_status; status badge shows "Arrived" not "in_progress"; advance button works
2. **Draft tab on shipments list** — newly created drafts appear; count badge is correct  
3. **Search results** — `status_label` shows "Booking Confirmed" not "booking_confirmed"
4. **Status icon in list** — shows correct icon per status (e.g. arrived = Anchor, not draft FileText)
5. **Sub-step dialog** — radio options show only labels, no `(4001)` numeric codes
6. **Parties card edit button** — visible for non-completed/non-cancelled shipments
7. **`lib/types.ts`** — `normalizeStatusToNumeric` is exported and importable
