# Prompt Completion Log — v2.83–v2.92

### [2026-03-03 17:30 UTC] — v2.83: Fix empty shipments list (routing mismatch + startup crash)
- **Status:** Completed
- **Tasks:**
  - Root cause 1: `redirect_slashes=False` on both `FastAPI()` app and `APIRouter()` combined with `@router.get("/")` meant `GET /api/v2/shipments` (no trailing slash) never matched — returning 200 with empty data silently
  - Fix attempt 1 (`ea7bf6f`): Changed `@router.get("/")` → `@router.get("")` — broke Cloud Run startup
  - Root cause 2: `include_router(core_router, prefix="")` + `@router.get("")` (path="") → FastAPIError "Prefix and path cannot be both empty" → container fails to start
  - Fix (`f1933df`): Removed `@router.get("")` / `@router.post("")` decorators from `list_shipments` and `create_shipment_manual` in `core.py`. Registered them directly on the package router in `__init__.py` via `router.add_api_route("", ...)`. Since `main.py` includes the package router with prefix `/api/v2/shipments`, routes resolve to `GET/POST /api/v2/shipments` exactly — no trailing slash, no redirect, no FastAPIError.
  - Confirmed working in production: shipments list now returns data correctly
- **Files Modified:**
  - `af-server/routers/shipments/core.py`
  - `af-server/routers/shipments/__init__.py`
- **Notes:** Stats/search/etc were unaffected because they have explicit non-empty paths. The nested router pattern in FastAPI forbids both include prefix and route path being empty simultaneously — root-level routes must be defined at the outermost non-empty prefix level.

### [2026-03-03 18:45 UTC] — v2.84: Promote Customer to Staff
- **Status:** Completed
- **Tasks:**
  - Added `PATCH /users/{uid}/promote-to-staff` endpoint in af-server with role validation, account_type check, and system logging
  - Added `promoteToStaffAction` server action with full error handling per coding standards §12
  - Created `PromoteToStaffModal` component with warning banner, role selector (AFU-ADMIN/STAFF/OPS), and confirmation flow
  - Updated `EditUserModal` with `currentUserRole` + `onPromoteToStaff` props; added amber "Promote to Staff" button visible only for AFC users when current user is AFU-ADMIN
  - Wired up in `users/page.tsx`: stored `currentUserRole` from profile, passed to EditUserModal, rendered PromoteToStaffModal with proper state management
- **Files Modified:**
  - `af-server/routers/users.py`
  - `af-platform/src/app/actions/users.ts`
  - `af-platform/src/components/users/PromoteToStaffModal.tsx` (new)
  - `af-platform/src/components/users/EditUserModal.tsx`
  - `af-platform/src/app/(platform)/users/page.tsx`

### [2026-03-03 19:15 UTC] — v2.85: AWB Field Mapping Fixes + Edit Port on Detail Page
- **Status:** Completed
- **Tasks:**
  - Fix 1 — AWB field mapping: Updated `apply_awb` in `doc_apply.py` to also read and write `type_details` and `cargo` JSONB columns. Added saving of `pieces` → `type_details.pieces`, `gross_weight_kg` → `cargo.weight_kg`, `chargeable_weight_kg` → `type_details.chargeable_weight`, `cargo_description` → `cargo.description`, `hs_code` → `cargo.hs_code`. Removed stale TODO comment.
  - Fix 2 — HAWB auto-promotion: Verified no auto-promotion logic exists anywhere in `ai.py`, `_prompts.py`, `DocumentParseModal.tsx`, or `AWBReview.tsx`. No changes needed.
  - Feature — Edit port on detail page: Added `PATCH /shipments/{id}/port` endpoint to `core.py` with field validation, route node sync, and system logging. Added `updateShipmentPortAction` server action to `shipments-write.ts`. Added `PortEditPopover` component and pencil edit icons to `RouteCard` in `_components.tsx` (AFU only). Wired `onPortUpdated` callback in detail page to refresh order and route timings.
- **Files Modified:**
  - `af-server/routers/shipments/doc_apply.py`
  - `af-server/routers/shipments/core.py`
  - `af-platform/src/app/actions/shipments-write.ts`
  - `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`

