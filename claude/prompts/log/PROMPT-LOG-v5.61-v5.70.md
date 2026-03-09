# Prompt Completion Log — v5.61–v5.70

### [2026-03-10 04:30 UTC] — v5.70: Pricing Dashboard Alert Badge Fix
- **Status:** Completed
- **Tasks:** Replaced `expiring_soon`-based status badge in `ActiveCard` with sum of all four alert scenario counts (`cost_exceeds_price + no_active_cost + no_list_price + price_review_needed`). FCL/LCL no longer show inflated "391/198 cards need attention"; Local Charges/Customs now correctly reflect real alert counts.
- **Files Modified:** `af-platform/src/app/(platform)/pricing/_dashboard.tsx`

### [2026-03-09 16:00 UTC] — v5.69: Full Alert Standardisation Across All Pricing Modules
- **Status:** Completed
- **Tasks:** (A) Backend dashboard: added Scenario 4 `no_active_cost` SQL count for FCL/LCL — list price active but no supplier cost covering today. (B) FCL + LCL `alerts_only` filter: added Scenario 4 OR clause to existing 3-scenario block. (C) TypeScript types: added `no_active_cost: number` to `DashboardComponentSummary`; added `'local-charges'` and `'customs'` keys to `DashboardSummary`. (D) Dashboard frontend: added `no_active_cost` to `ActiveCard` stats type, alert row ("X costs expired" in red), updated visibility condition. (E) Local charges table: added `getLocalChargeAlertLevel()` helper (checks current month bucket for cost>price or missing cost), row/badge/cell alert coloring, `alertFilter` prop, `showIssuesOnly` state + toggle button, client-side issues filter in `filteredCards`, updated footer count. (F) Customs table: identical alert treatment with `getCustomsAlertLevel()`. (G) Backend dashboard: added flat-rate loop for `local-charges` and `customs_rates` tables with `total_cards`, `last_updated`, `cost_exceeds_price`, `no_active_cost` counts. Customs uses 5-column DISTINCT key (no container_size/type), local_charges uses 7-column key. (J/K) Pages: `local-charges/page.tsx` and `customs/page.tsx` now accept `searchParams.alerts` and forward as `alertFilter` prop. (L/M) Issues Only toggle + filter added to both tables.
- **Files Modified:** `af-server/routers/pricing/__init__.py`, `af-server/routers/pricing/fcl.py`, `af-server/routers/pricing/lcl.py`, `af-platform/src/app/actions/pricing.ts`, `af-platform/src/app/(platform)/pricing/_dashboard.tsx`, `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-table.tsx`, `af-platform/src/app/(platform)/pricing/local-charges/page.tsx`, `af-platform/src/app/(platform)/pricing/customs/_customs-table.tsx`, `af-platform/src/app/(platform)/pricing/customs/page.tsx`
- **Notes:** Fixed build error: removed invalid `trade_direction === 'ALL'` group from local charges table (type only allows IMPORT/EXPORT).

### [2026-03-10 03:30 UTC] — v5.68: Remove End Date Fix + New Effective Rate Flow
- **Status:** Completed
- **Tasks:** (1) Bug fix: removed 4 debug console.log lines from local-charges-modal, customs-modal, and local-charges-table. (2) Backend: added `close_previous: bool = True` to `LocalChargeCreate` and `CustomsRateCreate` models; after INSERT, auto-closes previous open-ended row (same card key, `effective_to IS NULL`) by setting `effective_to = new_effective_from - 1 day`. (3) Frontend types: extended `createLocalChargeAction` and `createCustomsRateAction` data params with `close_previous?: boolean`. (4) Modal changes: added `mode: 'edit' | 'new-rate'` prop to both `LocalChargesModal` and `CustomsModal`; new-rate mode sets `effective_from` to first of next month, clears `effective_to`, includes `close_previous: true` in submit data, shows "New Rate — effective [date]" title. (5) Table changes: added `modalMode` state to both tables; replaced single pencil button with two hover buttons (pencil for Edit, plus for New Rate); updated `onEdit` → `onAction` with mode parameter; wired `mode` prop to modals; updated `handleSave` to branch on `modalMode` — edit=PATCH, new-rate=POST.
- **Files Modified:** `af-server/routers/pricing/local_charges.py`, `af-server/routers/pricing/customs.py`, `af-platform/src/app/actions/pricing.ts`, `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-table.tsx`, `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-modal.tsx`, `af-platform/src/app/(platform)/pricing/customs/_customs-table.tsx`, `af-platform/src/app/(platform)/pricing/customs/_customs-modal.tsx`

