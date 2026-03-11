## Prompt Log — v5.91 to v6.00

### [2026-03-11 18:20 UTC] — v6.00: Haulage Pricing Data Migration Script
- **Status:** Completed
- **Tasks:** Created `af-server/scripts/migrate_haulage_pricing.py` — migrates PricingHaulage → haulage_rate_cards and PTMonthlyRateHaulageTransport (PT-HAULAGE) → haulage_rates. Filters: 2024+ only, trash skipped, MYPKG limited to Singa Gemini (AFC-0023 → AFS-0023). side_loader_available inferred from rate row data. FAF skipped with per-port logging for future migration 040. Supplier ID validation against companies table with explicit remap table.
- **Files Modified:** `af-server/scripts/migrate_haulage_pricing.py` (new)
- **Notes:** Script created — not yet executed. Run dry-run first to verify supplier remap table is complete before live execution.

### [2026-03-11 18:00 UTC] — v5.99: Hard FK Retrofit on Rate Tables
- **Status:** Completed
- **Tasks:** Created `039_supplier_fk_retrofit.sql` — adds named FK constraints (REFERENCES companies(id) ON DELETE RESTRICT) to supplier_id on fcl_rates, lcl_rates, port_transport_rates, and haulage_rates. Pure DDL, no data changes. Pre-flight diagnostic confirmed zero orphans across all tables.
- **Files Modified:** `af-server/migrations/039_supplier_fk_retrofit.sql` (new)
- **Notes:** Migration not applied — Calvin applies manually.

### [2026-03-11 17:50 UTC] — v5.98: Haulage Supplier Rebates Schema Migration
- **Status:** Completed
- **Tasks:** Created `038_haulage_supplier_rebates.sql` — single table for percentage-based supplier rebate agreements. Hard FK to `companies(id)`, 6-value container_size CHECK (includes side_loader variants), perpetual effective_from model, NUMERIC(5,4) rebate_percent. Two indexes + inline resolution comments.
- **Files Modified:** `af-server/migrations/038_haulage_supplier_rebates.sql` (new)
- **Notes:** Schema-only — no router or frontend. Migration not applied.

### [2026-03-11 17:30 UTC] — v5.97: Haulage Pricing Schema Migration
- **Status:** Completed
- **Tasks:** Created `037_haulage_pricing.sql` with three tables: `haulage_rate_cards` (route × container size dimension), `haulage_rates` (time-series pricing with surcharges JSONB, side_loader_surcharge column), `port_depot_gate_fees` (port-level depot gate fees with terminal override). All indexes, named constraints, and inline resolution comments included.
- **Files Modified:** `af-server/migrations/037_haulage_pricing.sql` (new)
- **Notes:** Schema-only — no router or frontend changes. Migration not applied. Follows perpetual effective_from model consistent with existing pricing tables.

### [2026-03-11 17:10 UTC] — v5.96: Create Transport Modal — Collapse to Single Step
- **Status:** Completed
- **Tasks:** Collapsed the 2-step task-card flow into a single scrollable page — no pagination, no step counter, no Next button. All cargo + address fields rendered in one form with "Create Order" at the bottom. Standalone 3-step flow remains completely unchanged. Footer simplified to Cancel + Create Order for the single-page flow.
- **Files Modified:** `af-platform/src/components/ground-transport/CreateGroundTransportModal.tsx`
- **Notes:** Pure layout refactor — no logic changes. `step` state unused in single-page flow. Lint passes cleanly.

### [2026-03-11 16:45 UTC] — v5.95: Create Transport Modal UX Improvements
- **Status:** Completed
- **Tasks:** (A) Added new props to `CreateGroundTransportModal` — `prefillContainerNumbers`, `prefillWeightKg`, `prefillVolumeCbm`, `prefillPortUnCode`, `prefillPortName`; made `vehicleTypes` optional. (B) Skip Step 1 when `prefillTaskRef` set — starts at step 2, header shows "Step N of 2". (C) Cargo fields pre-populated from shipment type_details. (D) Vehicle type selector shown for all transport types (not just general); detention mode moved to Step 2 for prefilled flow. (E) Port stop read-only display in Step 3 — first_mile locks destination as POL, last_mile locks origin as POD; port stop included in payload. (F) Internal vehicle type fetching via `useEffect` when prop not provided. (G) Threaded prefill data from `page.tsx` → `ShipmentTasks` → `TaskCard` → modal — ports, container numbers, weight, volume.
- **Files Modified:** `af-platform/src/components/ground-transport/CreateGroundTransportModal.tsx`, `af-platform/src/components/shipments/ShipmentTasks.tsx`, `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
- **Notes:** No server changes needed. Standalone creation flow (no prefillTaskRef) remains unchanged at 3 steps. Lint passes cleanly.

### [2026-03-11] — v5.94: Shipment Task Card Transport Integration
- **Status:** Completed
- **Tasks:** (A) Created `TransportOrderBadge.tsx` — compact inline badge showing order ID, transport type, status, leg count, and route summary. (B) Modified `TaskCard` in `ShipmentTasks.tsx` — added transport order state/fetch for `ORIGIN_HAULAGE`/`DESTINATION_HAULAGE` tasks with `ASSIGNED` mode; renders badge when order exists, "Arrange Transport" button when not; inline `CreateGroundTransportModal` with prefilled context. (C) Updated `CreateGroundTransportModal` — added `prefillTaskRef`, `prefillTransportType` props; made `cities`/`areas` optional with `[]` defaults; `task_ref` sent in payload. (D) Threaded `onTransportOrderCreated` through `ShipmentTasksProps` → `TaskCard`. (E) Updated shipment detail page to pass `onTransportOrderCreated={() => loadOrder()}`.
- **Files Modified:** `af-platform/src/components/ground-transport/TransportOrderBadge.tsx` (new), `af-platform/src/components/shipments/ShipmentTasks.tsx`, `af-platform/src/components/ground-transport/CreateGroundTransportModal.tsx`, `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
- **Notes:** No server changes needed — backend was already complete from v5.93. Lint passes cleanly.

