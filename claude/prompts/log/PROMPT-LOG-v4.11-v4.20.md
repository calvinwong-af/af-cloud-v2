# Prompt Completion Log — v4.11–v4.20

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
