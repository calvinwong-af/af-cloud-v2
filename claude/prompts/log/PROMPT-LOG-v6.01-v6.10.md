## Prompt Log — v6.01 to v6.10

### [2026-03-12 09:30 UTC] — v6.10: Air Freight Pricing: Backend + UI + Resolve Endpoint
- **Status:** Completed
- **Tasks:** Part A — Created `af-server/routers/pricing/air.py` with ~15 endpoints (origins, airlines, rate-cards CRUD + time series, rates CRUD, publish/reject/delete). Part B — Added resolve endpoint with breakpoint tier selection (_select_tier), min charge logic, surcharge computation. Part C — Added AirRateCard, AirTimeSeries, AirRate, AirResolveResult types + 12 server actions to pricing.ts. Part D — Created 5 new UI files (page.tsx, _air-rate-cards-tab.tsx, _air-rate-list.tsx, _air-expanded-panel.tsx, _air-rate-modal.tsx) with breakpoint grid table replacing sparkline in expanded panel. Unlocked Air Freight in Sidebar.tsx. Registered air router in __init__.py.
- **Files Modified:** `af-server/routers/pricing/air.py` (new), `af-server/routers/pricing/__init__.py`, `af-platform/src/app/actions/pricing.ts`, `af-platform/src/components/shell/Sidebar.tsx`, `af-platform/src/app/(platform)/pricing/air/page.tsx` (new), `_air-rate-cards-tab.tsx` (new), `_air-rate-list.tsx` (new), `_air-expanded-panel.tsx` (new), `_air-rate-modal.tsx` (new)
- **Notes:** Migration 040 SQL and migrate_air_pricing.py must be run manually before testing. tsc --noEmit and lint pass clean. Resolve endpoint supports breakpoint tiers l45/p45/p100/p250/p300/p500/p1000 with min charge floor logic. Time series uses l45 tier as representative single-figure summary.

### [2026-03-12 08:00 UTC] — v6.09: Status String Fix + Drop shipment_workflows.company_id
- **Status:** Completed
- **Tasks:** Part A — Fixed 7 integer status write sites across doc_apply.py (2), bl.py (2), _status_helpers.py (1), tasks.py (2) to use NUMERIC_TO_STRING_STATUS for string conversion. Also fixed 3 read-back comparisons that compared DB string status against integer constants (TypeError in Python 3): _status_helpers.py _check_atd_advancement_pg + tasks.py POL ATD / POD ATA guards — now compare against sub_status strings. Part B — Created migration 043_drop_workflow_company_id.sql. Removed company_id from shipment_workflows INSERT in core.py and bl.py. Updated get_status_history to JOIN orders for company_id auth check.
- **Files Modified:** `af-server/routers/shipments/doc_apply.py`, `af-server/routers/shipments/bl.py`, `af-server/routers/shipments/_status_helpers.py`, `af-server/routers/shipments/tasks.py`, `af-server/routers/shipments/core.py`, `af-server/migrations/043_drop_workflow_company_id.sql` (new)
- **Notes:** Migration 043 must be applied AFTER code deploys (INSERT without company_id will fail against old schema). grep confirms zero remaining `UPDATE orders SET status = :status` patterns and zero `INSERT INTO shipment_workflows.*company_id` patterns. Also fixed 3 status read-back comparisons that would have caused TypeError when comparing string status against integer constants.

### [2026-03-12 07:20 UTC] — v6.08: Shipment Company Assignment Fix
- **Status:** Completed
- **Tasks:** Fix A — customer block always visible in detail header for AFU, amber warning badge when company_id null, modal gate removed so CompanyReassignModal works with empty currentCompanyId. Fix B — CompanyReassignModal handles empty currentCompanyId (no code change needed — empty string never matches a real company_id). Fix C — Next button disabled on CreateShipmentModal step 1 until company selected (disabled:opacity-40 + cursor-not-allowed).
- **Files Modified:** `af-platform/src/app/(platform)/shipments/[id]/page.tsx`, `af-platform/src/components/shipments/CreateShipmentModal.tsx`
- **Notes:** Data fix for AF-003884 to be run manually by Calvin after UI verified. tsc --noEmit passes clean.

### [2026-03-12 07:00 UTC] — v6.07: Fix PortCombobox: Prop-thread ports into SupplierPricingModal
- **Status:** Completed
- **Tasks:** Removed client-side `fetchPorts()` calls from SupplierPricingModal (RebatesTab + FafTab). Fetched ports server-side in companies/page.tsx via `fetchGeoPortsAction()`. Prop-threaded ports through CompanyTable → CompanyActionsMenu → SupplierPricingModal → RebatesTab/FafTab.
- **Files Modified:** `af-platform/src/app/(platform)/companies/page.tsx`, `af-platform/src/components/companies/CompanyTable.tsx`, `af-platform/src/components/companies/CompanyActionsMenu.tsx`, `af-platform/src/components/companies/SupplierPricingModal.tsx`
- **Notes:** tsc --noEmit passes clean. Mirrors existing `userRole` prop-threading pattern.

### [2026-03-12 06:30 UTC] — v6.06: Port Code on Rebates + PortCombobox in Both Forms
- **Status:** Completed
- **Tasks:** Created migration 042_rebates_port_un_code.sql (adds port_un_code to haulage_supplier_rebates with updated unique constraint + index). Updated haulage.py rebate models (SupplierRebateCreate + _row_to_rebate + SELECT/INSERT queries) with port_un_code. Added port_un_code to HaulageSupplierRebate type in pricing.ts. Updated SupplierPricingModal.tsx: added PortCombobox imports + fetchPorts state in both RebatesTab and FafTab, added Port field to rebates form (immutable on edit via pointer-events-none), added Port column to rebates table, replaced plain text input with PortCombobox in FAF port rates builder.
- **Files Modified:** `af-server/migrations/042_rebates_port_un_code.sql` (new), `af-server/routers/pricing/haulage.py`, `af-platform/src/app/actions/pricing.ts`, `af-platform/src/components/companies/SupplierPricingModal.tsx`
- **Notes:** Migration 042 must be run against Cloud SQL before updated rebate endpoints will work. tsc --noEmit passes clean.

