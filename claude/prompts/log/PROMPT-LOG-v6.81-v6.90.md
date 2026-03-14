## Prompt Log — v6.81 to v6.90

### [2026-03-15 16:30 UTC] — v6.90: UI-18 Cross-Module UI Consistency Audit (FCL/LCL/Air → Haulage Pattern)
- **Status:** Completed
- **Tasks:**
  - Change 1: Simplified `PanelMode` in `_types.ts` — removed `terminate` variant and `RateDetail` import
  - Change 2: Rewrote `_expanded-panel.tsx` — removed `panelMode`/`setPanelMode`/`formTerminateDate`/`handleTerminate`/`saving`/`btnClass`/`inputClass`; added `confirmDeleteRateId`/`deleting`/`handleRateDelete` with FCL/LCL dispatch; replaced text button actions with Pencil+Trash2 icon buttons on both list price and supplier rows; removed both terminate inline form blocks; removed `panelMode.type === 'view'` guards; `PanelMode` import removed
  - Change 3: Rewrote `air/_air-expanded-panel.tsx` — removed local `PanelMode` type, `panelMode`/`setPanelMode`/`formTerminateDate`/`handleTerminate`/`saving`/`btnClass`/`inputClass`; added separate `handleListPriceDelete` (uses `deleteAirListPriceRateAction`) and `handleSupplierDelete` (uses `deleteAirRateAction`); replaced text buttons with Pencil+Trash2 icons + inline confirm on both `AirODExpandedPanel` and `AirExpandedPanel`; removed both terminate inline form blocks
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/_types.ts`
  - `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx`
  - `af-platform/src/app/(platform)/pricing/air/_air-expanded-panel.tsx`
- **Notes:** ESLint clean. No backend changes. Modal `onDelete` prop preserved for parallel delete path.

### [2026-03-15 15:30 UTC] — v6.89: RHB Cross-Rate Support for Non-MYR Currency Pairs
- **Status:** Completed
- **Tasks:** Replaced the `else` skip block in `fetch_rhb_rates` with cross-rate calculation through MYR — normalises both legs (sell_tt_od / unit), divides base by target, applies adjustment_pct, upserts into `currency_rates` with "cross via MYR" notes
- **Files Modified:** `af-server/routers/pricing/currency.py`
- **Notes:** py_compile clean. No schema changes, no frontend changes. Division-by-zero guard on target_normalised included.

### [2026-03-15 15:00 UTC] — v6.88: Haulage is_tariff_rate + FAF calculation engine
- **Status:** Completed
- **Tasks:**
  - Part A: Created migration 064 SQL + runner script — adds `is_tariff_rate BOOLEAN NOT NULL DEFAULT FALSE` to `haulage_rate_cards`
  - Part B: Updated haulage.py — added `is_tariff_rate` to Pydantic models (create/update), `_row_to_rate_card` (index 13), all card SELECT queries, INSERT, UPDATE, and RETURNING data; shifted enrichment indices (area_name etc.) from 13→14 through 16→17
  - Part C: Added `_resolve_faf_percent` helper to quotations.py — resolves active FAF percent from `haulage_faf_rates` JSONB `port_rates` for supplier+port+container_size with wildcard fallback; added FAF block in `_resolve_haulage` after surcharge loop emitting `HA-FAF` line item at post-rebate cost × faf_percent
  - Part D1: Added `is_tariff_rate` to `HaulageRateCard` interface in pricing.ts
  - Part D2: Added "Tariff Rate" checkbox to `HaulageRateCardEditModal` (state, useEffect init, JSX, save payload)
  - Part D3: Added violet "Tariff" badge on card rows in `_haulage-rate-list.tsx`
  - Part D4: Added FAF percent display on supplier rows — `fafMap` state, useEffect fetching `fetchHaulageFafRatesAction` per supplier, matching port+container_size, displaying `FAF: X.X%` badge
- **Files Modified:**
  - `af-server/migrations/064_haulage_is_tariff_rate.sql` (new)
  - `af-server/scripts/run_migration_064.py` (new)
  - `af-server/routers/pricing/haulage.py`
  - `af-server/routers/quotations.py`
  - `af-platform/src/app/actions/pricing.ts`
  - `af-platform/src/app/(platform)/pricing/haulage/_haulage-expanded-panel.tsx`
  - `af-platform/src/app/(platform)/pricing/haulage/_haulage-rate-list.tsx`
- **Notes:** py_compile clean on haulage.py + quotations.py. ESLint clean. Migration 064 must be run manually before deploy.

### [2026-03-15 14:00 UTC] — v6.87: Haulage UI/UX Refinements (icons, display, button labels)
- **Status:** Completed
- **Tasks:**
  - Change 1: Added `DELETE /rate-cards/{card_id}` endpoint to haulage.py; added `deleteHaulageRateCardAction` to pricing.ts; added Trash2 icon button on card rows with inline confirm overlay; wired `onDeleteCard` prop in rate-cards-tab
  - Change 2: Added rate row delete button with inline "Sure? Yes/No" confirm on both list price and supplier rows in expanded panel
  - Change 3: Swapped display hierarchy — area name is now primary (bold), port code is secondary (muted); truncation at 28 chars with tooltip; updated column header to "Area / Container"
  - Change 4: Removed "Set end date" button and all terminate flow (PanelMode type, panelMode state, formTerminateDate, handleTerminate, terminate inline forms); renamed "Update" → "Add rate" on all rate rows
  - Change 5: Added UI-18 cross-module audit item to AF-Backlog.md
- **Files Modified:**
  - `af-server/routers/pricing/haulage.py`
  - `af-platform/src/app/actions/pricing.ts`
  - `af-platform/src/app/(platform)/pricing/haulage/_haulage-rate-list.tsx`
  - `af-platform/src/app/(platform)/pricing/haulage/_haulage-expanded-panel.tsx`
  - `af-platform/src/app/(platform)/pricing/haulage/_haulage-rate-cards-tab.tsx`
  - `claude/other/AF-Backlog.md`
- **Notes:** py_compile and ESLint clean. Removed unused `updateHaulageRateAction` import and `inputClass` variable from expanded panel.

### [2026-03-15 11:30 UTC] — v6.86: Haulage currency + uom to card level (migration + full refactor)
- **Status:** Completed
- **Tasks:**
  - Part A: Created migration 063 SQL + runner script — moves `currency`/`uom` from `haulage_rates` to `haulage_rate_cards` with backfill from latest rate row, defaults, NOT NULL, and column drop
  - Part B: Updated `haulage.py` — added currency/uom to card Pydantic models, removed from rate models; updated `_row_to_rate_card` (indices 11/12), `_row_to_rate` (shifted indices after removing currency/uom), `_RATE_SELECT`; updated all card SELECT queries to include `rc.currency, rc.uom`; built `card_currency_map` for time-series; removed currency from `ts_rows`, `seed_price_rows`, `seed_price_map` destructuring; updated card create/update endpoints; removed currency/uom from rate create/update
  - Part B (quotations): Updated `_resolve_haulage` to read `currency` from card row (`card[3]`), removed `currency` from rate queries, fixed all column indices for `lp`/`sc`/surcharge rows
  - Part C1: Removed currency + uom fields from `_haulage-rate-modal.tsx` (state, useEffect init, JSX row, handleSave payloads)
  - Part C2: Replaced `HaulageRateCardEditModal` with expanded version showing read-only identity section + editable currency/uom/flags; exported it
  - Part C2c: Removed old "Edit card" button from expanded panel; added pencil icon on hover in `_haulage-rate-list.tsx` with `onEditCard` prop
  - Part C3: Wired `cardEditTarget` state + modal rendering in `_haulage-rate-cards-tab.tsx`
  - Part C4: Added `currency`/`uom` to `HaulageRateCard` interface and action type signatures in `pricing.ts`
- **Files Modified:**
  - `af-server/migrations/063_haulage_card_currency_uom.sql` (new)
  - `af-server/scripts/run_migration_063.py` (new)
  - `af-server/routers/pricing/haulage.py`
  - `af-server/routers/quotations.py`
  - `af-platform/src/app/actions/pricing.ts`
  - `af-platform/src/app/(platform)/pricing/haulage/_haulage-rate-modal.tsx`
  - `af-platform/src/app/(platform)/pricing/haulage/_haulage-expanded-panel.tsx`
  - `af-platform/src/app/(platform)/pricing/haulage/_haulage-rate-list.tsx`
  - `af-platform/src/app/(platform)/pricing/haulage/_haulage-rate-cards-tab.tsx`
- **Notes:** py_compile clean on haulage.py + quotations.py. ESLint clean. Migration must be run manually before deploy.

### [2026-03-15 10:00 UTC] — v6.85: Haulage Rate Card Edit Modal + Surcharge Display + Quotation Surcharge Fix
- **Status:** Completed
- **Tasks:**
  - Issue 1: Added inline `HaulageRateCardEditModal` component with `include_depot_gate_fee`, `side_loader_available`, `is_active` toggles; wired "Edit card" button in expanded panel header
  - Issue 2: Fixed sparkline tooltip to show surcharge `description` instead of `code`
  - Issue 3: Rewrote surcharge loop in `_resolve_haulage` to union list price and supplier surcharges — supplier-only surcharges now pass through at cost, both-side surcharges use list price for price and supplier for cost
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/haulage/_haulage-expanded-panel.tsx`
  - `af-platform/src/app/(platform)/pricing/_sparkline.tsx`
  - `af-server/routers/quotations.py`