### [2026-03-10 02:45 UTC] — v5.67: Clear effective_to Across Financial Rate Modals
- **Status:** Completed
- **Tasks:** Added "× Remove end date" button to effective_to field in three modals: (1) local-charges modal — visible when `editRate && effectiveTo`, clears to empty string (submits as null). (2) customs modal — same pattern with inline class string. (3) FCL/LCL rate modal — visible when `mode === 'edit' && effTo`. All three use consistent styling: `text-xs text-[var(--text-muted)] hover:text-red-500 underline`. Input placeholder changed to "Ongoing".
- **Files Modified:** `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-modal.tsx`, `af-platform/src/app/(platform)/pricing/customs/_customs-modal.tsx`, `af-platform/src/app/(platform)/pricing/_rate-modal.tsx`

### [2026-03-10 02:30 UTC] — v5.66: FCL/LCL Time Series Window Alignment
- **Status:** Completed
- **Tasks:** Expanded time series window from 9 months (6 past + current + 2 future) to 12 months (9 past + current + 2 future) in both FCL and LCL card endpoints. Changed `range(9)` with offset `-6` to `range(12)` with offset `-9`. The `month_start`/`month_end` derivations auto-adjust via `months[0]`/`months[-1]`.
- **Files Modified:** `af-server/routers/pricing/fcl.py`, `af-server/routers/pricing/lcl.py`

### [2026-03-10 02:15 UTC] — v5.65: Edit Rate from Card Row (Local Charges + Customs)
- **Status:** Completed
- **Tasks:** (1) Local charges: added Pencil/Plus imports, modal state (modalOpen, editRate, editRateId), handleSave handler with create/update branching, "Add Rate" button in filter bar, LocalChargesModal rendered at bottom, onEdit prop threaded to LocalChargeCardList, pencil button on hover in identity panel. (2) Customs: added Pencil import, editRateId state, updated onSave to branch create vs update via createCustomsRateAction/updateCustomsRateAction, onEdit prop threaded to CustomsCardList, pencil button on hover in identity panel, updated onClose to clear editRateId. Also fixed prior build failure (removed invalid `trade_direction === 'ALL'` comparison).
- **Files Modified:** `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-table.tsx`, `af-platform/src/app/(platform)/pricing/customs/_customs-table.tsx`

### [2026-03-10 01:10 UTC] — v5.64b: Recover consolidate_rates.py + flip DRY_RUN
- **Status:** Completed
- **Tasks:** Regenerated full `consolidate_rates.py` from scratch after truncation by bad MCP write. Script restored with all logic intact: table definitions, parse_date, find_runs, process_table, main. `DRY_RUN = False` as requested.
- **Files Modified:** `af-server/scripts/consolidate_rates.py`

### [2026-03-10 00:45 UTC] — v5.64: Migrated Rate Data Consolidation Script
- **Status:** Completed
- **Tasks:** Created `af-server/scripts/consolidate_rates.py` — standalone script that consolidates redundant monthly rate rows in `local_charges` and `customs_rates` tables. Groups rows by card key, walks rows ordered by effective_from ASC, identifies consecutive runs with identical price/cost/is_active and no date gaps, collapses each run into a single row (keeps earliest, extends effective_to, deletes rest). DRY_RUN=True by default. Handles NULL effective_to (open-ended). Prints detailed per-table summary with sample consolidations. Deletes in 500-id chunks.
- **Files Modified:** `af-server/scripts/consolidate_rates.py` (new)

### [2026-03-10 00:15 UTC] — v5.63: Local Charges + Customs Card View Redesign
- **Status:** Completed
- **Tasks:** (1) Backend: added `GET /ports` and `GET /cards` endpoints to `customs.py` — mirrors local_charges pattern, card key uses port_code|trade_direction|shipment_type|charge_code|is_domestic (no container fields), 12-month time_series. (2) Frontend: added `CustomsRateCard`, `CustomsRateTimeSeries` interfaces + `fetchCustomsRatePortsAction`, `fetchCustomsRateCardsAction` to `pricing.ts`. (3) Rewrote `_local-charges-table.tsx` — removed expand/collapse (expandedKey, ExpandedRateRows, chevron icons), removed direction filter dropdown, added effective date label on each card row, added collapsible Import/Export/ALL section headers with chevron toggle. (4) Rewrote `_customs-table.tsx` — replaced flat table with card view matching local charges pattern, country→port→shipmentType filters, direction grouping with collapsible headers, "Add Rate" button opens CustomsModal, no container/PWF badges. (5) Updated `customs/page.tsx` — imports `CustomsRatesTab`, passes `countryCode="MY"`.
- **Files Modified:** `af-server/routers/pricing/customs.py`, `af-platform/src/app/actions/pricing.ts`, `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-table.tsx`, `af-platform/src/app/(platform)/pricing/customs/_customs-table.tsx`, `af-platform/src/app/(platform)/pricing/customs/page.tsx`