### [2026-03-11] — v5.93: Ground Transport Schema Migration
- **Status:** Completed
- **Tasks:** (A) Created `036_ground_transport_schema.sql` — adds `transport_type`, backfills from `transport_mode`, adds `parent_shipment_id`+`task_ref`, drops old columns. (B) Updated `ground_transport.py`: renamed model fields, `_ORDER_SELECT`, `_order_row_to_dict`, `_SCOPE_TO_TRANSPORT_MODE` values, INSERT in create endpoint, rewrote list endpoint with clean filters, added `GET /by-task` endpoint, updated reconcile endpoint. (C) Updated `ground-transport.ts`: `GroundTransportOrder`/`GroundTransportCreatePayload` interfaces, list action filters, added `fetchTransportOrderByTaskAction`. (D) Updated all frontend files: detail page, `_components.tsx`, `CreateGroundTransportModal`, deliveries page (filters/stats/table), orders page (icon logic, parent link), `OrderListItem` interface, shipments `_components.tsx` badge.
- **Files Modified:** `af-server/migrations/036_ground_transport_schema.sql` (new), `af-server/routers/ground_transport.py`, `af-platform/src/app/actions/ground-transport.ts`, `af-platform/src/app/actions/orders.ts`, `af-platform/src/app/(platform)/ground-transport/[id]/page.tsx`, `af-platform/src/app/(platform)/ground-transport/[id]/_components.tsx`, `af-platform/src/components/ground-transport/CreateGroundTransportModal.tsx`, `af-platform/src/app/(platform)/orders/deliveries/page.tsx`, `af-platform/src/app/(platform)/orders/page.tsx`, `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`
- **Notes:** Migration 036 not applied — Calvin will apply manually. No remaining references to `transport_mode` or `parent_order_id` columns in ground transport code. Server compiles, lint passes.

### [2026-03-10] — v5.92: Geo-matching — Nearest Area Auto-Suggestion
- **Status:** Completed
- **Tasks:** (A) Created `035_areas_lat_lng.sql` — adds lat/lng NUMERIC columns + partial index. (B) Created `scripts/geocode_areas.py` — batch geocode script with --dry-run/--limit flags. (C) Added `GET /areas/nearest` endpoint to `ground_transport.py` — Haversine SQL, returns nearest areas with distance_km. (D) Added `NearestAreaResult` type + `fetchNearestAreasAction` to ground-transport.ts. (E) Updated `AddressInput.tsx` — calls nearest-area after address resolve, shows suggestion banner with Use/Dismiss buttons, 50 km threshold, clears on address clear.
- **Files Modified:** `af-server/migrations/035_areas_lat_lng.sql` (new), `af-server/scripts/geocode_areas.py` (new), `af-server/routers/ground_transport.py`, `af-platform/src/app/actions/ground-transport.ts`, `af-platform/src/components/ground-transport/AddressInput.tsx`
- **Notes:** Migration 035 must be applied + geocode script run before endpoint returns results. Server compiles cleanly, lint passes.

### [2026-03-10] — v5.91: Stop Edit UI + Area Name Display
- **Status:** Completed
- **Tasks:** (A) Backend: updated `_get_stops()` with explicit LEFT JOIN areas for area_name, added `area_name` to `_stop_row_to_dict()`. `update_stop` endpoint already existed. (B) TypeScript: replaced `city_id` with `area_name` on `OrderStop` interface, added `updateStopAction`. (C) Frontend: added `EditStopModal` component reusing `AddressInput`, updated `LegsCard` with pencil edit button on stops and indigo area_name badge, wired `editingStop` state in page.tsx.
- **Files Modified:** `af-server/routers/ground_transport.py`, `af-platform/src/app/actions/ground-transport.ts`, `af-platform/src/app/(platform)/ground-transport/[id]/_components.tsx`, `af-platform/src/app/(platform)/ground-transport/[id]/page.tsx`
- **Notes:** Server compiles cleanly, lint passes. `AddressValue` still has `city_id` (from AddressInput component) — EditStopModal passes null for backward compat.
