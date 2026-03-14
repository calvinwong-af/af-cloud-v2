## Prompt Log — v6.81 to v6.90

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