### [2026-03-10] — v5.68: Remove End Date Fix + New Effective Rate Flow
- **Status:** Completed
- **Tasks:** (1) Bug fix: "× Remove end date" not persisting — remove debug logs, trace null handling through frontend PATCH flow, fix customs table's onSave handler if missing updateCustomsRateAction branch. (2) Feature: split pencil button into Edit [✏] + New Rate [+] on all rate cards (local charges + customs); LocalChargesModal/CustomsModal gain `mode: 'edit'|'new-rate'` prop; new-rate mode defaults effective_from to first of next month, sends POST instead of PATCH, includes `close_previous: true`; backend POST /rates auto-closes previous open-ended row for same card key in same transaction.
- **Files:** `af-server/routers/pricing/local_charges.py`, `af-server/routers/pricing/customs.py`, `af-platform/src/app/actions/pricing.ts`, `_local-charges-table.tsx`, `_local-charges-modal.tsx`, `_customs-table.tsx`, `_customs-modal.tsx`

### [2026-03-09 23:30 UTC] — v5.62b: Recover migrate_customs_charges.py
- **Status:** Completed
- **Tasks:** Regenerated `migrate_customs_charges.py` from scratch — file was truncated to ~30 lines. Full script restored following `migrate_local_charges.py` pattern with customs-specific differences: `PricingCustomsCharges` kind, `PT-CUSTOMS-CHARGES` rate filter, no container fields, no paid_with_freight, customs UOM set (no QTL/RAIL_3KG), `customs_rates_unique` constraint. `DRY_RUN = False` as requested.
- **Files Modified:** `af-server/scripts/migrate_customs_charges.py`

### [2026-03-09 23:00 UTC] — v5.62: Local Charges Rate Card View (FCL/LCL Pattern)
- **Status:** Completed
- **Tasks:** (1) Added `GET /ports` endpoint to `local_charges.py` — returns distinct port_code values with optional country_code filter via ports table join. (2) Added `GET /cards` endpoint to `local_charges.py` — fetches all rows for a port, groups by card key (port_code|trade_direction|shipment_type|container_size|container_type|charge_code|is_domestic), builds 12-month time_series per card with active-row resolution. (3) Added `LocalChargeCard`, `LocalChargeTimeSeries` interfaces + `fetchLocalChargeCardsAction`, `fetchLocalChargePortsAction` to `pricing.ts`. (4) Replaced `_local-charges-table.tsx` flat table with `LocalChargesTab` + `LocalChargeCardList` — country→port→direction→shipmentType filters, port gate (empty state until port selected), charge code cards with time-series cell grid (price/cost per month), expand to show rate history, ResizeObserver for responsive month columns. (5) Updated `page.tsx` — imports `LocalChargesTab`, passes `countryCode="MY"`.
- **Files Modified:** `af-server/routers/pricing/local_charges.py`, `af-platform/src/app/actions/pricing.ts`, `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-table.tsx`, `af-platform/src/app/(platform)/pricing/local-charges/page.tsx`

### [2026-03-09 22:00 UTC] — v5.61: Customs Rates price/cost schema fix + data migration script
- **Status:** Completed
- **Tasks:** (1) Created migration `025_customs_rates_price_cost.sql` — drops `amount` column, adds `price` and `cost` columns, recreates `customs_rates_uom_check` constraint. Uses `IF EXISTS`/`IF NOT EXISTS` for idempotent application on local DB (already migrated via 023). (2) Verified `customs.py` router already has `price`/`cost`/`is_domestic` from v5.58 — no changes needed. (3) Created `migrate_customs_charges.py` — standalone script mirroring `migrate_local_charges.py` for `PricingCustomsCharges` + `PTMonthlyRatePortCharges` (kind=PT-CUSTOMS-CHARGES). Key differences from local charges: no container_size/type fields, no paid_with_freight, no C3KG/RAIL_3KG UOM remap, customs-specific VALID_UOMS set, `customs_rates_unique` constraint for ON CONFLICT.
- **Files Modified:** `af-server/migrations/025_customs_rates_price_cost.sql` (new), `af-server/scripts/migrate_customs_charges.py` (new)
- **Notes:** Tasks 1 & 2 were already done on local DB and router from v5.58. Migration file created for prod deployment tracking. No frontend changes required.
