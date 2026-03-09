# Prompt Completion Log — v5.71–v5.80

### [2026-03-10 08:00 UTC] — v5.77: Rename Transport Module: transport → port_transport
- **Status:** Completed
- **Tasks:** Rename-only change across entire codebase. (1) Dropped old `transport_rate_cards`/`transport_rates` tables and recreated as `port_transport_rate_cards`/`port_transport_rates` via updated migration 026. (2) Renamed `transport.py` → `port_transport.py` with all Pydantic models prefixed `PortTransport*` and table refs updated. (3) Updated `__init__.py`: import `port_transport`, prefix `/port-transport`, dashboard key `port-transport`. (4) Renamed all types and actions in `pricing.ts` (e.g. `TransportRateCard` → `PortTransportRateCard`, `fetchTransportRateCardsAction` → `fetchPortTransportRateCardsAction`), API paths `/transport/` → `/port-transport/`. (5) Renamed frontend component files: `_transport-*` → `_port-transport-*`, all component/interface names prefixed `PortTransport*`. (6) Updated `page.tsx`, `_components.tsx`, `_dashboard.tsx` (key `port-transport`). (7) Updated migration script table refs.
- **Files Modified:** `af-server/routers/pricing/port_transport.py` (new), `af-server/routers/pricing/transport.py` (deleted), `af-server/routers/pricing/__init__.py`, `af-server/migrations/026_transport_pricing.sql` (already correct), `af-server/scripts/migrate_transport_pricing.py`, `af-platform/src/app/actions/pricing.ts`, `af-platform/src/app/(platform)/pricing/transportation/page.tsx`, `af-platform/src/app/(platform)/pricing/transportation/_port-transport-rate-cards-tab.tsx` (renamed), `af-platform/src/app/(platform)/pricing/transportation/_port-transport-rate-list.tsx` (renamed), `af-platform/src/app/(platform)/pricing/transportation/_port-transport-rate-modal.tsx` (renamed), `af-platform/src/app/(platform)/pricing/_dashboard.tsx`, `af-platform/src/app/(platform)/pricing/_components.tsx`

### [2026-03-10 07:30 UTC] — v5.76: Transport Pricing Module (Phase 1)
- **Status:** Completed
- **Tasks:** Built complete Transport Pricing Module — backend and frontend. (1) Created `026_transport_pricing.sql` migration with `transport_rate_cards` and `transport_rates` tables. (2) Created `af-server/routers/pricing/transport.py` with full CRUD, 12-month time-series, 4-scenario alerts_only, close_previous logic. (3) Registered transport router in `__init__.py` + added transport dashboard summary block. (4) Added all transport types and server actions to `pricing.ts`. (5) Created frontend: `page.tsx`, `_transport-rate-cards-tab.tsx` (filters: country, port, area, vehicle, text, inactive, issues-only), `_transport-rate-list.tsx` (time-series with port→area+vehicle display), `_transport-rate-modal.tsx` (list_price, cost, min_list_price, min_cost, surcharges). (6) Unlocked transportation card in `_dashboard.tsx`. (7) Added TransportRateCardsTab export to `_components.tsx`.
- **Files Modified:** `af-server/migrations/026_transport_pricing.sql`, `af-server/routers/pricing/transport.py`, `af-server/routers/pricing/__init__.py`, `af-platform/src/app/actions/pricing.ts`, `af-platform/src/app/(platform)/pricing/transportation/page.tsx`, `af-platform/src/app/(platform)/pricing/transportation/_transport-rate-cards-tab.tsx`, `af-platform/src/app/(platform)/pricing/transportation/_transport-rate-list.tsx`, `af-platform/src/app/(platform)/pricing/transportation/_transport-rate-modal.tsx`, `af-platform/src/app/(platform)/pricing/_dashboard.tsx`, `af-platform/src/app/(platform)/pricing/_components.tsx`

### [2026-03-10 06:30 UTC] — v5.75: Fix Effective From/To vertical alignment in Rate Modal
- **Status:** Completed
- **Tasks:** Replaced `<label>` wrapper on Effective From with matching `<div>` + inner `<div className="flex items-center justify-between">` structure to match Effective To's DOM depth. Both date inputs now align vertically.
- **Files Modified:** `af-platform/src/app/(platform)/pricing/_rate-modal.tsx`

### [2026-03-10 06:15 UTC] — v5.74: Fix dashboard s4_row to card-level logic (FCL + LCL)
- **Status:** Completed
- **Tasks:** (1) Removed supersession inner NOT EXISTS from `__init__.py` dashboard `s4_row` query — simplified to pure card-level logic matching the original Scenario 4 definition. (2) Also removed supersession from `lcl.py` and `fcl.py` alerts_only Scenario 4 to ensure all three files use identical card-level logic. (3) Re-applied data patches: closed 8 orphan open-ended LCL supplier rows (cards 109, 110) that were reverted in v5.72b. Verified: FCL no_active_cost=0, LCL no_active_cost=2 — dashboard and Issues Only now consistent.
- **Files Modified:** `af-server/routers/pricing/__init__.py`, `af-server/routers/pricing/lcl.py`, `af-server/routers/pricing/fcl.py`
- **Notes:** Supersession logic from v5.72b/v5.73 removed in favor of simpler card-level checks + data patches. The orphan row issue is a data quality problem from migration, not a SQL logic problem.

