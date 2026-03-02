# Prompt Completion Log — v2.83–v2.92

### [2026-03-03 17:30 UTC] — v2.83: Fix empty shipments list (routing mismatch)
- **Status:** Completed
- **Tasks:**
  - Root cause identified: `redirect_slashes=False` on both `FastAPI()` app and `APIRouter()` combined with `@router.get("/")` meant `GET /api/v2/shipments` (no trailing slash, as sent by platform) never matched the list endpoint — returning 200 with empty data silently
  - Fixed `@router.get("/")` → `@router.get("")` for `list_shipments` in `af-server/routers/shipments/core.py`
  - Fixed `@router.post("/")` → `@router.post("")` for `create_shipment_manual` in same file
  - This was previously fixed in commit `7d62f15` but inadvertently reverted in `33fb80f` (linter changed `""` back to `"/"` while adding `redirect_slashes=False` to the router — incompatible combination)
- **Files Modified:**
  - `af-server/routers/shipments/core.py`
- **Notes:** Stats endpoint (`/stats`) was unaffected because it has an explicit non-empty path. The list/create endpoints register at the prefix root (no additional path), which with `redirect_slashes=False` must use `""` not `"/"`.
