## Prompt Log — v6.11 to v6.20

### [2026-03-12 20:00 UTC] — v6.22: Container & Seal Number Fix (Full Diagnosis)
- **Status:** Completed
- **Tasks:**
  1. Full end-to-end trace of save flow: `TypeDetailsCard.handleSave` → `updateTypeDetailsAction` → `PATCH /type-details` → backend merge + commit.
  2. Confirmed v6.21 fix (`order.order_id` → `order.quotation_id`) is the primary bug — `ShipmentOrder` has no `order_id` field, so the old code passed `undefined`.
  3. Updated console.log in `handleSave` to pretty-print (`JSON.stringify(payload, null, 2)`).
  4. Added diagnostic `console.log` in `updateTypeDetailsAction` (shipments-write.ts) showing URL and payload before fetch.
  5. No other bugs found — backend commit via `get_db()` is correct, payload shape matches, `onSaved` → `loadOrder` flow is correct.
- **Files Modified:** `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`, `af-platform/src/app/actions/shipments-write.ts`
- **Notes:** Console.log statements left in for Calvin to verify in browser. Lint passes clean.

### [2026-03-12 19:30 UTC] — v6.21: Container & Seal Number Fix (TypeDetailsCard)
- **Status:** Completed
- **Tasks:**
  1. Fixed save bug: changed `order.order_id` → `order.quotation_id` in `handleSave` call to `updateTypeDetailsAction`.
  2. Added temporary `console.log` before the action call to confirm payload shape in browser console.
- **Files Modified:** `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`
- **Notes:** Single-line fix. Display logic not touched — verify after deploy. Lint passes clean.

### [2026-03-12 19:00 UTC] — v6.20-A: Air List Price Structural Refactor: Backend
- **Status:** Completed
- **Tasks:**
  1. Added Pydantic models: `AirListPriceCardCreate`, `AirListPriceCardUpdate`, `AirListPriceRateCreate`, `AirListPriceRateUpdate`.
  2. Added `_LIST_PRICE_RATE_SELECT` constant and `_row_to_list_price_rate` helper.
  3. Added 8 new endpoints: GET/POST list-price-cards, PATCH list-price-cards/{id}, GET/POST list-price-cards/{id}/rates, PATCH/DELETE list-price-rates/{id}, POST list-price-rates/{id}/publish.
  4. Modified `list_air_rate_cards`: time series list price source now reads from `air_list_price_rates` via `lp_card_map` (O/D+DG key lookup). `latest_price_ref`, `seed_price_map`, `price_ref_map`, `date_meta` all read from new tables. Cost data unchanged (supplier rows only from `air_freight_rates`).
  5. Modified `get_air_rate_card`: supplier cost rows only in `rates_by_supplier` (skip `None` key). List price fetched separately into `list_price_rates` and `list_price_card_id`. Date metadata split between tables.
  6. Updated `alerts_only` SQL filter to join `air_list_price_rates`/`air_list_price_rate_cards` instead of `supplier_id IS NULL`.
  7. Added `AirListPriceRate` TypeScript interface, `list_price_card_id`/`list_price_rates` to `AirRateCard`. Added 4 server actions: `createAirListPriceRateAction`, `updateAirListPriceRateAction`, `deleteAirListPriceRateAction`, `publishAirListPriceRateAction`.
- **Files Modified:** `af-server/routers/pricing/air.py`, `af-platform/src/app/actions/pricing.ts`
- **Notes:** py_compile and lint pass clean. Frontend components not modified — that comes in v6.20-B.

### [2026-03-12 18:00 UTC] — v6.19: Container & Seal Number Editing
- **Status:** Completed
- **Tasks:**
  1. Backend: Added `PatchTypeDetailsRequest` model and `PATCH /{shipment_id}/type-details` endpoint to `core.py`. Reads JSONB `type_details`, merges FCL `container_numbers`/`seal_numbers` by index or LCL `container_number`/`seal_number`, writes back, updates `orders.updated_at`, logs `TYPE_DETAILS_UPDATED`.
  2. Server Action: Added `UpdateTypeDetailsPayload` interface and `updateTypeDetailsAction` to `shipments-write.ts` following `updateBookingAction` pattern.
  3. Frontend: Extended `TypeDetailsCard` in `_components.tsx` with `isAFU`/`onSaved` props, pencil edit toggle, inline inputs for FCL container/seal numbers per container and LCL container/seal number, save/cancel buttons.
  4. Page wiring: Updated `TypeDetailsCard` render in `page.tsx` to pass `isAFU={accountType === 'AFU'}` and `onSaved={loadOrder}`.