### [2026-03-11 21:00 UTC] — v6.05: Haulage Supplier Pricing: Rebates + FAF (Backend + Frontend)
- **Status:** Completed
- **Tasks:** Created migration 041_haulage_faf_rates.sql. Added 8 endpoints to haulage.py (supplier-rebates CRUD + faf-rates CRUD). Added HaulageSupplierRebate, FafPortRate, HaulageFafRate types + 8 server actions to pricing.ts. Updated companies page to pass userRole to CompanyTable. Added userRole prop to CompanyTable → CompanyRow → CompanyActionsMenu. Added "Supplier Pricing" menu item (AFU-ADMIN only) with Tags icon. Created SupplierPricingModal.tsx with Rebates + FAF tabs, inline add/edit forms, expandable FAF rows, delete confirmations.
- **Files Modified:** `af-server/migrations/041_haulage_faf_rates.sql` (new), `af-server/routers/pricing/haulage.py`, `af-platform/src/app/actions/pricing.ts`, `af-platform/src/app/(platform)/companies/page.tsx`, `af-platform/src/components/companies/CompanyTable.tsx`, `af-platform/src/components/companies/CompanyActionsMenu.tsx`, `af-platform/src/components/companies/SupplierPricingModal.tsx` (new)
- **Notes:** Backend auth is require_afu (not admin-gated) — admin enforcement is frontend-only per spec. Rebate/FAF percentages stored as decimals, displayed as percentages. port_rates JSONB validated for at least one entry on save.

### [2026-03-11 20:30 UTC] — v6.04: Depot Gate Fee (DGF) Backend + UI
- **Status:** Completed
- **Tasks:** Added 5 DGF endpoints to haulage.py (list, active resolution, create, update, delete). Added DepotGateFee type + 5 server actions to pricing.ts. Updated _haulage-expanded-panel.tsx with DGF sub-panel (list rows, add/edit/delete, loading state). Created _depot-gate-fee-modal.tsx.
- **Files Modified:** `af-server/routers/pricing/haulage.py`, `af-platform/src/app/actions/pricing.ts`, `af-platform/src/app/(platform)/pricing/haulage/_haulage-expanded-panel.tsx` (rewrite), `af-platform/src/app/(platform)/pricing/haulage/_depot-gate-fee-modal.tsx` (new)
- **Notes:** DGF has no supplier dimension — fee_amount is both cost and price. Fetch triggered on expand when include_depot_gate_fee=true. Terminal-specific resolution logic lives in backend; UI fetches by port+terminal and shows all rows for that scope.

### [2026-03-11 19:50 UTC] — v6.03: Haulage Pricing Frontend
- **Status:** Completed
- **Tasks:** Created 5 haulage UI files — page.tsx, _haulage-rate-cards-tab.tsx, _haulage-rate-list.tsx, _haulage-expanded-panel.tsx, _haulage-rate-modal.tsx. All modelled on port transport equivalents. Key differences: container_size instead of vehicle_type, SL/+DGF badges, side_loader_surcharge field in modal, containerSizeLabel helper.
- **Files Modified:** `af-platform/src/app/(platform)/pricing/haulage/page.tsx` (new), `_haulage-rate-cards-tab.tsx` (new), `_haulage-rate-list.tsx` (new), `_haulage-expanded-panel.tsx` (new), `_haulage-rate-modal.tsx` (new)
- **Notes:** No depot gate fee UI — deferred to later prompt. side_loader_surcharge shown in expanded panel supplier rows and editable in modal.

### [2026-03-11 19:10 UTC] — v6.02: Haulage Pricing Backend
- **Status:** Completed
- **Tasks:** Created haulage.py FastAPI router (ports, areas, container-sizes, rate-cards CRUD + time series, rates CRUD). Registered router under /haulage prefix. Added HaulageRateCard, HaulageTimeSeries, HaulageRate, ContainerSize types + 13 server actions to pricing.ts. Unlocked Haulage + Transportation in Sidebar.tsx.
- **Files Modified:** `af-server/routers/pricing/haulage.py` (new), `af-server/routers/pricing/__init__.py`, `af-platform/src/app/actions/pricing.ts`, `af-platform/src/components/shell/Sidebar.tsx`
- **Notes:** side_loader_surcharge included in rate rows but excluded from time series computation. Depot gate fee endpoints deferred to later prompt. Rate card key uses area_code (not area_id) via areas table lookup.

### [2026-03-11 18:40 UTC] — v6.01: Air Freight Pricing Migration Script
- **Status:** Completed
- **Tasks:** Created `af-server/scripts/migrate_air_pricing.py` — migrates PricingAir → air_freight_rate_cards and PTMonthlyRateOceanAir (PT-AIR) → air_freight_rates. Uses psycopg2 direct connection (not SQLAlchemy). Filters: 2024+ only, trash skipped, CTR uom excluded (34 rows). Breakpoint tiers: l45/p45/p100/p250/p300/p500/p1000 + min. Surcharges JSONB: fsc/msc/ssc. Date range closing logic for effective_from/effective_to. Supplier ID validation against companies table (no remap needed).
- **Files Modified:** `af-server/scripts/migrate_air_pricing.py` (new)
- **Notes:** Script created — not yet executed. Run dry-run first. Migration 040 SQL already exists.
