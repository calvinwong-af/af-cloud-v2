# Prompt Completion Log

### [2026-03-02 03:00 UTC] — Dashboard Order ID + Duplicate AFCQ-/AF- Entries + Incoterm Column
- **Status:** Completed
- **Tasks:**
  - Issue 1: Fixed Order ID column blank — extract entity key via `Datastore.KEY` symbol and populate `quotation_id` fallback in list query
  - Issue 2: Fixed duplicate AFCQ-/AF- entries — added `migrated_numerics` dedup set in stats, list, and search endpoints; added `superseded` fast-skip; created `mark_superseded.py` one-time script
  - Issue 3: Moved Incoterm column after Type (before Route); added colour-coded `IncotermBadge` component with 13 incoterm colours
- **Files Modified:**
  - `af-platform/src/lib/shipments.ts` — Datastore.KEY extraction for quotation_id
  - `af-platform/src/components/shipments/ShipmentOrderTable.tsx` — IncotermBadge + column reorder
  - `af-server/routers/shipments.py` — dedup logic in stats, list, search endpoints
  - `af-server/scripts/mark_superseded.py` — new one-time script

### [2026-03-02 02:00 UTC] — Fix Shipment Stats & List Tab Filters Post-Migration
- **Status:** Completed
- **Tasks:**
  - Added `V2_OPERATIONAL_STATUSES` constant (3001/3002/4001/4002) — excludes STATUS_CONFIRMED (2001)
  - Updated stats endpoint: V2 and migrated sections use `V2_OPERATIONAL_STATUSES` for active bucket, STATUS_CONFIRMED treated as completed
  - Updated `_v2_tab_match()` and `_migrated_tab_match()`: active uses operational statuses, completed includes STATUS_CONFIRMED, to_invoice includes STATUS_CONFIRMED
- **Files Modified:**
  - `af-server/core/constants.py` — added V2_OPERATIONAL_STATUSES
  - `af-server/routers/shipments.py` — import + stats/list filter updates

### [2026-03-02 01:00 UTC] — V1 → V2 Full Migration — Prefix Re-key + Code Cleanup
- **Status:** Completed
- **Tasks:**
  - Task 1: Rewrote `scripts/migrate_v1_to_v2.py` — full 7-step migration with prefix re-key (AFCQ→AF), issued_invoice OR-logic, ShipmentWorkFlow re-key, Files update, ShipmentOrderV2CountId registration, Quotation Kind writes, idempotency, --commit/--only flags, structured report
  - Task 2: Fixed `is_v1` detection in all write endpoints — switched from `shipment_id.startswith(PREFIX_V1_SHIPMENT)` to `(entity.get("data_version") or 1) < 2`. Fixed: update_shipment_status, update_from_bl, update_parties, assign_company, get_shipment (added AFCQ→AF redirect), route-nodes PUT/PATCH. Dual-write guards now check both Quotation and ShipmentOrder data_version
  - Task 3: Marked V1 constants as deprecated in constants.py — PREFIX_V1_SHIPMENT, V1_STATUS_*, V1_TO_V2_STATUS, V1_ACTIVE_MIN/MAX, V1_Q_* all tagged with `# DEPRECATED post-migration`
- **Files Modified:**
  - `af-server/scripts/migrate_v1_to_v2.py` (full rewrite)
  - `af-server/routers/shipments.py` (is_v1 detection + AFCQ redirect)
  - `af-server/core/constants.py` (deprecation comments)
- **Notes:** Script not yet tested against live Datastore. Test with `--only AFCQ-003829` before full migration.

### [2026-03-01 23:30 UTC] - Session v2.26 Fixes + Migration Prompt Prep
- **Status:** Completed
- **Tasks:**
  - Status icon swap: 3002 Booking Confirmed gets Stamp, 4001 Departed gets Ship/Plane
  - Tab label fix: Pending Invoice to To Invoice on shipments page
  - Python 3.14 fix: added af-server/.python-version pinned to 3.11, updated CLAUDE.md with venv warning
  - EP series confirmed all passed by user
  - Deep analysis: V1 to V2 migration strategy, prefix re-key AFCQ- to AF-, collision check (clean)
  - Migration prompt written to claude/prompts/PROMPT-CURRENT.md
  - Handover notes written to claude/handover/AF-Handover-Notes-v2_26.md