- **Files Modified:** `af-server/routers/shipments/core.py`, `af-platform/src/app/actions/shipments-write.ts`, `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`, `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
- **Notes:** py_compile and lint both pass clean.

### [2026-03-12 17:00 UTC] — v6.18: Air Rate List: Aggregated Cells + Supplier Label + Sparkline Fix
- **Status:** Completed
- **Tasks:**
  1. Part A (Backend): Added `latest_cost_supplier_id` query to `list_air_rate_cards` — DISTINCT ON query finds supplier with lowest p100_cost per card. Added field to `AirRateCard` TypeScript interface.
  2. Part B (Sparkline fix): Changed `_air-expanded-panel.tsx` identity pane from `w-[220px]` to `w-[280px]` and `totalWidth` from `220 +` to `280 +` to match rate list column width.
  3. Part C (Aggregated cells): Extended `ODGroup` with `monthListPrices` map. Group header rows now show lowest list price across airlines per month. Added `months` to useMemo deps.
  4. Part C (Supplier label): Added supplier company name label under cost value in current month cell of airline sub-rows, using `card.latest_cost_supplier_id` and `companiesMap`.
- **Files Modified:** `af-server/routers/pricing/air.py`, `af-platform/src/app/actions/pricing.ts`, `_air-expanded-panel.tsx`, `_air-rate-list.tsx`
- **Notes:** py_compile and lint both pass clean.

### [2026-03-12 16:00 UTC] — v6.17: Air Rate List O/D Grouping + Remove Legacy Inline Delete Buttons
- **Status:** Completed
- **Tasks:**
  1. Part A: Added O/D grouping to `_air-rate-list.tsx`. Cards grouped by origin→destination with collapsible headers (collapsed by default). Group headers show airline count and alert indicator. Sub-rows show airline + DG class identity with time series cells. Added `useMemo` groups derivation, `expandedGroups` state, `toggleGroup` handler, `ODGroup` type. Header label changed to "O/D Group / Airline".
  2. Part B: Removed legacy inline delete buttons (DRAFT branch) from all 3 expanded panels. Simplified DRAFT branch to just Edit button. Removed unused `confirmDeleteId` state and panel-level `handleDelete` from `_expanded-panel.tsx` and `_air-expanded-panel.tsx`. Removed panel-level `handleDelete` from `_haulage-expanded-panel.tsx` (kept `confirmDeleteId` — still used by DGF section). Removed unused `dangerBtnClass` from FCL/LCL and air panels.
- **Files Modified:** `_air-rate-list.tsx`, `_expanded-panel.tsx`, `_air-expanded-panel.tsx`, `_haulage-expanded-panel.tsx`
- **Notes:** Frontend-only. Lint passes clean. `portsMap` prop kept in interface but omitted from destructure since O/D now shows port codes from group key.

### [2026-03-12 15:00 UTC] — v6.16: Delete Button in Edit Modals (FCL/LCL, Air, Haulage)
- **Status:** Completed
- **Tasks:** Added delete functionality to all 3 rate modals (`_rate-modal.tsx`, `_air-rate-modal.tsx`, `_haulage-rate-modal.tsx`). DRAFT rates delete immediately on click; PUBLISHED rates show inline red confirmation block. Added `onDelete`, `isLatestRate` props, `deletePhase`/`deleting` state, `handleDelete` function, and two-phase footer UI. Wired `onDelete` and `isLatestRate` props from all 3 expanded panels with `isLatestRateId` helper.
- **Files Modified:** `_rate-modal.tsx`, `_air-rate-modal.tsx`, `_haulage-rate-modal.tsx`, `_expanded-panel.tsx`, `_air-expanded-panel.tsx`, `_haulage-expanded-panel.tsx`
- **Notes:** Frontend-only. No backend changes. Lint passes clean.

### [2026-03-12 14:00 UTC] — v6.15: Sparkline — All Nodes Clickable via dominantRateMap
- **Status:** Completed
- **Tasks:** Added `dominantRateMap` prop to `CostSparkline`. Added `buildDominantRateMap` helper to `_expanded-panel.tsx`, `_air-expanded-panel.tsx`, and `_haulage-expanded-panel.tsx`. All sparkline nodes now show pointer cursor and open edit modal on click. Plain nodes show "Click to edit" tooltip.
- **Files Modified:** `_sparkline.tsx`, `_expanded-panel.tsx`, `_air-expanded-panel.tsx`, `_haulage-expanded-panel.tsx`
- **Notes:** Frontend-only. tsc --noEmit and lint pass clean.

### [2026-03-12 13:30 UTC] — v6.14: Air Freight UI (Sparkline) + l45→p100 + Sparkline Future-Month Clip
- **Status:** Completed
- **Tasks:**
  1. Fix A: Replaced breakpoint grid in `_air-expanded-panel.tsx` with CostSparkline pattern matching `_expanded-panel.tsx`. Used `p100_list_price`/`p100_cost` as value keys.
  2. Fix B: Swapped `l45_list_price`/`l45_cost` → `p100_list_price`/`p100_cost` in `_air-rate-list.tsx` summary cells and `getAirAlertLevel`. Also added `p100_list_price`/`p100_cost` to backend time series and `AirTimeSeries` type.
  3. Fix C: Removed carry-forward fallback from future-month branch in `buildMonthMap` and `buildSurchargesMap` in `_expanded-panel.tsx` and `_air-expanded-panel.tsx`. Sparkline now stops at current month for open-ended rates, matching backend time_series behaviour.
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