### [2026-03-10 06:00 UTC] — v5.73: Fix Scenario 4 divergence — FCL alerts_only + dashboard cost IS NOT NULL guard
- **Status:** Completed
- **Tasks:** (A) Applied supersession-aware NOT EXISTS to `fcl.py` Scenario 4 `alerts_only` block — mirrors the `lcl.py` fix from v5.72b. (B) Verified `__init__.py` dashboard `s4_row` already has `AND r.cost IS NOT NULL` from v5.72b — no change needed. Verified: FCL dashboard=1 matches Issues Only=1 (MYPKG:BDCGP:DG-2:20:DRY), LCL dashboard=2 matches Issues Only=2 (AEJEA, AUBNE).
- **Files Modified:** `af-server/routers/pricing/fcl.py`

### [2026-03-10 05:45 UTC] — v5.72b: Fix Scenario 4 — scope NOT EXISTS to most recent supplier row
- **Status:** Completed
- **Tasks:** (1) Reverted v5.72 data patches (8 rows back to `effective_to=NULL`). (2) Applied supersession-aware NOT EXISTS to Scenario 4 in `lcl.py` — inner `NOT EXISTS` excludes supplier rows superseded by a newer row for the same supplier/card. (3) Applied same fix to `__init__.py` dashboard `s4_row` query (covers both FCL and LCL via `{rate_table}` template). (4) Verified: Scenario 4 matches 2 cards (109 AEJEA, 110 AUBNE) and dashboard `no_active_cost=2` — all without data patches.
- **Files Modified:** `af-server/routers/pricing/lcl.py`, `af-server/routers/pricing/__init__.py`

### [2026-03-10 05:30 UTC] — v5.72: Diagnose Scenario 4 not catching AEJEA/AUBNE in Issues Only
- **Status:** Completed
- **Tasks:** (1) Ran diagnostic script — confirmed Hypothesis A: orphan open-ended supplier rows blocking NOT EXISTS. Card 109 (MYPKG_N:AEJEA) had 5 old supplier rows with `effective_to=NULL`, card 110 (MYPKG_N:AUBNE) had 3. Latest supplier rows were expired but old ones still matched as "active". (2) Applied data patches: closed 8 superseded supplier rows by setting `effective_to` to day before next row's `effective_from`. (3) Verified: Scenario 4 matches 2 cards (109, 110). Dashboard `no_active_cost` for LCL = 2.
- **Files Modified:** `af-server/scripts/debug_scenario4.py` (fixed unicode arrow for Windows)
- **Notes:** Root cause is migrated data with overlapping open-ended date ranges. The `close_previous` feature (v5.68) only applies to new rate creation. A broader data cleanup may be needed for all migrated LCL/FCL rows with similar overlaps.

### [2026-03-10 05:15 UTC] — v5.71: Dashboard "needs attention" revert + Scenario 4 data investigation
- **Status:** Completed
- **Tasks:** (A) Reverted dashboard `ActiveCard` badge from summing 4 alert types back to using only `expiring_soon` count — the per-scenario breakdown rows below remain as detail. (B) Data investigation: queried AEJEA LCL card (id=75, MYPKG→AEJEA). Found all rows have `effective_to = NULL` (open-ended) — migrated data was never closed. Both supplier cost (id=27779, cost=5.0) and list price (id=27780, list_price=10.0) rows are PUBLISHED and active. Old cost rows (id=27751, 27781) also open-ended. Scenario 4 correctly excludes this card because active cost exists. The "Cost expired" badge on frontend may stem from time-series carry-forward logic resolving differently than SQL.
- **Files Modified:** `af-platform/src/app/(platform)/pricing/_dashboard.tsx`
- **Notes:** Part B is read-only investigation. Key finding: the card has overlapping open-ended rows from migration — `close_previous` from v5.68 only applies to new rate creation, not migrated data. The consolidation script (v5.64) should have collapsed these but may not have been run against LCL.

### [2026-03-10 05:00 UTC] — v5.70b: Fix alerts_only Scenario 4 + null cost display in rate list cells
- **Status:** Completed
- **Tasks:** (A) Verified Scenario 4 NOT EXISTS date guards in `lcl.py`, `fcl.py`, and `__init__.py` — all three already have correct `effective_from <= CURRENT_DATE AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)` guards from the v5.69 pull. No backend changes needed. (B) Fixed `_rate-list.tsx` time-series cells: replaced `(bucket.list_price ?? 0)` and `(bucket.cost ?? 0)` with null-aware rendering — null values now show `N/A` styled span instead of `0`; wrapped SurchargeTooltip components in `bucket.list_price != null` / `bucket.cost != null` guards so tooltips are suppressed for N/A cells.
- **Files Modified:** `af-platform/src/app/(platform)/pricing/_rate-list.tsx`