- **Files Modified:**
  - `af-platform/src/components/shipments/ShipmentOrderTable.tsx`
  - `af-platform/src/app/(platform)/shipments/page.tsx`
  - `af-server/.python-version` (new)
  - `CLAUDE.md`
  - `claude/prompts/PROMPT-CURRENT.md`
  - `claude/handover/AF-Handover-Notes-v2_26.md` (new)
- **Notes:** Migration prompt in progress with Opus. Next session starts with validating migration output.

---

All prompt executions are logged here with timestamps and status reports.
Entries are appended chronologically — never overwrite.

### [2026-03-01 21:30 UTC] — PROMPT PREPARED: Fix "To Invoice" Over-Count
- **Status:** Prompt written — awaiting Opus execution
- **Tasks:** Fix stats endpoint Loop 2 (V1 Quotation fallback) + Loop 3 (missing key guard); fix list endpoint to_invoice two-source check; new backfill_issued_invoice.py migration script
- **Files Modified:** `claude/prompts/PROMPT-CURRENT.md`
- **Notes:** Pending Invoice showing ~2,007 vs expected far lower. Root cause: issued_invoice absent on V1 ShipmentOrder records, treated as falsy = uninvoiced.

---

### [2026-03-01 22:15 UTC] — Status Icon Fix: Departed (4001)
- **Status:** Completed
- **Tasks:**
  - Replaced `Stamp` icon on status 4001 (Departed) with `Navigation` icon — clearer visual meaning of "underway"
  - Added order_type awareness: AIR shipments at 4001 show `Plane`, sea shows `Navigation`
  - Updated import: removed `Stamp`, added `Navigation`
  - Colour updated from purple `#7c3aed` to dark sky `#0369a1` to better separate from 3002 (Booking Confirmed, `#0284c7` lighter sky)
- **Files Modified:**
  - `af-platform/src/components/shipments/ShipmentOrderTable.tsx` — import swap, iconMap 4001 entry
- **Notes:** Single file, no lint issues expected. No server changes.

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

### [2026-02-28 22:00 UTC] — Mobile Responsiveness: af-web + af-platform
- **Status:** Completed
- **Tasks:**
  - Navbar: CSS-only mobile/desktop visibility, outside-click close, smooth slide-down animation
  - Home page: tracker card mobile stack, SVG legend hidden, stats gap reduced
  - Services page: grid minmax fix for 375px screens
  - Contact page: grid stacks vertically, form pairs stack, map height reduced
  - FAQ page: 44px min-height on tab buttons
  - About page: grid gap reduced on mobile
  - PlatformShell: mobile drawer with backdrop overlay
  - Sidebar: mobile drawer mode with close button, nav link tap closes drawer
  - Topbar: hamburger button on mobile, QuickSearch hidden
  - ShipmentOrderTable: mobile card view with status badges
  - Shipments page: scrollable tabs, responsive header
  - Fixed bl_document missing in ShipmentOrder assembly (pre-existing type mismatch)
- **Files Modified:**
  - `af-web/src/components/layout/Navbar.tsx`
  - `af-web/src/app/page.tsx`, `about/page.tsx`, `services/page.tsx`, `faq/page.tsx`, `contact/page.tsx`
  - `af-web/src/styles/globals.css`
  - `af-platform/src/components/shell/PlatformShell.tsx`, `Sidebar.tsx`, `Topbar.tsx`
  - `af-platform/src/components/shipments/ShipmentOrderTable.tsx`
  - `af-platform/src/app/(platform)/shipments/page.tsx`
  - `af-platform/src/lib/shipments.ts`
- **Notes:** Both af-web and af-platform builds pass. Pre-existing bl_document type error fixed.

### [2026-02-28 17:30 UTC] — Port Data Model: Audit + Terminal Layer + V1 Migration
- **Status:** Completed
- **Tasks:**
  - Phase 1: Created `audit_port_codes.py` — read-only Datastore audit of port codes across Quotation + ShipmentOrder
  - Phase 2: Created `seed_port_terminals.py` — seeds MYPKG terminals, backfills `has_terminals`/`terminals` on all ports; updated `_get_port_label()` with terminal_id support
  - Phase 3: Created `migrate_v1_port_codes.py` — migrates non-standard port suffixes to `origin_terminal_id`/`destination_terminal_id`; added `terminal_id` to Location type; updated `assembleLocation()` and `assembleV1ShipmentOrder()` for terminal awareness; added terminal display to PortPair.tsx
  - Phase 4: Updated V1 detail endpoint to pass terminal_id to `_get_port_label()`; updated platform `portLabelMap` to include terminal-specific labels from Port entity terminals array
