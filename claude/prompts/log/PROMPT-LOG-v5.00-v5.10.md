# Prompt Completion Log — v5.00–v5.10

### [2026-03-07 UTC] — v5.07: Order Scope + Task Mode Redesign
- **Status:** Completed
- **Tasks:**
  - Added `derive_scope_from_incoterm()`, `apply_scope_to_tasks()`, `get_eligible_scope_keys()`, `TASK_TYPE_TO_SCOPE_KEY` to `incoterm_tasks.py`; updated `generate_tasks()` to accept optional `scope` param
  - Created `routers/shipments/scope.py` with GET/PATCH `/api/v2/shipments/{id}/scope` endpoints (AFU only for PATCH)
  - Registered scope router in `routers/shipments/__init__.py`
  - Updated `_lazy_init_tasks_pg` in `core.py` to derive/apply scope on first task generation
  - Created `scripts/backfill_scope_from_tasks.py` — idempotent backfill with `--dry-run` flag
  - Created `ScopeConfigDialog.tsx` — 3-way toggle per eligible scope leg (Assigned/Tracked/Not in Scope)
  - Updated `ScopeFlags` type to string modes, added `fetchShipmentScopeAction`, updated `updateShipmentScopeAction` URL
  - Added "Configure Scope" button (AFU only) in Tasks tab of shipment detail page
  - Removed `ScopeFlagsCard` and `GroundTransportReconcileCard` from Overview tab rendering
  - Updated `_components.tsx` scope components to new schema keys
