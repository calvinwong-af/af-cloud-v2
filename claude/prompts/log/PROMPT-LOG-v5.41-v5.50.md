# Prompt Completion Log — v5.41–v5.50

### [2026-03-09 13:30 UTC] — v5.50: Sparkline Start-Date Markers
- **Status:** Completed
- **Tasks:** (1) Added `buildStartDateMap` helper in `_expanded-panel.tsx` — mirrors `buildEndDateMap` but keyed on `effective_from`, with guard to skip rates at or before MIGRATION_FLOOR (2024-01). (2) Passed `startDateMap` to both List Price and Supplier sparklines. (3) Added `startDateMap` prop to `CostSparkline`. (4) Rendered amber upward tick + diamond above dots on start-date months. (5) Updated click handler: end-date takes priority, then start-date. (6) Added "Starts [date] · Click to edit" tooltip line.
- **Files Modified:** `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx`, `af-platform/src/app/(platform)/pricing/_sparkline.tsx`

### [2026-03-09 13:00 UTC] — v5.49: Edit Published Rates + Sparkline End-Date Markers
- **Status:** Completed
- **Tasks:** (1) Added "Edit" button to PUBLISHED rate rows (List Price + Supplier) alongside existing "Update" and "Set end date" buttons. (2) Added `buildEndDateMap` helper in `_expanded-panel.tsx` to map month_key → RateDetail for rates with non-null `effective_to`. (3) Added `endDateMap` and `onNodeClick` props to `CostSparkline`. (4) Rendered amber tick + diamond SVG markers on sparkline nodes where a rate ends. (5) Added click-to-edit on end-date markers opening the edit modal. (6) Enhanced sparkline tooltip with "Ends [date] · Click to edit" line for end-date months.
- **Files Modified:** `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx`, `af-platform/src/app/(platform)/pricing/_sparkline.tsx`

### [2026-03-09 12:15 UTC] — v5.48: Migration 019: Rate Data Quality + Detail Endpoint Seed+Window Pattern
- **Status:** Completed
- **Tasks:** (1) Created migration 019 — fixes inverted effective dates (1 FCL row) and terminates superseded open-ended records (1906 FCL, 983 LCL). (2) Replaced unbounded rate fetch in `get_fcl_rate_card` and `get_lcl_rate_card` with seed+window pattern (window >= 2024-01-01, plus one seed per supplier before floor). (3) Added inverted-date defensive guard to `formatRatesRange` in `_expanded-panel.tsx`. (4) Removed `console.log` debug from `getDominantRate`.
- **Files Modified:** `af-server/migrations/019_rate_data_quality.sql` (new), `af-server/routers/pricing/fcl.py`, `af-server/routers/pricing/lcl.py`, `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx`

### [2026-03-09 11:30 UTC] — v5.47: Rate Range Label: Show Current Rate Period + Port Country Fix
- **Status:** Completed
- **Tasks:** (1) Fixed Port `country` field mismatch — renamed `country_name` to `country` in `Port` interface and all references across `ports.ts`, `_rate-cards-tab.tsx` (FCL+LCL portsMap build, state type, text filter), `_rate-list.tsx` (prop type, dest display now shows country). (2) Replaced `formatRatesRange` to show latest rate's own period with "Since" prefix instead of earliest `effective_from`. (3) Added temporary `console.log` in `getDominantRate` for COSCO sparkline debugging.
- **Files Modified:** `af-platform/src/lib/ports.ts`, `af-platform/src/app/(platform)/pricing/_rate-cards-tab.tsx`, `af-platform/src/app/(platform)/pricing/_rate-list.tsx`, `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx`

### [2026-03-09 10:00 UTC] — v5.46: Per-Supplier Cost Carry-Forward in Time Series Builder
- **Status:** Completed
- **Tasks:** Replaced single-scalar `last_cost` carry-forward with per-supplier dict (`active_supplier_costs`). Seed query now fetches `DISTINCT ON (rate_card_id, supplier_id)` to get best pre-window rate per supplier. Window loop populates `cost_map_by_supplier` alongside existing `cost_map`. Per-month logic merges new supplier entries, expires past `effective_to`, then takes minimum across all active suppliers. Removed `seed_cost_map`, `seed_min_cost_map`, `seed_cost_eff_to_map`, `seed_cost_surcharges_map`, `cost_eff_to_map`, `last_cost_eff_to` scalars.
- **Files Modified:** `af-server/routers/pricing/fcl.py`, `af-server/routers/pricing/lcl.py`

