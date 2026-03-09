# Prompt Completion Log — v5.61–v5.70

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