- **Notes:** py_compile and ESLint clean. Surcharge description key also fixed in the rewrite (uses `description || label || code`).

### [2026-03-14 16:00 UTC] — v6.84: RHB FX Scraper
- **Status:** Completed
- **Tasks:**
  - A: Added `POST /fetch-rhb` endpoint to `currency.py` — scrapes RHB FX page, parses table, matches against existing `currency_rate_pairs`, normalises unit, applies adjustment_pct, upserts into `currency_rates` for current week's Monday
  - B: Added `RhbFetchResult` interface and `fetchRhbRatesAction` to `pricing.ts`
  - C: Added "Fetch from RHB" button to currency page toolbar with spinning icon, success/error banner
  - D: Added `CurrencyCard` component to `_dashboard.tsx` with inline "Fetch from RHB" button
  - Added `beautifulsoup4` to `requirements.txt`; `httpx` already present
- **Files Modified:**
  - `af-server/routers/pricing/currency.py`
  - `af-server/requirements.txt`
  - `af-platform/src/app/actions/pricing.ts`
  - `af-platform/src/app/(platform)/pricing/currency/page.tsx`
  - `af-platform/src/app/(platform)/pricing/_dashboard.tsx`
- **Notes:** py_compile and ESLint clean. Scraper uses try/except import guard (`_SCRAPER_AVAILABLE`). Bank Sell TT/OD used when target=MYR; Bank Buy OD when base=MYR. Unit normalisation handles per-100 currencies.

