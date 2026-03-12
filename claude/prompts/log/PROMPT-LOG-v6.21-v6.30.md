## Prompt Log — v6.21 to v6.30

### [2026-03-13 04:00 UTC] — v6.30: Air Rate List — Full Restore + Edit Fix + UI Polish
- **Status:** Completed
- **Tasks:**
  1. Fixed `isListPriceMode` in `_air-rate-modal.tsx` — was checking `initial?.supplier_id === null` but list price rates have no `supplier_id` field (`undefined !== null`). Now uses `isListPrice` prop directly. This caused edits to show cost fields instead of list price fields, so saves had no effect.
  2. Restored airline sub-rows with per-airline expand/collapse and `AirExpandedPanel` for supplier costs. Added `expandedAirlineId`/`expandedAirlineDetail` state pair with detail fetch effect.
  3. Removed "Reference rate" label from list price row in `_air-expanded-panel.tsx`.
  4. Added visual nesting: left border (`border-l-2 border-l-[var(--sky)]/30`) on expanded section, subtle background tint on airline sub-rows.
  5. Added DG classification badges on O/D group header row (distinct non-NON-DG codes from group cards).
- **Files Modified:** `_air-rate-list.tsx`, `_air-rate-modal.tsx`, `_air-expanded-panel.tsx` (all in `af-platform/src/app/(platform)/pricing/air/`)
- **Notes:** Root cause of edit-not-saving was `undefined === null` evaluating false in `isListPriceMode`, causing modal to display wrong tier fields. Lint passes clean.

### [2026-03-13 01:30 UTC] — v6.29: Air Rate List — Fix O/D Row Click Handling
- **Status:** Completed
- **Tasks:**
  1. Removed `onClick` and `cursor-pointer` from O/D header left info div. Removed `hover:bg-[var(--surface)]/40` from outer O/D row div.
  2. Added `Tag` icon button for list price toggle (`expandedODKey`) with active state highlighting. Kept chevron button for airline sub-rows toggle (`expandedGroups`). Both use `stopPropagation`.
  3. Month cells verified — no onClick handlers, display-only.
- **Files Modified:** `_air-rate-list.tsx` (in `af-platform/src/app/(platform)/pricing/air/`)
- **Notes:** Lint passes clean. Two explicit buttons replace the implicit full-row click zone.

### [2026-03-13 01:00 UTC] — v6.28: Air Freight UI — Three Fixes
- **Status:** Completed
- **Tasks:**
  1. Fix 1 (DG badge): Verified O/D header already clean — no DG badges present. No changes needed.
  2. Fix 2 (List price card auto-create): Added `createAirListPriceCardAction` to `pricing.ts`. Added `originPortCode`, `destPortCode`, `dgClassCode` props to `AirRateModal` and `AirODExpandedPanel`. Updated `handleSave` in modal to auto-create list price card when `listPriceCardId` is null before creating the rate. Passed O/D+DG context from rate list → OD panel → modal.
  3. Fix 3 (Diagnostic): Added console.log in `_air-rate-list.tsx` logging `rates_by_supplier` keys when `expandedDetail` is set.
- **Files Modified:** `pricing.ts`, `_air-rate-modal.tsx`, `_air-expanded-panel.tsx`, `_air-rate-list.tsx`
- **Notes:** Lint passes clean. Fix 3 is diagnostic only — to be removed after investigation.

### [2026-03-13 00:30 UTC] — v6.27: Air Freight UI — OD Panel Fetch on Expand
- **Status:** Completed
- **Tasks:**
  1. Added `expandedODDetail` state to `_air-rate-list.tsx`.
  2. Added `useEffect` to fetch card detail via `fetchAirRateCardDetailAction(group.cards[0].id)` when `expandedODKey` changes.
  3. Updated `AirODExpandedPanel` render to use `expandedODDetail.list_price_rates` and `expandedODDetail.list_price_card_id` instead of `group.cards[0]` summary data. Shows loading spinner while fetching.
  4. Added re-fetch on `onRatesChanged` callback.
- **Files Modified:** `_air-rate-list.tsx` (in `af-platform/src/app/(platform)/pricing/air/`)
- **Notes:** Lint passes clean. Root cause: list endpoint doesn't return `list_price_rates`/`list_price_card_id` — only the detail endpoint does.

### [2026-03-13 00:00 UTC] — v6.26: Air Freight UI — Stale Detail + Sparkline Horizon Fixes
- **Status:** Completed
- **Tasks:**
  1. Fix 1: Added `setExpandedDetail(null)` before async fetch in `_air-rate-list.tsx` to clear stale supplier data when switching airline sub-rows.
  2. Fix 2: Updated `buildMonthMap` and `buildSurchargesMap` future-month branches in `_air-expanded-panel.tsx` — open-ended rates now carry forward into future months via `getDominantRate` fallback instead of showing null.
