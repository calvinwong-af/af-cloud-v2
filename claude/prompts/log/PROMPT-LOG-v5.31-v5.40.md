# Prompt Completion Log — v5.31–v5.40

### [2026-03-09 08:00 UTC] — v5.39: Pricing Rate Edit Modal + Sparkline Tooltip Improvements
- **Status:** Completed
- **Tasks:**
  - Created `_rate-modal.tsx` — standalone modal dialog for Add/Edit rate operations with 2-column grid layout, supplier selector, date fields, currency/status, price/cost fields, surcharge editor rows, Save/Cancel footer with spinner
  - Rewrote `_expanded-panel.tsx` — removed all inline Add/Edit form state (formSupplier, formEffFrom, etc.), resetForm, initEditForm, handleSaveRate, inline form JSX block; added `ModalState` discriminated union and `<RateModal>` render; rewired Edit/+ Supplier Rate buttons to open modal; added `buildSurchargesMap` helper mirroring `buildMonthMap` but returning `SurchargeItem[] | null`; passed `surchargesMap` to all `<CostSparkline>` calls
  - Rewrote `_sparkline.tsx` — wrapped SVG in `<div style={{ position: 'relative' }}>`, replaced SVG `<text>` hover label with HTML tooltip popover showing month label + freight value + surcharge lines + total; kept current-month SVG label with clamped X position
  - Updated `_types.ts` — removed `'add'` and `'edit'` variants from `PanelMode`, keeping only `'view'` and `'terminate'`
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/_rate-modal.tsx` (new)
  - `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx`
  - `af-platform/src/app/(platform)/pricing/_sparkline.tsx`
  - `af-platform/src/app/(platform)/pricing/_types.ts`

---

### [2026-03-09 07:00 UTC] — v5.38: Pricing: JSONB Surcharges (DB + Backend + Frontend)
- **Status:** Completed
- **Tasks:**
  - Task 1: Created migration `018_surcharges_jsonb.sql` — adds `surcharges JSONB` column to `fcl_rates` and `lcl_rates`, migrates non-zero legacy flat surcharges into new array
  - Task 2: Backend FCL+LCL — removed `lss/baf/ecrs/psc` from Pydantic create/update models, added `surcharges: Optional[list]`; added `surcharges` to `_RATE_SELECT` and `_row_to_rate`; added `_surcharge_total()` helper; updated ts_rows/seed queries to include surcharges; time series buckets now include `surcharge_total` and `has_surcharges`; lowest cost comparison uses `cost + surcharge_total`; create/update endpoints use `json.dumps(surcharges)`
  - Task 3: Frontend types — added `SurchargeItem` interface, replaced `lss/baf/ecrs/psc` with `surcharges` on `RateDetail`, `RateCreateData`, `RateUpdateData`; added `surcharge_total`/`has_surcharges` to time_series bucket type
  - Task 4: Updated `hasMarginAlert` in `_helpers.ts` to include `surcharge_total` in comparison
  - Task 5: Added `SurchargeTooltip` component in `_rate-list.tsx`; month cells now display `list_price + surcharge_total` with `*` indicator and hover tooltip showing freight/surcharges/total breakdown
  - Task 6: Added surcharge editor in `_expanded-panel.tsx` — `formSurcharges` state, init from rate data on edit, surcharge rows in Add/Edit form with code/description/amount inputs and add/remove controls
- **Files Modified:**
  - `af-server/migrations/018_surcharges_jsonb.sql` (new)
  - `af-server/routers/pricing/fcl.py`
  - `af-server/routers/pricing/lcl.py`
  - `af-platform/src/app/actions/pricing.ts`
  - `af-platform/src/app/(platform)/pricing/_helpers.ts`
  - `af-platform/src/app/(platform)/pricing/_rate-list.tsx`
  - `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx`

---

### [2026-03-09 05:00 UTC] — v5.36: Rate Panel: 3 Remaining Fixes
- **Status:** Completed
- **Tasks:**
  - Fix 1: Added `last_cost_eff_to = None` to cost expiry reset in carry-forward loop (FCL + LCL) — prevents stale eff_to from affecting subsequent months after cost expiry
  - Fix 2: Moved `+ Supplier Rate` button into the Supplier Costs divider bar (right-aligned), removed old bottom trigger div, divider now always rendered regardless of supplier row count
  - Fix 3: Confirmed no change needed — `rates[0]` ordering is correct (backend orders by `effective_from DESC`)
- **Files Modified:**
  - `af-server/routers/pricing/fcl.py`
  - `af-server/routers/pricing/lcl.py`
  - `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx`

---

### [2026-03-09 04:00 UTC] — v5.35: Pricing Module: _components.tsx Refactor
- **Status:** Completed
- **Tasks:**
  - Split monolithic `_components.tsx` (1387 lines) into 7 focused modules
  - `_types.ts` — `MonthBucket` interface, `PanelMode` type
  - `_helpers.ts` — `useMonthBuckets`, `formatCompact`, `formatDate`, `hasMarginAlert`, `getDGChipStyle`
  - `_sparkline.tsx` — `CostSparkline` component
  - `_expanded-panel.tsx` — `ExpandedRatePanel` with inline CRUD forms
  - `_rate-list.tsx` — `TimeSeriesRateList` component
  - `_dashboard.tsx` — `PricingDashboard`, `ActiveCard`, `LockedCard`
  - `_rate-cards-tab.tsx` — `FCLRateCardsTab`, `LCLRateCardsTab`
  - Reduced `_components.tsx` to `ToggleSwitch` + re-exports for backward compatibility
  - Fixed 2 lint errors: unused `formatCompact` import in `_expanded-panel.tsx`, unused `MonthBucket` type import in `_rate-list.tsx`
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/_components.tsx` (rewritten to re-exports)
  - `af-platform/src/app/(platform)/pricing/_types.ts` (new)
  - `af-platform/src/app/(platform)/pricing/_helpers.ts` (new)
  - `af-platform/src/app/(platform)/pricing/_sparkline.tsx` (new)
  - `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx` (new)
  - `af-platform/src/app/(platform)/pricing/_rate-list.tsx` (new)
  - `af-platform/src/app/(platform)/pricing/_dashboard.tsx` (new)
  - `af-platform/src/app/(platform)/pricing/_rate-cards-tab.tsx` (new)

