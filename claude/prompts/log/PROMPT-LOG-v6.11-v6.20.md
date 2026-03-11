## Prompt Log — v6.11 to v6.20

### [2026-03-12 13:00 UTC] — v6.14: Air Freight UI (Sparkline) + l45→p100 + Sparkline Clip Fix
- **Status:** Completed
- **Tasks:**
  1. Fix A: Replaced breakpoint grid in `_air-expanded-panel.tsx` with CostSparkline pattern matching `_expanded-panel.tsx`. Used `p100_list_price`/`p100_cost` as value keys.
  2. Fix B: Swapped `l45_list_price`/`l45_cost` → `p100_list_price`/`p100_cost` in `_air-rate-list.tsx` summary cells and `getAirAlertLevel`. Also added `p100_list_price`/`p100_cost` to backend time series and `AirTimeSeries` type.
  3. Fix C: Fixed sparkline carry-forward in `_expanded-panel.tsx` — `getDominantRate` now compares `effective_to` at month-key level, stopping the line at the correct month boundary.
- **Files Modified:** `_air-expanded-panel.tsx`, `_air-rate-list.tsx`, `_expanded-panel.tsx`, `af-server/routers/pricing/air.py`, `af-platform/src/app/actions/pricing.ts`
- **Notes:** Backend also updated to include p100 fields in time series (required for Fix B). py_compile, tsc --noEmit, and lint all pass clean.

### [2026-03-12 12:00 UTC] — v6.13: Air + Haulage Duplicate Rate Cleanup + effective_to Fix
- **Status:** Completed
- **Tasks:**
  1. Created `cleanup_duplicate_rates.py` — deleted redundant rate rows where a newer row with identical values superseded the older one. Deleted 5,645 air rows (6,156 → 511) and 22,272 haulage rows (25,984 → 3,712).
  2. Diagnosed follow-up issue: migration had stamped `effective_to` on oldest rows in each group, creating gaps in carry-forward after duplicates were removed.
  3. Created `fix_effective_to.py` — cleared `effective_to` on 265 air rows and 1,856 haulage rows where a newer row exists in the same group. Carry-forward now works correctly across full timeline.
- **Files Created:** `af-server/scripts/cleanup_duplicate_rates.py`, `af-server/scripts/fix_effective_to.py`, `af-server/scripts/check_date_range.py`
- **Notes:** Both scripts ran with DRY_RUN first, confirmed counts, then executed. Data verified working in UI for both air freight and haulage. Air freight default country also set to MY (direct edit to air/page.tsx).

### [2026-03-12 10:30 UTC] — v6.12: LCL Resolve Endpoint
- **Status:** Completed
- **Tasks:** Added `LCLResolveRequest` Pydantic model and `resolve_lcl_rate` endpoint to lcl.py. Added `LCLResolveResult` TypeScript type and `resolveLCLRateAction` server action to pricing.ts.
- **Files Modified:** `af-server/routers/pricing/lcl.py`, `af-platform/src/app/actions/pricing.ts`
- **Notes:** Backend resolves quantity with roundup_qty and min_quantity logic. No frontend UI — resolve UI deferred. py_compile and tsc --noEmit pass clean.

### [2026-03-12 10:00 UTC] — v6.11: FCL + Haulage Inline Surcharge Totals
- **Status:** Completed
- **Tasks:** Added `total_list_price` and `total_cost` computed fields (rounded to 4dp) to time series entries in both `is_future` and `not is_future` branches of fcl.py and haulage.py. Extended `latest_price_ref` DISTINCT ON queries to also select `surcharges`, then added `list_surcharge_total` and `total_list_price` to the price_map dict. No existing fields removed or renamed.
- **Files Modified:** `af-server/routers/pricing/fcl.py`, `af-server/routers/pricing/haulage.py`
- **Notes:** Backend-only change — no frontend modifications. Computed totals use `round(..., 4)` matching NUMERIC(12,4) column precision. py_compile and tsc --noEmit pass clean.
