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

### [2026-02-28 18:00 UTC] — Vessel Fix + Parties Edit
- **Status:** Completed
- **Tasks:**
  - Prompt 1: Fixed vessel extraction for V2 shipments — replaced fragile inline `||` expressions with clean `??`-based helper variables using `bk` dict; simplified Transport section to reuse outer variables
  - Prompt 2: Added Parties edit functionality — EditPartiesModal component, Pencil edit button on PartiesCard (AFU only, not on Completed/Cancelled), `updatePartiesAction` server action, `PATCH /api/v2/shipments/{id}/parties` endpoint with V1 dual-write support
- **Files Modified:**
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx` — vessel helper variables, EditPartiesModal, PartiesCard edit button, SectionCard `action` prop
  - `af-platform/src/app/actions/shipments-write.ts` — `updatePartiesAction`
  - `af-server/routers/shipments.py` — `PATCH /{shipment_id}/parties` endpoint
- **Notes:** Lint passes.

### [2026-02-28 19:00 UTC] — BL Button Threshold + Ctrl+Click + Notify Party
- **Status:** Completed
- **Tasks:**
  - Prompt 1: Fixed BL Upload button threshold — changed `order.status >= 3001` to `>= 2001` so Path B incoterms (CNF IMPORT) can upload BL from Confirmed status
  - Prompt 2: Ctrl+Click / Cmd+Click on shipment table row opens new tab — replaced `onRowClick` callback with `href` prop on `ShipmentRow`, added Ctrl/Cmd+click → `window.open` and normal click → `router.push`, removed unused `useRouter` from `ShipmentOrderTable` parent
  - Prompt 3: Added Notify Party to Edit Parties modal — new `notifyPartyName`/`notifyPartyAddress` state and form fields in `EditPartiesModal`, extended `updatePartiesAction` payload, extended `UpdatePartiesRequest` model and merge logic on server
- **Files Modified:**
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx` — BL button threshold, EditPartiesModal notify party fields + submit payload
  - `af-platform/src/components/shipments/ShipmentOrderTable.tsx` — `href` prop replaces `onRowClick`, Ctrl/Cmd+click support, removed `useRouter` from parent
  - `af-platform/src/app/actions/shipments-write.ts` — `updatePartiesAction` extended with `notify_party_name`/`notify_party_address`
  - `af-server/routers/shipments.py` — `UpdatePartiesRequest` + notify_party merge logic in `update_parties`
- **Notes:** Lint passes. Server compiles clean.

### [2026-02-28 19:30 UTC] — Dynamic Browser Tab Title
- **Status:** Completed
- **Tasks:**
  - Prompt 1: Set `document.title` to `{shipmentId} | AcceleFreight` when order loads, reset to `AcceleFreight` on unmount
- **Files Modified:**
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx` — added `useEffect` for `document.title` before loading guard (hooks-before-returns rule)
- **Notes:** Lint passes. Placed useEffect before early returns to satisfy react-hooks/rules-of-hooks.

### [2026-02-28 20:00 UTC] — Port Name Tooltip Fix
- **Status:** Completed
- **Tasks:**
  - Prompt 1: Fixed port name tooltip in PortPair — only show tooltip when `port_name` differs from the displayed `port_un_code`, suppress misleading cursor-help when tooltip would just repeat the code
- **Files Modified:**
  - `af-platform/src/components/shared/PortPair.tsx` — updated `title` and `cursor-help` conditions on both origin and destination divs
- **Notes:** Lint passes.

### [2026-02-28 20:30 UTC] — Port Name Lookup on V1 Shipment Detail
- **Status:** Completed
- **Tasks:**
  - Prompt 1: Added server-side `_get_port_label()` helper that looks up Port Kind by un_code and returns `"Name, Country"` format; enriched V1 detail endpoint response with `origin_port_label`/`destination_port_label`; added platform-side port lookups in `getShipmentOrderDetail` using batch `datastore.get` and passed `portLabelMap` to `assembleV1ShipmentOrder`
- **Files Modified:**
  - `af-server/routers/shipments.py` — `_get_port_label()` helper, V1 detail path enrichment with port labels
  - `af-platform/src/lib/shipments.ts` — batch Port Kind lookup, `portLabelMap` passed to `assembleV1ShipmentOrder`
- **Notes:** Lint passes. Server compiles clean. Fixed both server-side (for API consumers) and platform-side (for direct Datastore reads) paths.

