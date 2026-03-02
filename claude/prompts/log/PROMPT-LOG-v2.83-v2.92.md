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
