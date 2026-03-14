## Prompt Log — v6.91 to v7.00

### [2026-03-15 15:00 UTC] — v7.01: DGF Management Dialog + Remove DGF Panel from Expanded Panel
- **Status:** Completed
- **Tasks:**
  - Removed DGF section (divider, rows, loading state) from `HaulageExpandedPanel` body
  - Removed DGF state (`dgfFees`, `dgfLoading`, `dgfModalOpen`, `dgfEditFee`), fetch useEffect, and `handleDgfDelete` from `HaulageExpandedPanel`
  - Removed `DepotGateFeeModal` instance from `HaulageExpandedPanel`
  - Replaced `DepotGateFeeModal` in `HaulageRateCardEditModal` with `DgfManageDialog` (state: `dgfManageOpen`)
  - Created `DgfManageDialog` component in `_depot-gate-fee-modal.tsx` — table-based fee list with add/edit/delete, fetches on open, opens `DepotGateFeeModal` for create/edit
  - Updated z-index: `DepotGateFeeModal` → `z-[70]`, `DgfManageDialog` → `z-[60]`
  - Cleaned up imports: removed `fetchDepotGateFeesAction`, `deleteDepotGateFeeAction`, `DepotGateFee` from expanded panel; added `formatDate`, `formatCompact`, `useCallback` to depot-gate-fee-modal
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/haulage/_haulage-expanded-panel.tsx`
  - `af-platform/src/app/(platform)/pricing/haulage/_depot-gate-fee-modal.tsx`
- **Notes:** DGF is now managed exclusively via the rate card edit modal's "Manage DGF" button.

### [2026-03-15 14:00 UTC] — v7.00: DGF Edit Shortcut in Rate Card Edit Modal
- **Status:** Completed
- **Tasks:**
  - Added `Settings2` icon import from lucide-react to `_haulage-expanded-panel.tsx`
  - Added `dgfModalOpen` and `dgfEditFee` state to `HaulageRateCardEditModal` (before early return guard)
  - Replaced DGF checkbox `<label>` with flex row containing checkbox + conditional "Manage DGF" button with Settings2 icon
  - Rendered `DepotGateFeeModal` inside `HaulageRateCardEditModal` via fragment wrapper
  - Updated `_depot-gate-fee-modal.tsx` z-index from `z-50` to `z-[60]` so it layers above the rate card edit modal
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/haulage/_haulage-expanded-panel.tsx`
  - `af-platform/src/app/(platform)/pricing/haulage/_depot-gate-fee-modal.tsx`
- **Notes:** Existing DGF section in expanded panel body unchanged. DGF modal opens/closes independently of rate card edit modal.

### [2026-03-15 13:00 UTC] — v6.99: Haulage Cost Surcharge Breakdown in Card Row + List Price Sparkline Surcharge
- **Status:** Completed
- **Tasks:**
  - Added `HaulageSurchargeTooltip` component to `_haulage-rate-list.tsx` with itemised surcharge breakdown (base value, named items, FAF %, total)
  - Replaced `SurchargeTooltip` usage in card row cells (both list price and cost) with `HaulageSurchargeTooltip` using `cost_surcharge_items`
  - Removed unused `SurchargeTooltip` from haulage rate list (local only, not imported elsewhere)
  - Added `cost_surcharge_items` field to backend time series in both historical and future branches of `haulage.py`
  - Added `cost_surcharge_items` to `HaulageTimeSeries` interface in `pricing.ts`
  - Built `listPriceSurchargesForSparkline` in `_haulage-expanded-panel.tsx` using best supplier's cost surcharges + FAF, passed to list price CostSparkline
- **Files Modified:**
  - `af-server/routers/pricing/haulage.py`
  - `af-platform/src/app/(platform)/pricing/haulage/_haulage-rate-list.tsx`
  - `af-platform/src/app/(platform)/pricing/haulage/_haulage-expanded-panel.tsx`
  - `af-platform/src/app/actions/pricing.ts`
- **Notes:** List price sparkline now shows `*` indicator and surcharge-inclusive totals from best supplier's cost surcharges + FAF.

### [2026-03-15 12:00 UTC] — v6.98: Haulage Time Series — FAF-Inclusive Cost Aggregation
- **Status:** Completed
- **Tasks:**
  - Added `_get_faf_percent` helper function to `haulage.py` (matches FAF by supplier/port/container_size with wildcard fallback, time-aware)
  - Pre-fetched all published FAF rates from `haulage_faf_rates` for suppliers in scope, keyed by supplier_id
  - Updated `seed_supplier_costs` and `active_supplier_costs` entries to include `supplier_id` field
  - Changed `cost_map` tuples from 2-tuple `(cost, surcharges)` to 3-tuple `(cost, surcharges, supplier_id)`
  - Updated historical branch: `cost_sc` = raw surcharges + FAF amount (`round(base_cost * faf_pct, 4)`)
  - Updated future branch: tracks `effective_cost_supplier_id`, applies same FAF computation
  - Added comment on `alerts_only` SQL noting FAF is not included in the approximation filter