---

### [2026-03-09 06:00 UTC] — v5.37: Fix: Sparkline effective_to expiry (buildMonthMap rewrite)
- **Status:** Completed (Opus prompt + MCP follow-up fix)
- **Problem:** Sparkline in expanded rate panel was drawing dots and line past a rate's `effective_to` date. The old open-ended 2023 rate was becoming `bestRate` for months after the newer Feb 2026 rate expired, because `buildMonthMap` iterated ascending and any rate whose window overlapped the month won — it did not apply the correct semantic: the most recent rate to have started on or before a month is dominant; if it has expired, show nothing.
- **Fix:** Rewrote `buildMonthMap` — sort descending, find `dominantRate` as the most recent rate with `effective_from <= monthStart`, then check if `dominantRate.effective_to < monthStart` → null (no fallback to older rates). Future months only show a value if a rate starts exactly in that month.
- **Also:** Added polyline segment-breaking logic to `_sparkline.tsx` (gap detection via `monthIdx`); removed `[TS-DEBUG]` logging from `fcl.py`
- **Verified:** DG-2 (eff_to 2026-02-28) stops at 26-02 ✓; DG MARITIME (eff_to 2026-01-31) stops at 26-01 ✓; open-ended rates continue correctly ✓
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx`
  - `af-platform/src/app/(platform)/pricing/_sparkline.tsx`
  - `af-server/routers/pricing/fcl.py`

---

### [2026-03-09 03:00 UTC] — v5.34: Rate Panel: 5 Post-v5.33 Fixes
- **Status:** Completed
- **Tasks:**
  - Fix 1: Added `onCardsRefresh` prop to `TimeSeriesRateList`, called in `handleRefresh` after detail re-fetch, passed as `fetchCards` from both FCL and LCL tab components — grid row now updates time series after mutations
  - Fix 2: Updated `buildMonthMap` in `ExpandedRatePanel` to respect `effective_to` — checks `effFrom <= monthEnd && (effTo === null || effTo >= monthStart)` per month, sparkline stops at end date
  - Fix 3: Replaced SVG `<title>` tooltip in `CostSparkline` with `hoveredIdx` state + `onMouseEnter`/`onMouseLeave` — larger invisible hit target (`r={10}`), visible dot grows on hover, value label shown for hovered AND current month points
  - Fix 4: Removed `+ List Price Rate` button from trigger buttons — only `+ Supplier Rate` remains
  - Fix 5: Added `formRef` + `useEffect` scrollIntoView on `panelMode` change to `add`/`terminate` — attached to both terminate and add/edit form containers
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/_components.tsx`