- **Files Modified:** `_air-rate-list.tsx`, `_air-expanded-panel.tsx` (both in `af-platform/src/app/(platform)/pricing/air/`)
- **Notes:** Lint passes clean. Surgical fixes only.

### [2026-03-12 23:30 UTC] — v6.25: Air Freight UI Restructure — List Price at O/D Level
- **Status:** Completed
- **Tasks:**
  1. Created `AirODExpandedPanel` component in `_air-expanded-panel.tsx` — O/D-level list price panel with sparkline, Update/Edit/Set end date buttons, terminate form, and `AirRateModal` wired with `isListPrice=true`.
  2. Stripped list price section from `AirExpandedPanel` — now shows supplier costs only. Removed `isListPriceRateId`, `priceRefRates`, list price sparkline row, and list price terminate handling. Added `months: MonthBucket[]` prop (replaces internal `useMonthBuckets(6)`). Extracted shared helpers (`buildMonthMap`, `buildSurchargesMap`, etc.) to module-level functions.
  3. Restructured `_air-rate-list.tsx` — two expand states: O/D header click toggles `expandedODKey` (list price panel), separate chevron button toggles `expandedGroups` (airline sub-rows). Added `AirODExpandedPanel` render after O/D header. Passed `months` prop to `AirExpandedPanel`.
  4. O/D-level alert logic via `getODAlertLevel` — computes alert from O/D list price vs best cost across all airline cards. Removed per-airline alert badges and red left border from sub-rows. Alert badge shown on O/D group header.
  5. O/D header month cells now show both list price (top) and best cost (bottom, muted). Airline sub-row cells show cost only — removed `p100_list_price` display.
  6. Removed unused `getAirAlertLevel` function.
- **Files Modified:** `_air-expanded-panel.tsx`, `_air-rate-list.tsx` (both in `af-platform/src/app/(platform)/pricing/air/`)
- **Notes:** Lint passes clean. No backend or modal changes.

### [2026-03-12 22:00 UTC] — v6.24: Air List Price UI (v6.20-B Frontend)
- **Status:** Completed
- **Tasks:**
  1. Updated `_air-expanded-panel.tsx`: changed `priceRefRates` source from `detail.rates_by_supplier?.['null']` to `detail.list_price_rates`. Added `isListPriceRateId` helper. Updated `handleTerminate` to branch on list price vs supplier rate. Passed `isListPrice` and `listPriceCardId` props to `AirRateModal`. Updated delete handler to branch on list price vs supplier.
  2. Updated `_air-rate-modal.tsx`: added `isListPrice` and `listPriceCardId` props. Imported `createAirListPriceRateAction` and `updateAirListPriceRateAction`. Branched `handleSave` — list price creates use `createAirListPriceRateAction(listPriceCardId)`, list price edits use `updateAirListPriceRateAction(rateId)`, supplier operations use existing actions.
- **Files Modified:** `_air-expanded-panel.tsx`, `_air-rate-modal.tsx` (both in `af-platform/src/app/(platform)/pricing/air/`)
- **Notes:** Lint passes clean. Supplier rows unchanged — `rates_by_supplier` no longer has `null` key so existing filter still correct.

### [2026-03-12 21:00 UTC] — v6.23: JSONB Write Audit: Shipments (pg8000 / Cloud Run Fix)
- **Status:** Completed
- **Tasks:**
  1. Audited all 8 shipment router files for `CAST(:param AS jsonb)` patterns — found 47 occurrences across `core.py`, `bl.py`, `doc_apply.py`, `route_nodes.py`, `status.py`, `scope.py`, `tasks.py`, `_status_helpers.py`.
  2. Fixed all 47 occurrences: replaced `CAST(:param AS jsonb)` with `:param::jsonb` + `.bindparams(bindparam("param", type_=String()))` chained to `text()`.
  3. Updated imports in all 8 files: added `bindparam, String` to sqlalchemy imports.
  4. For files with dynamic clause builders (doc_apply.py, route_nodes.py), bindparam lists are built alongside clauses and unpacked at execution.
- **Files Modified:** `core.py`, `bl.py`, `doc_apply.py`, `route_nodes.py`, `status.py`, `scope.py`, `tasks.py`, `_status_helpers.py` (all in `af-server/routers/shipments/`)
- **Notes:** All 8 files + main.py pass py_compile. Fix uses `CAST(:param AS jsonb)` + `.bindparams(bindparam("param", type_=String()))` — the `::jsonb` shorthand broke SQLAlchemy's text() parameter parser (`KeyError` on bind param name), so reverted to CAST syntax with bindparam type annotation which is the actual pg8000 fix.
