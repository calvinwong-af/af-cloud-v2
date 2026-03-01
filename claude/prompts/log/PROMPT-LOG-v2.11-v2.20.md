# Prompt Log — v2.11–v2.20
AF Platform — AcceleFreight

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
