## Prompt Log — v6.01 to v6.10

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
