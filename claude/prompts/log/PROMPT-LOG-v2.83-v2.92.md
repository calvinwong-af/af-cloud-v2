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