- **Files Modified:**
  - `af-server/scripts/audit_port_codes.py` (new)
  - `af-server/scripts/seed_port_terminals.py` (new)
  - `af-server/scripts/migrate_v1_port_codes.py` (new)
  - `af-server/routers/shipments.py`
  - `af-platform/src/lib/types.ts`
  - `af-platform/src/lib/v1-assembly.ts`
  - `af-platform/src/lib/shipments.ts`
  - `af-platform/src/lib/shipments-write.ts`
  - `af-platform/src/app/(platform)/shipments/page.tsx`
  - `af-platform/src/components/shared/PortPair.tsx`
- **Notes:** All 3 scripts are idempotent with --dry-run support. Build passes clean.

### [2026-02-28 18:00 UTC] — Login Page Mobile Responsiveness
- **Status:** Completed
- **Tasks:**
  - Outer wrapper: `flex-col md:flex-row` for mobile stacking
  - Left brand panel: `hidden md:flex md:w-[52%]` — hidden on mobile, visible on desktop
  - Right panel: `w-full overflow-y-auto` with responsive padding
  - Mobile-only logo + wordmark added at top of form panel (`md:hidden`)
- **Files Modified:**
  - `af-platform/src/app/login/page.tsx`
- **Notes:** Single file change. LogoMark already imported. Build passes clean.

### [2026-03-01 10:00 UTC] — Terminal Selection: Geography Endpoint + Platform Data Pipeline + UI
- **Status:** Completed
- **Tasks:**
  - Batch 1: Implemented `GET /api/v2/geography/ports` with terminal data + 10min in-memory cache
  - Batch 2: `fetchPortsAction` now calls af-server instead of Datastore; Port interfaces extended with `has_terminals` and `terminals` across NewShipmentButton, CreateShipmentModal, BLUploadTab
  - Batch 3: Created shared `TerminalSelector` component; added terminal state + auto-select default in CreateShipmentModal Step 2; terminal names shown in Review step; terminal IDs wired into both manual and BL create payloads; BLUploadTab extended with terminal fields + auto-select after parse
- **Files Modified:**
  - `af-server/routers/geography.py`
  - `af-server/routers/shipments.py`
  - `af-platform/src/components/shared/TerminalSelector.tsx` (new)
  - `af-platform/src/app/actions/shipments.ts`
  - `af-platform/src/app/actions/shipments-write.ts`
  - `af-platform/src/lib/shipments-write.ts`
  - `af-platform/src/components/shipments/CreateShipmentModal.tsx`
  - `af-platform/src/components/shipments/BLUploadTab.tsx`
  - `af-platform/src/components/shipments/NewShipmentButton.tsx`
  - `af-platform/src/app/(platform)/shipments/page.tsx`
- **Notes:** Removed unused `getDatastore` import from shipments actions. Fixed missing `ports` dep in BLUploadTab useCallback. Build passes clean.

### [2026-03-01 11:00 UTC] — V1 Cleanup: Parties Assembly Fix
- **Status:** Completed
- **Tasks:**
  - Updated `assembleParties()` to check 4 priority sources: quotation.parties, SO structured objects, SO flat strings, quotation flat strings
  - Added `quotation` parameter to function signature
  - Updated call site to pass quotation record
- **Files Modified:**
  - `af-platform/src/lib/v1-assembly.ts`
- **Notes:** Fixed function-in-block strict mode error by converting to arrow function. Build passes clean.

### [2026-03-01 12:00 UTC] — AFC Role Gating + Profile Page
- **Status:** Completed
- **Tasks:**
  - Part 1: Sidebar nav gating — replaced static `navSections` with `getNavSections(accountType)` that filters ADMINISTRATION and SYSTEM sections for AFC users; added ACCOUNT section with Profile link for all users; added `UserCircle` import and `accountType` state
  - Part 2: Route guards — added AFC redirect guards to `/users` and `/companies` pages using `getCurrentUserProfileAction` check with `router.replace('/dashboard')` and loading spinner
  - Part 3: Extended `getCurrentUserProfileAction` to return full profile (uid, name, email, phone, company_id from CompanyUserAccount, company_name from Company Kind, valid_access, last_login, created_at); created new `/profile` page with avatar, account card, access card, company card (AFC only)
  - Part 4: Fixed `_build_claims` in `auth.py` — added `CompanyUserAccount` lookup as primary source for `company_id`, with `UserIAM` and `UserAccount` as fallbacks
