# Prompt Completion Log — v4.01–v4.10

### [2026-03-05 04:00 UTC] — v4.07: Route Card Timing Layout Polish + BL Apply Status Progression
- **Status:** Completed
- **Tasks:**
  - Frontend: Removed all `line-through` styling from PortPair stacked timing. Planned dates (ETD, ETA) shown in muted colour, actual dates (ATD, ATA) shown in sky accent colour — no strikethrough, no bold, just colour contrast.
  - Frontend: Moved stacked timing out of left/right port columns into a dedicated bottom row below the vessel line in PortPair. Origin timing left-aligned, destination timing right-aligned, separated by `border-t`. Keeps port code display clean and symmetric.
  - Backend: Added auto status progression to BL apply endpoint (`bl.py`). After writing BL data, checks if TRACKED POL task has `actual_end` (ATD) set — if so and shipment status < STATUS_DEPARTED (4001), auto-advances to In Transit and appends to `status_history`.
- **Files Modified:**
  - `af-platform/src/components/shared/PortPair.tsx`
  - `af-server/routers/shipments/bl.py`

### [2026-03-05 03:00 UTC] — v4.06: Route Card Timing Display + Auto In Transit Status from ATD
- **Status:** Completed
- **Tasks:**
  - Frontend: Expanded Route Card timing to show stacked planned/actual dates. Origin shows ETA (EXPORT only) + ETD/ATD stacked. Destination shows ETA/ATA stacked. Planned date shown muted with strikethrough when actual exists, actual shown bold below.
  - Frontend: Added `originTiming`/`destTiming` props to `PortPair` for stacked display, keeping legacy `etd`/`eta` props for backward compatibility (shipment list).
  - Frontend: `page.tsx` now tracks 5 timing values (`polEta`, `polEtd`, `polAtd`, `podEta`, `podAta`) instead of simplified `routeEtd`/`routeEta`. Passes `transactionType`-aware timing to RouteCard.
  - Frontend: StatusCard advance button shows "Advance to In Transit" when next status is 4001 (Option B — keeps "Departed" as sub-step label in timeline).
  - Frontend: `onTimingChanged` now also calls `loadOrder()` so StatusCard refreshes after ATD auto-advances status.
- **Files Modified:**
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`
  - `af-platform/src/components/shared/PortPair.tsx`
- **Notes:** No backend changes — STATUS_DEPARTED (4001) was already correct for In Transit.

### [2026-03-05 02:30 UTC] — v4.05: Single Source of Truth — Route Card Timing from Task Legs
- **Status:** Completed
- **Tasks:**
  - Frontend: Rewrote `loadRouteTimings` in `page.tsx` to fetch timing from workflow tasks (TRACKED POL/POD task legs) instead of `route_nodes` JSONB. Origin ETD/ATD from POL task's `scheduled_end`/`actual_end`, destination ETA/ATA from POD task's `scheduled_start`/`actual_start`.
  - Frontend: Removed `getRouteNodesAction` import from `page.tsx` (still used internally by `RouteNodeTimeline`). Removed `routeRefreshKey` state and `refreshKey` prop from `RouteNodeTimeline`.
  - Backend: Removed route_nodes JSONB timing sync from task PATCH endpoint (tasks.py). Kept flat `etd`/`eta` column sync and auto status progression (ATD→Departed, ATA→Arrived).
  - `RouteNodeTimeline` remains display-only for port identity and sequence — timing shown there is cosmetic only.
- **Files Modified:**
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
  - `af-platform/src/components/shipments/RouteNodeTimeline.tsx`
  - `af-server/routers/shipments/tasks.py`

### [2026-03-05 02:00 UTC] — v4.04: Task Leg Timing → Route Node Sync + Deprecate Route Node Direct Timing Edit
- **Status:** Completed
- **Tasks:**
  - Backend: Added route node sync block to `PATCH /shipments/{id}/tasks/{task_id}` — TRACKED POL/POD tasks now sync timing fields (scheduled_start→scheduled_eta, scheduled_end→scheduled_etd, actual_start→actual_eta, actual_end→actual_etd) to `route_nodes` JSONB on shipments table. Also syncs flat etd/eta columns and triggers auto status progression (ATD→Departed 4001, ATA→Arrived 4002).
  - Frontend: Removed `TimingEditPanel`, `handleTimingSave`, `editingSeq` state, and all interactive timing edit UI from `RouteNodeTimeline.tsx`. Port circle buttons are now display-only (no cursor-pointer, no hover styles for ORIGIN/DESTINATION). All nodes are read-only.
  - Frontend: Removed `updateRouteNodeTimingAction` export from `shipments-route.ts` (no longer called).
  - Frontend: Added `onTimingChanged` prop to `ShipmentTasks` — called after successful timing saves on TRACKED POL/POD tasks (edit, mark complete, undo).
  - Frontend: `page.tsx` passes `onTimingChanged` callback to `ShipmentTasks` and `refreshKey` to `RouteNodeTimeline` so the timeline reloads after task timing changes.
- **Files Modified:**
  - `af-server/routers/shipments/tasks.py`
  - `af-platform/src/components/shipments/RouteNodeTimeline.tsx`
  - `af-platform/src/app/actions/shipments-route.ts`
  - `af-platform/src/components/shipments/ShipmentTasks.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`

### [2026-03-04 06:00 UTC] — v4.03: Route Node Timing — Auto Status Progression + Terminal Selection + ATD/ATA Labels
- **Status:** Completed
- **Tasks:**
  - Backend: Added auto status progression to `PATCH /route-nodes/{sequence}` — ATD on ORIGIN auto-advances to Departed (4001), ATA on DESTINATION auto-advances to Arrived (4002). Forward-only, appends to `status_history` JSONB, logs via `_log_system_action_pg`.
  - Backend: Added `terminal_id` field to `UpdatePortRequest` in `core.py` — PATCH `/port` now writes both port and terminal in one call
  - Frontend: Added terminal picker to `PortEditModal` — shows pill buttons when selected port has terminals, auto-selects default terminal
  - Frontend: Added `etdLabel`/`etaLabel` props to `PortPair` — shows "ATD"/"ATA" when actual times are displayed instead of scheduled
  - Frontend: RouteCard and page.tsx now track whether displayed time is actual vs scheduled, passes correct label
  - Confirmed `STATUS_ARRIVED = 4002` and `STATUS_LABELS[4002]` already exist in `constants.py`
- **Files Modified:**
  - `af-server/routers/shipments/route_nodes.py`
  - `af-server/routers/shipments/core.py`
  - `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
  - `af-platform/src/app/actions/shipments-write.ts`
  - `af-platform/src/components/shared/PortPair.tsx`