- **Files Modified:**
  - `af-server/logic/incoterm_tasks.py`
  - `af-server/routers/shipments/scope.py` (new)
  - `af-server/routers/shipments/__init__.py`
  - `af-server/routers/shipments/core.py`
  - `af-server/scripts/backfill_scope_from_tasks.py` (new)
  - `af-platform/src/components/shipments/ScopeConfigDialog.tsx` (new)
  - `af-platform/src/app/actions/ground-transport.ts`
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`
- **Notes:** Build passes. Backfill script must be run manually after deployment.

---

### [2026-03-06 UTC] — v5.06: Status Consistency Sweep (Backend + Frontend)
- **Status:** Completed
- **Tasks:**
  - Fixed `status_label` lookups in `core.py` search endpoint — replaced `STATUS_LABELS.get()` (numeric-keyed) with `get_status_display()` (string-aware); added `o.sub_status` to ID-only search SELECT
  - Fixed `status_label` in `db_queries.py` `search_shipments` — uses `get_status_display()`
  - Added numeric status conversion in `db_queries.py` `list_shipments` and `get_shipment_by_id` at API boundary — DB stores strings, API returns numeric codes for frontend compat
  - Added `normalizeStatusToNumeric()` utility to `types.ts` — shared helper for defensive frontend normalization
  - Fixed `StatusCard` and `PartiesCard` in `_components.tsx` — normalize status before stepper/edit-guard logic
  - Removed numeric code display `({s.status})` from sub-step dialog radio options
  - Fixed `StatusIcon` and `StatusBadge` in `ShipmentOrderTable.tsx` — normalize status before icon/label lookup
  - Fixed search summary badges in `orders/shipments/page.tsx` — normalize status in filter callbacks
- **Files Modified:**
  - `af-server/routers/shipments/core.py`
  - `af-server/core/db_queries.py`
  - `af-platform/src/lib/types.ts`
  - `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`
  - `af-platform/src/components/shipments/ShipmentOrderTable.tsx`
  - `af-platform/src/app/(platform)/orders/shipments/page.tsx`
- **Notes:** Build passes cleanly. TypeScript `as Record<string, unknown>` casts required `as unknown as` double-cast due to strict type overlap check.

---

### [2026-03-06 UTC] — v5.05: "Create as Confirmed" Option on New Shipment Modal
- **Status:** Completed
- **Tasks:**
  - Added `createAsConfirmed`/`onCreateAsConfirmedChange` props to StepReview, with reactive green/blue status banner
  - Reordered AFU checkboxes: "Create as Confirmed" first, "Test order" second
  - Added `createAsConfirmed` state in CreateShipmentModal, passed to StepReview and payload as `initial_status`
  - Added `initial_status?: string` to `CreateShipmentOrderPayload` in shipments-write.ts, passed in fetch body
  - Added `initial_status` field to `CreateManualShipmentRequest` in core.py with validated status assignment (`draft`/`confirmed`)
  - Updated INSERT to write `sub_status` column; updated workflow history to use string status label
- **Files Modified:**
  - `af-platform/src/components/shipments/_create-shipment/StepReview.tsx`
  - `af-platform/src/components/shipments/CreateShipmentModal.tsx`
  - `af-platform/src/app/actions/shipments-write.ts`
  - `af-server/routers/shipments/core.py`
- **Notes:** BL upload path unchanged (still uses numeric initial_status). Build passes cleanly.

---

### [2026-03-06 UTC] — v5.04: Fix Numeric/String Status Mismatch in status.py
- **Status:** Completed
- **Tasks:**
  - Added `STRING_STATUS_TO_NUMERIC` and `SUB_STATUS_TO_NUMERIC` reverse mappings to `constants.py`
  - Added `_normalize_status_to_numeric()` helper in `status.py` — handles int, numeric string, and string label status values
  - Updated `update_shipment_status` SELECT to fetch `o.sub_status`, normalize `current_status` to numeric for validation, write string `status`/`sub_status` to orders table via `NUMERIC_TO_STRING_STATUS`
  - Updated `update_completed_flag` SELECT to fetch `o.sub_status`, normalize `current_status` to numeric
  - Status history entries still record numeric codes for backwards compatibility
  - Created `scripts/backfill_numeric_status.py` — one-time script to fix orders with numeric string status values
- **Files Modified:**
  - `af-server/core/constants.py`
  - `af-server/routers/shipments/status.py`
  - `af-server/scripts/backfill_numeric_status.py` (new)
- **Notes:** Frontend unchanged — still sends numeric status codes. Backfill script must be run manually after deployment. History format preserved.

---

### [2026-03-06 UTC] — v5.03: Fix Build Errors in orders/page.tsx
- **Status:** Completed
- **Tasks:**
  - Fixed `LinkIcon` title prop type error — wrapped in `<span title="...">` since Lucide icons don't accept `title` directly
  - Full audit of all imports and const declarations — all are in use, no orphans found
- **Files Modified:**
  - `af-platform/src/app/(platform)/orders/page.tsx`
- **Notes:** Build passes cleanly. Only pre-existing warning is `@next/next/no-img-element` in CompanyTable.tsx (out of scope).

---

### [2026-03-06 14:30 UTC] — v5.02: Orders Page + DG/TEST Badge Fixes
- **Status:** Completed
- **Tasks:**
  - A/B: Verified pre-existing edits — `is_test` in db_queries.py list_shipments, `ShipmentListItem`, `toShipmentOrder()` spread, TEST badge in ShipmentOrderTable.tsx — all present
  - C1: Created `af-server/routers/orders.py` — `GET /api/v2/orders` with tab filtering (all/active/closed/cancelled), pagination, AFC company scoping; `GET /api/v2/orders/stats` for tab badge counts. Registered in main.py
  - C2: Created `af-platform/src/app/actions/orders.ts` — `listOrdersAction` + `fetchOrderStatsAction`
  - C3: Created `af-platform/src/app/(platform)/orders/page.tsx` — unified orders list with All/Active/Closed/Cancelled tabs, count badges (All/Active/Cancelled only), type icons (Plane/Container/Package/Ship/Truck), TEST badge, parent link icon, Load More pagination, KPI cards
  - C4: Updated Sidebar — added Orders nav item (LayoutList icon) to OPERATIONS section above Shipments
- **Files Modified:**
  - `af-server/routers/orders.py` (new)
  - `af-server/main.py`
  - `af-platform/src/app/actions/orders.ts` (new)
  - `af-platform/src/app/(platform)/orders/page.tsx` (new)
  - `af-platform/src/components/shell/Sidebar.tsx`
- **Notes:** No DB migration needed. Stats endpoint inlined in orders.py (not in db_queries.py — self-contained). Existing /shipments and /ground-transport routes preserved.

---


### [2026-03-06 Session 35] — v5.01: GT Delete Controls + is_test Flag
- **Status:** Completed
- **Tasks:**
  - A1: Created migration `012_orders_is_test.sql` (ALTER TABLE orders ADD COLUMN is_test)
  - A2: Updated `ground_transport.py` — added `trash = FALSE` filter to list query, added `is_test`/`trash` to `_ORDER_SELECT` and `_order_row_to_dict`, added `is_test` to `GroundTransportCreate` model and INSERT, added new `DELETE /{order_id}/delete` endpoint (soft/hard delete, AFU only)
  - A3: Updated `shipments/core.py` — added `is_test` to `CreateManualShipmentRequest` and INSERT into orders
  - B1: Added `deleteGroundTransportOrderAction` to `actions/ground-transport.ts`, added `is_test`/`trash` to `GroundTransportOrder` type, added `is_test` to `GroundTransportCreatePayload`
  - B2: Updated GT list page — added `accountType` state, row actions menu (⋯) with Move to Trash / Delete Permanently (AFU only), TEST badge on `is_test` rows, click-outside menu close
  - B3: Updated `CreateGroundTransportModal` — added `accountType` prop, `is_test` checkbox (AFU only), passed `is_test` in payload
  - B4: Updated `StepReview` — added `isTest`/`onIsTestChange`/`accountType` props, AFU-only checkbox; updated `CreateShipmentModal` — added `isTest` state, `accountType` prop, passed through; updated `NewShipmentButton` — threaded `accountType` prop; updated shipments page to pass `accountType`
  - B4b: Added `is_test?: boolean` to `CreateShipmentOrderPayload` in `shipments-write.ts`, passed through in fetch body
- **Files Modified:**
  - `af-server/migrations/012_orders_is_test.sql` (new)
  - `af-server/routers/ground_transport.py`
  - `af-server/routers/shipments/core.py`
  - `af-platform/src/app/actions/ground-transport.ts`
  - `af-platform/src/app/actions/shipments-write.ts`
  - `af-platform/src/app/(platform)/ground-transport/page.tsx`
  - `af-platform/src/app/(platform)/shipments/page.tsx`
  - `af-platform/src/components/ground-transport/CreateGroundTransportModal.tsx`
  - `af-platform/src/components/shipments/CreateShipmentModal.tsx`
  - `af-platform/src/components/shipments/NewShipmentButton.tsx`
  - `af-platform/src/components/shipments/_create-shipment/StepReview.tsx`
- **Notes:** Migration file must be applied manually via psql before code deployment. Existing `DELETE /{order_id}` cancel endpoint preserved unchanged.

### [2026-03-05 16:00 UTC] — v5.00: Unified Orders Architecture
- **Status:** Completed
- **Tasks:**
  - Phase 1A: Created migration 010 (rename haulage_areas → areas)
  - Phase 1B: Created migration 011 (unified orders schema — orders, shipment_details, order_stops, order_legs + data migration from shipments/ground_transport_orders + legacy table rename)
  - Phase 2A: Rewrote db_queries.py for orders + shipment_details JOIN queries with string status
  - Phase 2B: Updated constants.py with string-based STATUS_LABELS, NUMERIC_TO_STRING_STATUS, STR_STATUS_PATH_A/B
  - Phase 2B: Updated all shipment routers (core.py, status.py, tasks.py, bl.py, doc_apply.py, files.py, route_nodes.py, _helpers.py, _status_helpers.py, _file_helpers.py) to use orders + shipment_details tables, order_id references
  - Phase 2C: Full rewrite of ground_transport.py for stops/legs model (orders + order_stops + order_legs, auto-derive legs from stops)
  - Phase 2D: Renamed haulage_areas → areas in geography.py (table refs, endpoints, Pydantic models)
  - Phase 3: Updated all frontend files — types.ts (HaulageArea→Area), actions/ground-transport.ts (stops model, field renames), actions/geography.ts (areas rename), ground-transport pages (order_id, transport_mode, stops/legs), geography _components.tsx (areas), AddressInput.tsx (area_id), CreateGroundTransportModal.tsx (stops)
  - Phase 4: Created run_migration_010_011.py script with row count verification
- **Files Modified:**
  - `af-server/migrations/010_rename_haulage_areas.sql` (new)
  - `af-server/migrations/011_unified_orders.sql` (new)
  - `af-server/scripts/run_migration_010_011.py` (new)
  - `af-server/core/db_queries.py`
  - `af-server/core/constants.py`
  - `af-server/routers/ground_transport.py`
  - `af-server/routers/geography.py`
  - `af-server/routers/shipments/core.py`
  - `af-server/routers/shipments/status.py`
  - `af-server/routers/shipments/tasks.py`
  - `af-server/routers/shipments/bl.py`
  - `af-server/routers/shipments/doc_apply.py`
  - `af-server/routers/shipments/files.py`
  - `af-server/routers/shipments/route_nodes.py`
  - `af-server/routers/shipments/_helpers.py`
  - `af-server/routers/shipments/_status_helpers.py`
  - `af-server/routers/shipments/_file_helpers.py`
  - `af-platform/src/lib/types.ts`
  - `af-platform/src/app/actions/ground-transport.ts`
  - `af-platform/src/app/actions/geography.ts`
  - `af-platform/src/app/(platform)/ground-transport/page.tsx`
  - `af-platform/src/app/(platform)/ground-transport/[id]/page.tsx`
  - `af-platform/src/app/(platform)/ground-transport/[id]/_components.tsx`
  - `af-platform/src/app/(platform)/geography/_components.tsx`
  - `af-platform/src/components/ground-transport/AddressInput.tsx`
  - `af-platform/src/components/ground-transport/CreateGroundTransportModal.tsx`
- **Notes:** Legacy tables preserved as _legacy_shipments, _legacy_ground_transport_orders, _legacy_ground_transport_legs. Migration script verifies row counts. DO NOT run migration on production until Calvin has verified locally. shipment_workflows and shipment_files FK columns renamed to order_id.