- **Files Modified:**
  - `af-platform/src/components/shell/Sidebar.tsx` — role-gated nav, UserCircle import, accountType state
  - `af-platform/src/app/(platform)/users/page.tsx` — AFC route guard
  - `af-platform/src/app/(platform)/companies/page.tsx` — AFC route guard
  - `af-platform/src/app/actions/users.ts` — extended `getCurrentUserProfileAction` with full profile data
  - `af-platform/src/app/(platform)/profile/page.tsx` — new file
  - `af-server/core/auth.py` — CompanyUserAccount lookup in `_build_claims`
- **Notes:** Lint passes. Server compiles clean. Critical security fix: AFC users with missing company_id in UserIAM now correctly resolved from CompanyUserAccount.

### [2026-03-01 13:00 UTC] — AFC Permission Fixes: Dashboard + Shipment Detail + Tasks
- **Status:** Completed
- **Tasks:**
  - Fix 1: Dashboard — replaced "Total Companies" KPI with "My Company" (company_name) for AFC users; skipped `fetchCompanyStatsAction` for AFC; `companyStats` no longer blocks `statsLoading` for AFC
  - Fix 2: Shipment detail — wrapped action buttons (Advance/Cancel/Flag Exception) with `isAfu && !isTerminal` guard; wrapped Invoiced toggle with `isAfu` guard; added `!isAfu` guard to `handleFutureNodeClick`; fixed cursor classes on all node states to only show pointer for AFU
  - Fix 3: Tasks — simplified `canChangeMode` to `accountType === 'AFU'` only; removed unused `userRole` param from `canChangeMode` and `EditTaskModal`
- **Files Modified:**
  - `af-platform/src/app/(platform)/dashboard/page.tsx` — conditional company KPI, conditional stats fetch
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx` — action buttons + invoiced toggle + node click AFC guards
  - `af-platform/src/components/shipments/ShipmentTasks.tsx` — `canChangeMode` simplified, `EditTaskModal` userRole removed
- **Notes:** Lint passes. Status history accordion remains visible to AFC users (read-only).

### [2026-03-01 14:00 UTC] — Dashboard AFC KPI Cards Redesign
- **Status:** Completed
- **Tasks:**
  - Replaced "My Company" KpiCard with custom company identity card (name + company ID in monospace)
  - Replaced "To Invoice" with "Completed" (CheckCircle2, green) for AFC users
  - Custom company card: icon + truncated name + ID subline, with skeleton loading state
  - AFU dashboard unchanged (Total Shipments, Active, Total Companies, To Invoice)
- **Files Modified:**
  - `af-platform/src/app/(platform)/dashboard/page.tsx` — AFC KPI grid redesign, CheckCircle2 import
- **Notes:** Lint passes. Single file change.

### [2026-03-01 18:00 UTC] — Search Fix + Re-parse BL Feature
- **Status:** Completed
- **Tasks:**
  - Item 1: Search threshold fix — lowered V1 ShipmentOrder filter from V1_ACTIVE_MIN (110) to V1_STATUS_BOOKING_STARTED (100) in search endpoint only; added Quotation Kind fallback scan for V1 shipments with `has_shipment=true`
  - Item 2: Re-parse BL feature — added "Read file again" button on bl-tagged files (AFU only) in ShipmentFilesTab; BLUpdateModal extended with `initialParsed` and `skipFileSave` props to support re-parse flow without re-uploading file
  - Fixed lint: removed unused `userRole` prop from ShipmentTasks TaskCard + main component + call site
  - Fixed lint: added `skipFileSave` to BLUpdateModal useCallback dependency array
- **Files Modified:**
  - `af-server/routers/shipments.py` — search endpoint: V1_STATUS_BOOKING_STARTED filter + Quotation Kind fallback
  - `af-platform/src/components/shipments/BLUpdateModal.tsx` — exported ParsedBL, added initialParsed/skipFileSave props
  - `af-platform/src/components/shipments/ShipmentFilesTab.tsx` — "Read file again" button, handleReparse callback, BLUpdateModal rendering
  - `af-platform/src/components/shipments/ShipmentTasks.tsx` — removed unused userRole prop
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx` — removed userRole prop from ShipmentTasks call
- **Notes:** Lint passes. Server compiles.