### [2026-03-04 23:30 UTC] — v4.02: Geocode all ports via Google Geocoding API
- **Status:** Completed
- **Tasks:** Created backfill script to geocode all ports (SEA + AIR) missing lat/lng coordinates using Google Geocoding API. AIR ports geocoded by airport name, SEA ports by "name, country". Idempotent, logs progress, handles errors per-port.
- **Files Modified:**
  - `af-server/scripts/geocode_ports.py` (new — geocoding backfill script)
- **Notes:** Run with `python -m scripts.geocode_ports` after ensuring Cloud SQL Auth Proxy is active and `GOOGLE_MAPS_API_KEY` is set in `.env.local`.

### [2026-03-04 23:00 UTC] — v4.01: Geography Phase 1 — States, Cities, Haulage Areas + Port Resolution + Maps
- **Status:** Completed
- **Tasks:**
  - **Section A:** Created `states`, `cities`, `haulage_areas` tables + lat/lng on `ports`. Seed data for 16 Malaysian states + 70 cities with coordinates. Full CRUD endpoints in `geography.py` (states read-only, cities CRUD, haulage areas CRUD, port coordinate editing). 10-min cache on states/cities. Admin geography page with 4 tabs (States, Cities, Haulage Areas, Ports) at `/geography`.
  - **Section B:** Port resolution via Claude API — `POST /ports/resolve` calls Claude to identify unknown port codes, `POST /ports/confirm` inserts into ports table. Resolution modal UI in Geography admin and available for document parse flows.
  - **Section C:** Added `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `GOOGLE_MAPS_API_KEY` to env files. Installed `@vis.gl/react-google-maps`.
  - **Section D:** Created 4 map components — `MapProvider`, `PortMarkerMap`, `RouteMap`, `DashboardMap`. Integrated: geography admin modals show map preview, shipment detail page shows route map card, dashboard shows map with active shipment markers. All gracefully degrade when Maps API key is `PENDING`.
  - **Section E:** API contract already updated (v1.4) with all geography endpoints.
- **Files Modified:**
  - `af-server/routers/geography.py` (full rewrite — states, cities, haulage areas, port resolution endpoints)
  - `af-server/migrations/004_geography_tables.sql` (new — schema + seed data)
  - `af-platform/src/lib/types.ts` (State, City, HaulageArea interfaces)
  - `af-platform/src/lib/ports.ts` (added lat/lng to Port interface)
  - `af-platform/src/lib/geography.ts` (new — fetch functions)
  - `af-platform/src/app/actions/geography.ts` (new — all geography server actions)
  - `af-platform/src/app/(platform)/geography/page.tsx` (new — admin page)
  - `af-platform/src/app/(platform)/geography/_components.tsx` (new — all tab components)
  - `af-platform/src/components/maps/MapProvider.tsx` (new)
  - `af-platform/src/components/maps/PortMarkerMap.tsx` (new)
  - `af-platform/src/components/maps/RouteMap.tsx` (new)
  - `af-platform/src/components/maps/DashboardMap.tsx` (new)
  - `af-platform/src/components/maps/ShipmentRouteMapCard.tsx` (new)
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx` (added route map card)
  - `af-platform/src/app/(platform)/dashboard/page.tsx` (added dashboard map + ports fetch)
  - `af-platform/.env.local.example` (added NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
  - `af-platform/package.json` (added @vis.gl/react-google-maps)
- **Notes:** Google Maps API key is `PENDING` — all map components render graceful placeholders. Run `004_geography_tables.sql` against PostgreSQL before testing geography endpoints.