---

### [2026-03-09 02:00 UTC] — v5.33: Rate CRUD: Effective End Date + Inline Rate Management + Margin Alerts
- **Status:** Completed
- **Migration 017:** Executed on prod DB (cloud-accele-freight:asia-northeast1:af-db) — 2026-03-08
- **Tasks:**
  - Created `af-server/migrations/017_rates_effective_to.sql` — adds `effective_to DATE NULL` to `fcl_rates` and `lcl_rates`
  - FCL backend: added `effective_to` to `FCLRateCreate`/`FCLRateUpdate` models, `_RATE_SELECT`, `_row_to_rate`, `create_fcl_rate` INSERT, `update_fcl_rate` field_map (with explicit NULL handling)
  - FCL carry-forward: broadened window query (`effective_from < :m_end AND (effective_to IS NULL OR effective_to >= :m_start)`), added `effective_to` to ts_rows/seed queries, stored `_eff_to` in price_ref_map and cost_eff_to_map, added expiry checks in carry-forward loop
  - LCL backend: identical changes to FCL
  - Frontend actions: added `effective_to` to `RateDetail` type, created `pricingMutate` helper for POST/PATCH/DELETE, added 6 new CRUD actions (createFCL/LCL, updateFCL/LCL, deleteFCL/LCL)
  - Frontend: added `hasMarginAlert` helper — detects cost > list_price for current/future months; margin alert chip on rate card rows; red cell highlighting where cost exceeds price
  - Frontend: redesigned `ExpandedRatePanel` with `PanelMode` state machine (view/add/edit/terminate), inline CRUD forms, "Set end date" for PUBLISHED rates, Edit/Delete for DRAFT rates, inline delete confirmation, "+ List Price Rate" / "+ Supplier Rate" trigger buttons
  - Added `companiesList` derivation and `handleRefresh` callback in `TimeSeriesRateList`
- **Files Modified:**
  - `af-server/migrations/017_rates_effective_to.sql` (new)
  - `af-server/routers/pricing/fcl.py`
  - `af-server/routers/pricing/lcl.py`
  - `af-platform/src/app/actions/pricing.ts`
  - `af-platform/src/app/(platform)/pricing/_components.tsx`

---

### [2026-03-09 00:00 UTC] — v5.32: Dynamic Historical Columns via ResizeObserver
- **Status:** Completed
- **Tasks:**
  - Deleted `useDynamicHistoricalCount` hook (window.innerWidth approach)
  - Added `ResizeObserver` inside `TimeSeriesRateList` on `containerRef` — calculates `historicalCount` from actual container width: `Math.floor((width - 220 - 240) / 80)`, capped 1–9
  - Removed `months` prop from `TimeSeriesRateList` — months now computed internally via `useMonthBuckets(historicalCount)`
  - Removed `historicalCount`/`months` from both `FCLRateCardsTab` and `LCLRateCardsTab`
  - Attached `containerRef` to loading skeleton, empty state, and main return divs
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/_components.tsx`

---

### [2026-03-08 23:00 UTC] — v5.31: Rate Card List: Remove Outer Scrollbar + Dynamic Historical Columns
- **Status:** Completed
- **Tasks:**
  - Fix 1: Removed `maxHeight: '70vh'` from `TimeSeriesRateList` outer container — list now grows naturally with page, eliminating redundant middle scrollbar
  - Fix 2: Added `useDynamicHistoricalCount` hook — calculates historical column count from `window.innerWidth`, capped 1–6, updates on resize; `useMonthBuckets` now accepts `historicalCount` parameter with `useMemo` dependency
  - Updated both `FCLRateCardsTab` and `LCLRateCardsTab` to use dynamic count
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/_components.tsx`

---
