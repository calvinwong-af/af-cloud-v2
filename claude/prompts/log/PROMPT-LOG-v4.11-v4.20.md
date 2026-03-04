# Prompt Completion Log — v4.11–v4.20

### [2026-03-05 17:30 UTC] — v-GEO-02: Geography Countries Backend + Countries Tab + Haulage Areas Combobox Filters
- **Status:** Completed
- **Tasks:**
  - **Part 1 (geography.py):** Replaced countries stub with full implementation — GET /countries (with 10-min cache), GET /countries/{code}, PATCH /countries/{code} (AFU only, dynamic UPDATE). Added `_countries_cache`, `_invalidate_countries_cache()`.
  - **Part 2 (geography.ts):** Added `Country` interface, `fetchCountriesAction`, `updateCountryAction` server actions following existing patterns.
  - **Part 3a (page.tsx):** Added 'Countries' tab to TABS constant, imported and rendered `CountriesTab`.
  - **Part 3b (_components.tsx):** Added `FilterCombobox` reusable typeable combobox. Upgraded HaulageAreasTab filters from `<select>` to `FilterCombobox` with country/port/state comboboxes. Added client-side country filter. Added `CountriesTab` (table with search, edit button) and `CountryEditModal` (currency + tax fields).
- **Files Modified:**
  - `af-server/routers/geography.py`
  - `af-platform/src/app/actions/geography.ts`
  - `af-platform/src/app/(platform)/geography/page.tsx`
  - `af-platform/src/app/(platform)/geography/_components.tsx`

### [2026-03-05 16:15 UTC] — v4.18: Investigate and Fix POL ATA Not Showing on Route Node
- **Status:** Completed
- **Tasks:**
  - **Frontend fix (onTimingChanged):** Added `setRouteTimelineRefreshKey(k => k + 1)` to onTimingChanged callback.
  - **Backend fix (tasks.py):** Changed sync condition from `body.__fields_set__` to `task.get("actual_start")` to cover auto-set from status transitions.
  - **Backend fix (route_nodes.py):** Added read-time enrichment in GET /route-nodes — always overwrites ORIGIN/DESTINATION actual timing from TRACKED tasks (task is source of truth).
  - **Frontend fix (props-based display):** Added `polAta`, `polAtd`, `podAta` props to RouteNodeTimeline. Component merges task timing into loaded nodes via `useMemo` — task timing always wins. Eliminates dependency on route_nodes JSONB sync and refreshKey re-fetch chain. Wired from page.tsx `routePolAta`, `routePolAtd`, `routePodAta` state.
  - Added debug logging to tasks.py and _helpers.py sync path.
- **Files Modified:**
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
  - `af-platform/src/components/shipments/RouteNodeTimeline.tsx`
  - `af-server/routers/shipments/tasks.py`
  - `af-server/routers/shipments/_helpers.py`
  - `af-server/routers/shipments/route_nodes.py`

### [2026-03-05 15:00 UTC] — v4.17: AWB scheduled_etd Correction + POL ATA Wiring + Remove Route Node Strikethroughs
- **Status:** Completed
- **Tasks:**
  - **Change A (doc_apply.py):** Removed `origin_scheduled_etd` from AWB route node sync — AWB is post-flight, only actual_etd should be written. Scheduled_etd belongs to BC.
  - **Change B (tasks.py + page.tsx):** B1 — Added `routePolAta` state variable in page.tsx. B2 — Populated from `polTask.actual_start` in loadRouteTimings. B3 — Added `_sync_route_node_timings` import to tasks.py, calls `origin_actual_eta` after TRACKED POL task actual_start save.
  - **Change C (RouteNodeTimeline.tsx):** Removed conditional strikethrough from ORIGIN ETA and ETD cells. Removed strikethrough blocks from T/S nodes (both ETD and ETA sections). Removed strikethrough block from DESTINATION node.
- **Files Modified:**
  - `af-server/routers/shipments/doc_apply.py`
  - `af-server/routers/shipments/tasks.py`
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
  - `af-platform/src/components/shipments/RouteNodeTimeline.tsx`

### [2026-03-05 14:30 UTC] — v4.16: Route Node Sync on Doc Apply + Files Tab Re-parse Refresh Fix
- **Status:** Completed
- **Tasks:**
  - **Change A (_helpers.py):** Added `_sync_route_node_timings` helper — syncs timing values to route_nodes JSONB, bootstraps minimal nodes from origin/dest port codes when route_nodes is null.
  - **Change B (doc_apply.py):** BC apply now syncs ETD POL, ETA POL (fallback), ETA POD to route nodes.
  - **Change C (doc_apply.py):** AWB apply syncs flight_date as both scheduled_etd and actual_etd on ORIGIN route node.
  - **Change D (bl.py):** D1 — update_from_bl syncs SOB date as scheduled_etd + actual_etd on ORIGIN. D2 — create_from_bl syncs route nodes at creation, with actual_etd only when ETD is past.
  - **Change E (ShipmentFilesTab.tsx + page.tsx):** Added `onDocApplied` prop to ShipmentFilesTab, called after re-parse apply. Wired in page.tsx to trigger loadRouteTimings + routeTimelineRefreshKey increment.
- **Files Modified:**
  - `af-server/routers/shipments/_helpers.py`
  - `af-server/routers/shipments/doc_apply.py`
  - `af-server/routers/shipments/bl.py`
  - `af-platform/src/components/shipments/ShipmentFilesTab.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`