### [2026-03-14 14:00 UTC] — v6.83: Exchange Rate UI Rebuild + FX Architecture
- **Status:** Completed
- **Tasks:**
  - A: Created migration 062 (`currency_rate_pairs` table + `fx_snapshot` JSONB on quotations) + runner script
  - B1: Added `CurrencyPairUpdate` model to `currency.py`
  - B2: Updated `GET /pairs` to JOIN `currency_rate_pairs` — returns `adjustment_pct`, `is_active`, `pair_id`
  - B3: Updated `POST /pairs` to also INSERT into `currency_rate_pairs`
  - B4: Added `PATCH /pairs/{pair_id}` endpoint for adjustment/active/notes updates
  - B5: Added `GET /pairs-with-series` endpoint — weekly time-series with carry-forward + effective_rate calculation
  - C: Added `WeekBucket` interface and `useWeekBuckets` hook to `_helpers.ts`
  - D: Added `CurrencyWeekBucket`, `CurrencyPairWithSeries` types + `fetchCurrencyPairsWithSeriesAction`, `updateCurrencyPairAction` to `pricing.ts`
  - E: Full rewrite of `/pricing/currency/page.tsx` — flat table with dynamic week columns (ResizeObserver), identity column with badges/hover actions, rate/pair/new-pair modals
- **Files Modified:**
  - `af-server/migrations/062_currency_pairs.sql` (new)
  - `af-server/scripts/run_migration_062.py` (new)
  - `af-server/routers/pricing/currency.py`
  - `af-platform/src/app/(platform)/pricing/_helpers.ts`
  - `af-platform/src/app/actions/pricing.ts`
  - `af-platform/src/app/(platform)/pricing/currency/page.tsx`
- **Notes:** py_compile and ESLint clean. `fx_snapshot` column added but not populated — that's a separate workstream.

### [2026-03-14 12:30 UTC] — v6.82: Exchange Rate UI
- **Status:** Completed
- **Tasks:**
  - A: Created `af-server/routers/pricing/currency.py` with 5 endpoints: GET/POST pairs, GET/POST rates (upsert), DELETE rate (with last-rate guard)
  - B: Registered currency router in `af-server/routers/pricing/__init__.py` at `/currency` prefix
  - C: Added CurrencyPair/CurrencyRate interfaces and 5 action functions to `af-platform/src/app/actions/pricing.ts`
  - D: Added DollarSign import and Exchange Rates card as first item in PRICING_COMPONENTS in `_dashboard.tsx`
  - E: Created `af-platform/src/app/(platform)/pricing/currency/page.tsx` — two-panel layout with pair sidebar, rate history table, add rate modal (week picker snaps to Monday), new pair modal
- **Files Modified:**
  - `af-server/routers/pricing/currency.py` (new)
  - `af-server/routers/pricing/__init__.py`
  - `af-platform/src/app/actions/pricing.ts`
  - `af-platform/src/app/(platform)/pricing/_dashboard.tsx`
  - `af-platform/src/app/(platform)/pricing/currency/page.tsx` (new)
- **Notes:** py_compile and ESLint clean.

### [2026-03-15 09:00 UTC] — v6.81: Enriched Quotation Summary Card
- **Status:** Completed
- **Tasks:**
  - A: Extended `GET /quotations/{ref}` single-get query with `sd.cargo_ready_date`, `sd.type_details`, `o.cargo`; added enrichment to response after `_serialise_quotation` (list queries unchanged)
  - B: Extended `Quotation` interface with `cargo_ready_date`, `type_details`, `cargo` fields
  - C: Replaced flat scope card with two-column "Shipment Overview" card in `_components.tsx`:
    - Left column: scope flags with mode badges, area names under ASSIGNED haulage legs (fetched from GT orders), TLX release
    - Right column: incoterm, transaction type, shipment type, container summary (FCL/LCL/AIR), DG class badge, route, cargo ready date
  - Added `fetchTransportOrderByTaskAction` import and GT order area fetching in useEffect
  - Added helper functions: `buildContainerSummary`, `formatDateShort`, `SummaryRow` component
- **Files Modified:**
  - `af-server/routers/quotations.py`
  - `af-platform/src/app/actions/quotations.ts`
  - `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx`
- **Notes:** py_compile and ESLint clean. List queries unchanged — only single GET enriched.