### [2026-03-01 19:00 UTC] — Read File Again CORS Fix + 003829 Data Fix
- **Status:** Completed
- **Tasks:**
  - Item 1: CORS fix — replaced client-side GCS fetch+parse chain with single `reparseBlFileAction` server action that does download+parse server-side; removed `parseBLAction` import from ShipmentFilesTab
  - Item 2: Created `af-server/scripts/fix_003829_status.py` one-time migration script to advance AFCQ-003829 ShipmentOrder status from 100 → 4110 (idempotent, supports --dry-run)
- **Files Modified:**
  - `af-platform/src/app/actions/shipments-files.ts` — added `reparseBlFileAction`
  - `af-platform/src/components/shipments/ShipmentFilesTab.tsx` — replaced handleReparse with server action call, removed parseBLAction import
  - `af-server/scripts/fix_003829_status.py` — new migration script
- **Notes:** Lint passes. Script compiles. Script must be run manually against Datastore.

### [2026-03-01 19:30 UTC] — BLUpdateModal: Add Notify Party Field
- **Status:** Completed
- **Tasks:**
  - Added `notifyPartyName` state, pre-fill in handleFile, FormData append in handleUpdate, useCallback dep
  - Added conditional Notify Party section in preview UI (only shown when parser returns a notify party)
- **Files Modified:**
  - `af-platform/src/components/shipments/BLUpdateModal.tsx` — notify party state, form field, FormData append
- **Notes:** Lint passes. No server changes needed — PATCH endpoint already accepts notify_party_name.

### [2026-03-01 20:00 UTC] — Fix V1 stats/list mixed status codes + notify party server + data_version guard
- **Status:** Completed
- **Tasks:**
  - Added `_resolve_so_status_to_v2` helper with `_V1_NATIVE_CODES` frozenset
  - Stats endpoint: V1 loop uses resolved V2 status for all tab bucketing
  - List endpoint: broadened V1 query to `status >= 100`, in-memory tab filter using resolved V2 status
  - Fix A: data_version guard on 3 write endpoints (status, bl, parties) — prevents future contamination
  - Fix B: added `notify_party_name` form param to `update_from_bl`, merge into `parties.notify_party`
- **Files Modified:**
  - `af-server/routers/shipments.py` — _resolve_so_status_to_v2, stats fix, list fix, data_version guards, notify_party_name
- **Notes:** Lint passes. Build passes. Pushed as 46df5a8.

### [2026-03-01 21:00 UTC] — Fix parties update: clear/null semantics bug
- **Status:** Completed
- **Tasks:**
  - Frontend: changed EditPartiesModal to send `""` instead of `null` for cleared fields (removes `|| null` coercion)
  - Server: added cleanup logic to `update_parties` — if both name and address of a party are empty after merge, remove the party sub-object entirely (shipper, consignee, notify_party)
- **Files Modified:**
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx` — EditPartiesModal sends "" instead of null
  - `af-server/routers/shipments.py` — update_parties cleanup for empty party sub-objects
- **Notes:** Lint passes. Server compiles.

### [2026-03-01 22:00 UTC] — Fix "To Invoice" Over-Count
- **Status:** Completed
- **Tasks:**
  - Stats endpoint Loop 2 (V1): two-pass — batch-fetch Quotation for completed V1 records missing issued_invoice on SO; only count as to_invoice if Quotation exists AND issued_invoice is falsy
  - Stats endpoint Loop 3 (migrated): guard against missing Quotation keys — `mid in q_invoice_map and not bool(...)` instead of `if not issued`
  - List endpoint to_invoice tab: two-pass approach with Quotation batch-fetch and OR-logic verification
  - New script: `backfill_issued_invoice.py` — syncs issued_invoice across ShipmentOrder and Quotation using OR logic
- **Files Modified:**
  - `af-server/routers/shipments.py` — stats + list endpoint issued_invoice resolution
  - `af-server/scripts/backfill_issued_invoice.py` — new migration script
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx` — EditPartiesModal sends "" instead of null (parties clear fix)
- **Notes:** Build passes. Pushed as afe8e8f. Migration script must be run manually.