- **Files Modified:**
  - `af-server/routers/pricing/haulage.py`
- **Notes:** No frontend changes, no migrations. Card row cost cells will now show FAF-inclusive totals matching sparkline tooltip values.

### [2026-03-15 02:00 UTC] — v6.96: Haulage Rate List — SurchargeTooltip + Surcharge Totals Aligned to FCL
- **Status:** Completed
- **Tasks:**
  - Added `SurchargeTooltip` component to `_haulage-rate-list.tsx` (copied from FCL `_rate-list.tsx`)
  - Updated time series cell render: added `flex items-center justify-center gap-0` to value divs; added conditional `SurchargeTooltip` render after list price and cost values when surcharge total > 0
  - Shows `*` superscript indicator with hover tooltip showing Freight/Surcharges/Total breakdown
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/haulage/_haulage-rate-list.tsx`
- **Notes:** No backend changes. FCL `_rate-list.tsx` not modified.

### [2026-03-15 01:00 UTC] — v6.95: Haulage Expanded Panel — Condensed Supplier Row + FAF Amount + Surcharge Totals
- **Status:** Completed
- **Tasks:**
  - Change 1: Condensed supplier info panel from 5 lines to 3 — merged supplier ID + date range onto one `text-[9px]` line with `·` separator; merged SL + FAF onto one line with computed FAF amount (`FAF +{amount} ({pct}%)`)
  - Change 2: FAF injected as virtual `SurchargeItem` into supplier sparkline's surchargesMap — FAF now appears as named line item in tooltip and is included in current-month label total. Used existing `costMapData` to avoid recomputing `buildMonthMap`. FAF amount rounded to integer via `Math.round`
  - Change 3: Column header numbers in `_haulage-rate-list.tsx` already showed `base + surcharge_total` — no changes needed (already implemented in prior prompt)
- **Files Modified:**
  - `af-platform/src/app/(platform)/pricing/haulage/_haulage-expanded-panel.tsx`
- **Notes:** No backend changes. `_sparkline.tsx` and `_haulage-rate-list.tsx` unchanged.

### [2026-03-15 00:00 UTC] — v6.94: is_tariff_rate Engine Implementation + PKG Data Migration
- **Status:** Completed
- **Tasks:**
  - Part A: Created migration 068 SQL (UPDATE `haulage_rate_cards` SET `is_tariff_rate = TRUE` WHERE `port_un_code = 'MYPKG'`) and runner script with verification queries
  - Part B: Updated `_resolve_haulage` in `quotations.py` — added `is_tariff_rate` to both card lookup SELECTs (exact size + wildcard fallback); unpacked at index [4]; replaced flat cost+rebate block with tariff/non-tariff branch: tariff model applies rebate lookup with `round(..., 6)`, non-tariff model uses supplier cost as-is with no rebate
- **Files Modified:**
  - `af-server/migrations/068_haulage_pkg_tariff_rate.sql` (new)
  - `af-server/scripts/run_migration_068.py` (new)
  - `af-server/routers/quotations.py`
- **Notes:** Migration 068 must be run manually before deploy. No frontend changes. No schema changes (is_tariff_rate column added in migration 064).

### [2026-03-14 20:00 UTC] — v6.93: Air Currency → Card Level
- **Status:** Completed
- **Tasks:**
  - Part A: Created migration 067 SQL (both `air_freight_rate_cards` and `air_list_price_rate_cards`: add nullable → backfill → default MYR → NOT NULL → drop) and runner script
  - Part B: Updated `air.py` — added `currency` to `AirRateCardCreate`/`AirRateCardUpdate` and `AirListPriceCardCreate`/`AirListPriceCardUpdate`; removed `currency` from `AirRateCreate`/`AirRateUpdate` and `AirListPriceRateCreate`/`AirListPriceRateUpdate`; added `currency: r[11]` to `_row_to_rate_card`; removed `currency` from `_RATE_SELECT` and re-indexed `_row_to_rate` (l45_list_price→r[5], l45_cost→r[13], surcharges→r[21], created_at→r[22], updated_at→r[23], effective_to→r[24]); removed `currency` from `_LIST_PRICE_RATE_SELECT` and re-indexed `_row_to_list_price_rate` (l45_list_price→r[4], surcharges→r[12], created_at→r[13], updated_at→r[14], effective_to→r[15]); updated list/detail inline SELECTs to include `rc.currency`; removed `currency` from `lp_latest_rows`, `ts_rows`, `lp_ts_rows`, `seed_lp_rows` queries and their unpacking; `seed_price_map`/`price_ref_map` no longer include `currency`; time series month loop uses `c["currency"]`; card create/update endpoints include currency; rate create/update no longer handle currency; `resolve_air_rate` fetches currency from card via lookup; `list_air_list_price_cards` SELECT includes `currency`
  - Part C: Updated `pricing.ts` — added `currency: string` to `AirRateCard`; removed `currency` from `AirRate` and `AirListPriceRate` interfaces; removed `currency` from `latest_price_ref`
  - Part D: Updated `_air-rate-modal.tsx` — removed `currency`/`setCurrency` state, removed currency from create/edit payloads, removed currency input from JSX
- **Files Modified:**
  - `af-server/migrations/067_air_card_currency.sql` (new)
  - `af-server/scripts/run_migration_067.py` (new)
  - `af-server/routers/pricing/air.py`
  - `af-platform/src/app/(platform)/pricing/air/_air-rate-modal.tsx`
  - `af-platform/src/app/actions/pricing.ts`
- **Notes:** Migration 067 must be run manually before deploy. Completes the currency/UOM integrity series (FCL v6.91 → LCL v6.92 → Air v6.93).

### [2026-03-14 19:15 UTC] — v6.92: LCL Currency + UOM → Card Level
- **Status:** Completed
- **Tasks:**
  - Part A: Created migration 066 SQL (add nullable → backfill → default MYR/W/M → NOT NULL → drop) and runner script
  - Part B: Updated `lcl.py` — added currency/uom to `LCLRateCardCreate`/`LCLRateCardUpdate`, removed from `LCLRateCreate`/`LCLRateUpdate`; updated `_row_to_rate_card` (r[11]=currency, r[12]=uom), `_row_to_rate` (re-indexed: list_price→r[5], cost→r[6], min_quantity→r[7], roundup_qty→r[8], created_at→r[9], updated_at→r[10], effective_to→r[11], surcharges→r[12]); updated `_RATE_CARD_SELECT`/`_RATE_SELECT`; removed currency from latest_price_ref/seed_price_map/price_ref_map/ts_rows; time series reads `c["currency"]`; card create/update include currency+uom; rate create/update no longer handle currency+uom; terminal_name shifted to r[13]; `resolve_lcl_rate` fetches currency+uom from card via separate lookup
  - Part C: Removed currency input entirely from `_rate-modal.tsx` (was hidden for FCL in v6.91, now removed for all modes); removed `currency`/`setCurrency` state
  - Part E: Created `createLCLRateCardAction`/`updateLCLRateCardAction` in pricing.ts with currency+uom fields
- **Files Modified:**
  - `af-server/migrations/066_lcl_card_currency_uom.sql` (new)
  - `af-server/scripts/run_migration_066.py` (new)
  - `af-server/routers/pricing/lcl.py`
  - `af-platform/src/app/(platform)/pricing/_rate-modal.tsx`
  - `af-platform/src/app/actions/pricing.ts`
- **Notes:** Migration 066 must be run manually before deploy. Air follows in v6.93.

### [2026-03-14 18:45 UTC] — v6.91: FCL Currency + UOM → Card Level
- **Status:** Completed
- **Tasks:**
  - Part A: Created migration 065 SQL (add nullable → backfill → default → NOT NULL → drop) and runner script
  - Part B: Updated `fcl.py` — added currency/uom to `FCLRateCardCreate`/`FCLRateCardUpdate`, removed from `FCLRateCreate`/`FCLRateUpdate`; updated `_row_to_rate_card` (r[13]=currency, r[14]=uom), `_row_to_rate` (re-indexed: list_price→r[5], cost→r[6], roundup_qty→r[7], created_at→r[8], updated_at→r[9], effective_to→r[10], surcharges→r[11]); updated `_RATE_CARD_SELECT` and `_RATE_SELECT`; updated all inline SELECTs in list/detail endpoints; removed currency from latest_price_ref, seed_price_map, price_ref_map, ts_rows unpacking; time series currency now reads from `c["currency"]` (card); card create/update endpoints include currency+uom; rate create/update no longer handle currency+uom; terminal_name index shifted to r[15] in both list and detail endpoints
  - Part C: Updated `_rate-modal.tsx` — conditionally hide currency input for FCL (shown only for LCL); removed currency/uom from FCL create/edit payloads; added fallback for optional `initial.currency`
  - Part D: No dedicated FCL card create/edit modal exists in frontend yet — created `createFCLRateCardAction` and `updateFCLRateCardAction` in pricing.ts with currency+uom fields
  - Part E: Updated `RateCard` interface (added currency, uom; removed currency from latest_price_ref); made `RateDetail.currency` and `RateDetail.uom` optional; made `RateCreateData`/`RateUpdateData` currency+uom optional
- **Files Modified:**
  - `af-server/migrations/065_fcl_card_currency_uom.sql` (new)
  - `af-server/scripts/run_migration_065.py` (new)
  - `af-server/routers/pricing/fcl.py`
  - `af-platform/src/app/(platform)/pricing/_rate-modal.tsx`
  - `af-platform/src/app/actions/pricing.ts`
- **Notes:** Migration 065 must be run manually before deploy. LCL and Air follow in v6.92/v6.93.