### [2026-03-09 09:00 UTC] — v5.45: Set End Date Inline UI + Rate Range Label Open-End Fix
- **Status:** Completed
- **Tasks:** (1) Moved terminate form from bottom of expanded panel to render inline immediately below the triggering row (list price or supplier). Removed `terminateRef`/`useRef` and scroll `useEffect`. Wrapped supplier rows in outer `<div>` to allow sibling terminate form. (2) Fixed `hasOpenEnd` in `formatRatesRange` to only check the latest rate by `effective_from`, not all records — prevents stale historical records from forcing "Open" label.
- **Files Modified:** `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx`

### [2026-03-09 08:00 UTC] — v5.44: Restore lcl.py + Fix model_fields_set + Grid Surcharge Split + Date Label Fix
- **Status:** Completed
- **Tasks:** (1) lcl.py intact — applied `__fields_set__` fix (Pydantic v1) to `update_lcl_rate`. (2) fcl.py `__fields_set__` already fixed by user. (3) Split `surcharge_total` into `list_surcharge_total` + `cost_surcharge_total` in both fcl.py and lcl.py time series builders — future branch now uses `best_cost_entry` instead of `cost_entries[0]`. (4) Fixed `formatRatesRange` null `effective_from` — uses `MIGRATION_FLOOR` fallback instead of filtering out nulls. (5) Added `list_surcharge_total`/`cost_surcharge_total` to pricing.ts type and updated _rate-list.tsx cells to use per-row surcharge totals.
- **Files Modified:** `af-server/routers/pricing/fcl.py`, `af-server/routers/pricing/lcl.py`, `af-platform/src/app/actions/pricing.ts`, `af-platform/src/app/(platform)/pricing/_rate-list.tsx`, `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx`

### [2026-03-09 07:00 UTC] — v5.43: Fix Create Rate 500 + Currency All Columns + Currency Alignment + Update Pre-populate from Latest Effective Rate
- **Status:** Completed
- **Tasks:** (1) Fixed `:status::rate_status` psycopg2 cast conflict in fcl.py/lcl.py CREATE and UPDATE — replaced with `CAST(:status AS rate_status)`. (2) Currency label now shown on all columns with data, not just current month. (3) Currency input field in modal now fills grid cell properly (removed `!w-20`, added `toUpperCase()` + `maxLength`). (4) Update button now pre-populates from currently-effective rate (effective today) rather than latest rate record.
- **Files Modified:** `af-server/routers/pricing/fcl.py`, `af-server/routers/pricing/lcl.py`, `af-platform/src/app/(platform)/pricing/_rate-list.tsx`, `af-platform/src/app/(platform)/pricing/_rate-modal.tsx`, `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx`

### [2026-03-09 06:15 UTC] — v5.42: Rate Update (Supersede) + Currency in Grid
- **Status:** Completed
- **Tasks:** Added "Update" button on PUBLISHED rates (supersede pattern — creates new rate pre-filled from current, effective_from defaults to 1st of next month); added currency display on current month column in time series grid
- **Files Modified:** `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx`, `af-platform/src/app/(platform)/pricing/_rate-modal.tsx`, `af-platform/src/app/(platform)/pricing/_rate-list.tsx`

### [2026-03-08 15:30 UTC] — v5.41: Tooltip Overflow Fix: Fixed-Position Tooltips
- **Status:** Completed
- **Tasks:** Converted SurchargeTooltip and CostSparkline hover tooltips from `position: absolute` to `position: fixed` with `getBoundingClientRect()` coords to bypass overflow clipping from ancestor scroll containers
- **Files Modified:** `af-platform/src/app/(platform)/pricing/_rate-list.tsx`, `af-platform/src/app/(platform)/pricing/_sparkline.tsx`
- **Notes:** Removed wrapper `<div style={{ position: 'relative' }}>` from sparkline, replaced with fragment. Both tooltips now use `zIndex: 9999` and render at viewport-relative coords.