### [2026-03-05 14:00 UTC] — v4.15: Route Node Timeline: Refresh Fix, ORIGIN ETA/ATA Display, 4-Timing Grid Layout, Task ATD/ATA Visibility Fix
- **Status:** Completed
- **Tasks:**
  - **Change A (RouteNodeTimeline.tsx):** Added `refreshKey` prop with skip-first-render useEffect to reload nodes on doc apply.
  - **Change B (RouteNodeTimeline.tsx):** Redesigned ORIGIN node timing to 2x2 grid (ETA/ETD top row, ATA/ATD bottom row). Widened ORIGIN min-width to 140px. Reformatted T/S and DESTINATION nodes with label-style layout.
  - **Change C (ShipmentTasks.tsx):** Changed actual row visibility from `task.status !== 'PENDING'` to `task.actual_start || task.actual_end` so ATD/ATA show regardless of task status. Removed `COMPLETED` gate on ATD column.
  - **Change D (page.tsx + _doc-handler.ts):** Added `routeTimelineRefreshKey` state, wired to RouteNodeTimeline and createDocResultHandler. All 3 doc-type branches increment key after apply. Removed unused `router` destructuring.
- **Files Modified:**
  - `af-platform/src/components/shipments/RouteNodeTimeline.tsx`
  - `af-platform/src/components/shipments/ShipmentTasks.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/_doc-handler.ts`

### [2026-03-05 13:15 UTC] — v4.14: BC Apply: Default ETA POL to ETD - 1 Day When ETA POL is Absent
- **Status:** Completed
- **Tasks:**
  - **Change A (doc_apply.py):** In apply_booking_confirmation task sync, added ETA POL fallback computation (ETD - 1 day) written to POL TRACKED task `scheduled_start` when ETD is present. ETA POL is not sent from frontend BC dialog, so fallback is always applied from ETD.
- **Files Modified:**
  - `af-server/routers/shipments/doc_apply.py`

### [2026-03-05 13:00 UTC] — v4.13: SOB→ATD Write, BC Task Timing Always-Overwrite, Route Nodes Refresh Fix
- **Status:** Completed
- **Tasks:**
  - **Change A (bl.py):** A1 — update_from_bl task sync now writes `actual_end` (SOB/on_board_date) to TRACKED POL task, seeds `scheduled_end` if blank. A2 — create_from_bl seeds `actual_end` on POL task when ETD is in the past.
  - **Change B (doc_apply.py):** AWB apply now syncs `flight_date` to TRACKED POL task `actual_end`, seeds `scheduled_end` if blank.
  - **Change C (doc_apply.py):** BC apply task timing sync changed from fill-blanks to always-overwrite, so user-confirmed ETD/ETA values always take effect.
  - **Change D (_doc-handler.ts):** Removed `router.refresh()` from all 3 doc-type branches (BL, BC, AWB) to fix race condition that discarded local route timing state updates.
- **Files Modified:**
  - `af-server/routers/shipments/bl.py`
  - `af-server/routers/shipments/doc_apply.py`
  - `af-platform/src/app/(platform)/shipments/[id]/_doc-handler.ts`

### [2026-03-05 12:30 UTC] — v4.12: Deprecate shipments.etd / shipments.eta — Single Source of Truth: Task Legs
- **Status:** Completed
- **Tasks:**
  - **Change A (tasks.py):** A1 — Removed flat etd/eta sync writes from TRACKED POL/POD block. A2 — Replaced `is not None` timing checks with `__fields_set__` to support explicit null clearing.
  - **Change B (doc_apply.py):** B1 — Removed flat etd/eta writes from BC apply, removed etd/eta from SELECT. B2 — Removed flat etd write from AWB apply. B3 — Removed stale route_nodes timing writes from AWB apply, removed route_nodes from SELECT, updated row indices.
  - **Change C (bl.py):** C1 — Removed etd from INSERT in create_from_bl, added POL task scheduled_end seeding from body.etd. C2 — Removed flat etd write from update_from_bl, removed etd from return value, added TRACKED POL task sync (fill-blanks only).
  - **Change D (core.py):** D1 — Removed etd/eta from INSERT in create_shipment_manual, added POL/POD task timing seeding. D2 — Removed etd/eta parsing from _lazy_init_tasks_pg, passing None instead.
  - **Change E (db_queries.py):** Removed etd/eta from timestamp serialisation loop in get_shipment_by_id.
  - **Change F (page.tsx):** Replaced flat `order.etd` cast with `routePolEtd` state variable sourced from TRACKED POL task.
- **Files Modified:**
  - `af-server/routers/shipments/tasks.py`
  - `af-server/routers/shipments/doc_apply.py`
  - `af-server/routers/shipments/bl.py`
  - `af-server/routers/shipments/core.py`
  - `af-server/core/db_queries.py`
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`

### [2026-03-05 11:00 UTC] — v4.11: BC Apply — Sync ETD/ETA to TRACKED Task Timing + Remove Stale route_nodes Writes
- **Status:** Completed
- **Tasks:**
  - **Change A:** Removed stale `route_nodes` JSONB timing writes from `apply_booking_confirmation` — ETD/ETA no longer written to deprecated route_nodes. Removed `route_nodes` from SELECT query and updated all subsequent row index references.
  - **Change B:** Added workflow task timing sync — after BC apply, TRACKED POL task gets `scheduled_end = ETD` and TRACKED POD task gets `scheduled_start = ETA` (fill-blanks only). Task list now displays correct timing immediately after BC apply.
- **Files Modified:**
  - `af-server/routers/shipments/doc_apply.py`