### [2026-03-03 21:00 UTC] — v2.87: AWB Remaining Fixes + File Save
- **Status:** Completed
- **Tasks:**
  - Fix 1 — Route nodes update in apply_awb: Added `route_nodes` to SELECT query and update ORIGIN node's `scheduled_etd` when `flight_date` is provided, matching the `apply_booking_confirmation` pattern. MAWB/HAWB/flight_number flat columns were already correct from v2.85.
  - Fix 2 — Gross weight in creation flow: Added `weight_kg: body.cargo_weight_kg` to the `cargo` JSONB dict in `create_from_bl` — was previously missing despite being in the request model.
  - Fix 3 — AWB file saved to Files tab: Added `onFileSelected` callback to `BLUploadTab` to surface the uploaded File object. `CreateShipmentModal` now stores the file and calls `saveDocumentFileAction` after successful creation with the correct doc_type tag. Apply flow already handled via `_doc-handler.ts`.
- **Files Modified:**
  - `af-server/routers/shipments/doc_apply.py`
  - `af-server/routers/shipments/bl.py`
  - `af-platform/src/components/shipments/BLUploadTab.tsx`
  - `af-platform/src/components/shipments/CreateShipmentModal.tsx`

### [2026-03-03 22:00 UTC] — v2.88: Port Edit Modal
- **Status:** Completed
- **Tasks:**
  - Removed `PortEditPopover` component (inline popover that clipped off card edges)
  - Added `PortEditModal` component modelled on `CompanyReassignModal`: fixed full-screen overlay, searchable port list, highlight selected/current rows, Cancel/Save footer, inline error handling
  - Updated `RouteCard` to render `PortEditModal` outside the relative div for proper full-screen overlay
  - Removed unused `Check` icon import
- **Files Modified:**
  - `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`

### [2026-03-04 00:30 UTC] — v2.89: AWB Create + Apply Fixes
- **Status:** Completed
- **Tasks:**
  - Issue 1 — Company name in confirmed card: Added `companies` prop to `CompanyMatchSection`, name lookup now checks both match list and full companies list as fallback (confirmed fixed in testing)
  - Issue 2 — AWB transport details on detail page: Added AIR-specific Transport card rendering showing MAWB, HAWB, AWB type, flight number, flight date, ETD (confirmed fixed in testing)
  - Issue 3 — File save after AWB create: Changed `blUploadedFile` from `useState` to `useRef` so file is synchronously available when `handleBLConfirmCreate` runs. Added diagnostic `console.error` logs for both creation and apply paths when file is null or save fails.
  - Issue 4A — Server packages: Auto-create a single package entry in `type_details.packages` when `pieces` or `cargo_weight_kg` is provided for AIR orders
  - Issue 4B — Frontend packages card: Added AIR-specific row showing chargeable weight and pieces below the totals. Added `pieces` field to `TypeDetailsAir` type.
  - Issue 5 — Port edit modal filtering: Added freight-type filtering to `PortEditModal` — AIR shipments show only airports, SEA shipments show only sea ports
  - Bonus: Fixed unused `router` lint errors in `ShipmentOrderTable.tsx`
- **Files Modified:**
  - `af-platform/src/components/shipments/_bl-upload/BLParseResult.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/_doc-handler.ts`
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
  - `af-platform/src/lib/types.ts`
  - `af-platform/src/components/shipments/CreateShipmentModal.tsx`
  - `af-platform/src/components/shipments/ShipmentOrderTable.tsx`
  - `af-server/routers/shipments/bl.py`

### [2026-03-04 01:30 UTC] — v2.90: File Save Deep Fix
- **Status:** Completed
- **Tasks:**
  - Server-side: Added file size logging and 0-byte guard to `save_document_file` endpoint in `doc_apply.py`
  - Apply flow (`_doc-handler.ts`): Switched from `saveDocumentFileAction` (custom endpoint) to `uploadShipmentFileAction` (proven working standard upload endpoint). Uses `file_tags` JSON array instead of `doc_type` form field. Added pre-save diagnostic logging (name, size, type).
  - Create flow (`CreateShipmentModal.tsx`): Same switch to `uploadShipmentFileAction` with `file_tags` pattern and diagnostic logging.
  - Root cause: `saveDocumentFileAction` calls a separate endpoint (`/save-document-file`) that may have serialisation issues across the Next.js server action boundary. `uploadShipmentFileAction` calls the standard `/files` endpoint which is proven working from the Files tab upload.
- **Files Modified:**
  - `af-server/routers/shipments/doc_apply.py`
  - `af-platform/src/app/(platform)/shipments/[id]/_doc-handler.ts`
  - `af-platform/src/components/shipments/CreateShipmentModal.tsx`
