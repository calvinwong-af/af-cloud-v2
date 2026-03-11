## Prompt Log — v5.81 to v5.90

### [2026-03-10 15:30 UTC] — v5.81: Migration 029 — Restructure areas table
- **Status:** Partial
- **Tasks:** (A) Created migration 029 — pre-checks for NULL/orphan state_code, drop composite unique constraint, drop port_un_code + city_id columns, enforce state_code NOT NULL, add single-column unique (area_code), add named FK to states. (B) Updated geography router — removed port_un_code filter from list_areas, removed city_id/city_name from all area SELECT/response shapes, removed port_un_code and city_id from AreaCreate/AreaUpdate models, made state_code required on AreaCreate, removed port/city from create INSERT and update field list.
- **Files Modified:** `af-server/migrations/029_restructure_areas.sql` (new), `af-server/routers/geography.py`
- **Notes:** Migration aborts as designed — 71 of 508 area rows have NULL state_code (pre-check Step 1). These are international areas seeded without state assignment. Data fix needed before migration can be applied. Router compiles cleanly.

### [2026-03-10 16:00 UTC] — v5.82: Migration 029 — Seed international states
- **Status:** Completed
- **Tasks:** Created `029_seed_international_states.sql` — 21 INSERT blocks seeding 200 states across 25+ countries. Coverage: CN (29 provinces), JP (9), KR (13), IN (17), ID (7), TH (6), VN (7), BD (5), AU (8), NZ (4), city-states (BN, HK, KH, MN, MO, SG), AE (7), SA (3), TN (2), DE (16), GB (4), FR (13), IT (18), ES (17), BE/CH/NL/PL/PT/SI, US (20). All use ON CONFLICT DO NOTHING.
- **Files Modified:** `af-server/migrations/029_seed_international_states.sql` (new)
- **Notes:** Applied against prod — states grew from 49 to 249. 0 orphan country_codes. 5 NULL-area prefixes still missing states: CA, LK, NO, SE (not in prompt scope), UK (incorrect ISO, should be GB — fixed in migration 030 backfill).

### [2026-03-10 17:15 UTC] — v5.83: Migration 030 — Backfill state_code on NULL international area rows + NZ-LYT cleanup
- **Status:** Completed
- **Tasks:** Created `030_backfill_area_state_codes.sql` — Step 0: seed TW-00 state. Step 1: delete duplicate NZ-LYT. Step 2: fix UK-* → GB-ENG. Step 3: fix CN-ZH-* → CN-ZJ. Step 4: bulk backfill all remaining NULL area rows (Middle East, Asia Pacific, Europe, Americas — 60+ UPDATE statements). Step 5: verification block raises exception if any NULL state_code remains.
- **Files Modified:** `af-server/migrations/030_backfill_area_state_codes.sql` (new)
- **Notes:** File written only — not applied. Calvin to review before running. All UPDATEs guarded by `AND state_code IS NULL` for re-run safety. Prerequisite: migration 029 must be applied first.

### [2026-03-10 17:30 UTC] — v5.84: Migration 032 — Retire cities table
- **Status:** Completed
- **Tasks:** (A) Created `032_retire_cities.sql` — drops city_id from order_stops, drops cities table with CASCADE, verification block. (B) Removed all cities code from `geography.py` — cache vars, invalidation function, 6 endpoints (list/get/create/update + models). (C) Removed all city_id references from `ground_transport.py` — StopCreate, StopUpdate, _stop_row_to_dict, two INSERT statements, update_stop field_col_map.
- **Files Modified:** `af-server/migrations/032_retire_cities.sql` (new), `af-server/routers/geography.py`, `af-server/routers/ground_transport.py`
- **Notes:** Both routers import cleanly. No remaining references to cities/city_id in either file.

### [2026-03-10 — Session 89] — v5.89: Port Transport — Terminal Name Display
- **Status:** Completed
- **Tasks:** (A) Backend: LEFT JOIN port_terminals in list + detail queries, expose terminal_name in response. (B) TypeScript: add terminal_id + terminal_name to PortTransportRateCard interface. (C) Frontend: render indigo terminal badge in identity column when terminal_name is non-null.
- **Files Modified:** `af-server/routers/pricing/port_transport.py`, `af-platform/src/app/actions/pricing.ts`, `af-platform/src/app/(platform)/pricing/transportation/_port-transport-rate-list.tsx`
- **Notes:** Cards without a terminal are unaffected. Follows existing RateCard (FCL/LCL) terminal_name pattern exactly.

### [2026-03-10 — Session 90] — v5.90: TD-02 — Drop Deprecated Flat Surcharge Columns
- **Status:** Completed
- **Tasks:** (A) Created `034_drop_flat_surcharges.sql` — ALTER TABLE DROP COLUMN IF EXISTS for lss/baf/ecrs/psc on fcl_rates and lcl_rates, with verification block. (B) Cleaned `fcl.py` — removed lss/baf/ecrs/psc from `_RATE_SELECT`, updated `_row_to_rate()` indices (10→13), updated seed query in `get_fcl_rate_card`. (C) Cleaned `lcl.py` — same changes with min_quantity preserved at r[9], indices shifted (11→14).
- **Files Modified:** `af-server/migrations/034_drop_flat_surcharges.sql` (new), `af-server/routers/pricing/fcl.py`, `af-server/routers/pricing/lcl.py`
- **Notes:** No remaining references to lss/baf/ecrs/psc in either router. Server compiles cleanly. Migration NOT applied — Calvin to run manually.
