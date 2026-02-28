# Prompt Completion Log

All prompt executions are logged here with timestamps and status reports.
Entries are appended chronologically — never overwrite.

---

### [2026-02-28 16:00 UTC] — Task Card Labels + Vessel Display
- **Status:** Completed
- **Tasks:**
  - Task 1: POL/POD task card timing labels — changed "Sched. End" / "Started" / "Completed" to ETD/ATD (POL) and ETA/ATA (POD) on TRACKED tasks
  - Task 2: Vessel + Voyage in RouteCard — added vessel name + voyage number row below port pair with Ship icon and dot separator
  - Task 3: Vessel + Voyage on TRACKED task cards — added vessel info row on POL/POD TRACKED cards with Ship icon
- **Files Modified:**
  - `af-platform/src/components/shipments/ShipmentTasks.tsx` — added `getTimingLabels()` helper, `Ship` import, `vesselName`/`voyageNumber` props, vessel row on TRACKED cards
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx` — updated `RouteCard` props + vessel row, passed vessel data to `RouteCard` and `ShipmentTasks`
- **Notes:** Lint passes. PortPair.tsx not modified — vessel row added inside RouteCard as it's a route-card-specific concern.

### [2026-02-28 16:30 UTC] — TRACKED POD Task Completion Behaviour
- **Status:** Completed
- **Tasks:**
  - Change 1: Hide ATD column from TRACKED POD card display — added `!(task.mode === 'TRACKED' && task.task_type === 'POD')` guard on completedLabel cell
  - Change 2: Mark Complete on TRACKED POD writes ATA (actual_start) not ATD (actual_end) — updated optimistic update in `handleMarkComplete` + server-side auto-completion logic in `shipments.py`
  - Change 3: Hide ATD (actual end) field from TRACKED POD edit modal
  - Change 4: Hide ETD (scheduled end) field from TRACKED POD edit modal
- **Files Modified:**
  - `af-platform/src/components/shipments/ShipmentTasks.tsx` — POD ATD hidden on card + edit modal, POD ETD hidden on edit modal, POD completion writes actual_start, removed unused `DateInput` import, re-added `Ship` import to page.tsx
  - `af-server/routers/shipments.py` — TRACKED POD completion sets `actual_start` instead of `actual_end`
- **Notes:** Lint passes. Also fixed two lint errors from user's prior edits (missing `Ship` import in page.tsx, unused `DateInput` import in ShipmentTasks.tsx).

### [2026-02-28 17:00 UTC] — Shipper/Consignee on BL Update + Parties Card + Diff UI
- **Status:** Completed
- **Tasks:**
  - Change 1: BLUpdateModal — added Consignee section (name + address fields), passing both form values and raw parsed BL values to server
  - Change 2: Server endpoint — added `consignee_name`, `consignee_address`, `bl_shipper_*`, `bl_consignee_*`, `force_update` form params; conditional-write logic for parties (only populate if empty unless force_update=true); writes raw BL values to `bl_document` dict
  - Change 3: ShipmentOrder type — added `bl_document` field; `readV2ShipmentOrder` and `assembleV1ShipmentOrder` now pass through `bl_document`
  - Change 4: PartiesCard — added diff indicators (AlertTriangle icon) when bl_document values differ from parties values, with tooltip and click-to-open diff modal
  - Change 5: BLPartyDiffModal — new component with side-by-side diff display, "Use BL Values" (force update) and "Keep Current" actions
- **Files Modified:**
  - `af-platform/src/components/shipments/BLUpdateModal.tsx` — consignee fields + bl_ raw values
  - `af-platform/src/app/actions/shipments-write.ts` — no changes needed (formData passthrough)
  - `af-server/routers/shipments.py` — new form params, conditional parties write, bl_document storage, force_update flag, bl_document in response
  - `af-platform/src/lib/types.ts` — `bl_document` on ShipmentOrder
  - `af-platform/src/lib/shipments.ts` — `bl_document` in V2 reader
  - `af-platform/src/lib/v1-assembly.ts` — `bl_document` passthrough
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx` — enhanced PartiesCard with diff indicators, diffParty state, BLPartyDiffModal rendering
  - `af-platform/src/components/shipments/BLPartyDiffModal.tsx` — new file
- **Notes:** Lint passes. Server action unchanged since it already passes FormData through directly.

