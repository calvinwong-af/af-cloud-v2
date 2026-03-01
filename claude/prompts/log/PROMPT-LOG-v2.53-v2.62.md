# Prompt Completion Log — v2.53–v2.62

### [2026-03-02 20:00 UTC] — v2.58: Delete Fixes — Soft Delete 500 + Hard Delete Environment Guard
- **Status:** Completed
- **Tasks:**
  - TASK 1: Removed `shipment_workflows` UPDATE from soft delete (table has no `trash` column)
  - TASK 2a: Removed module-level `ENVIRONMENT` constant
  - TASK 2b: Changed delete endpoint auth from `require_afu` to `require_afu_admin`
  - TASK 2c: Removed environment guard block, replaced with comment noting AFU-Admin restriction
- **Files Modified:** `af-server/routers/shipments.py`
- **Notes:** Soft delete now only updates `shipments.trash`. Hard delete gated by role (AFU-Admin) instead of environment variable.

### [2026-03-02 19:00 UTC] — v2.57: Hard Delete — Menu Item + Action Extension
- **Status:** Completed
- **Tasks:**
  - TASK 1: Extended `deleteShipmentOrderAction` with optional `hard` boolean parameter, appends `?hard=true` to URL
  - TASK 2a: Added `showHardConfirm`, `hardDeleting`, `hardDeleteError` state to ShipmentActionsMenu
  - TASK 2b: Added `handleHardDelete()` handler calling action with `hard=true`
  - TASK 2c: Added Hard Delete menu item with Zap icon, dark red hover style
  - TASK 2d: Added visually distinct Hard Delete confirmation modal with dark red-900 header
- **Files Modified:**
  - `af-platform/src/app/actions/shipments-write.ts` — added `hard` param to deleteShipmentOrderAction
  - `af-platform/src/components/shipments/ShipmentOrderTable.tsx` — Zap import, hard delete state/handler/menu/modal
- **Notes:** No server changes. AFU-only guard reused from existing `showDelete`. Modal visually distinct from soft delete (dark header, stronger warning).

### [2026-03-02 18:00 UTC] — v2.56: Schema alignment sweep — fix column mismatches in shipments.py
- **Status:** Completed
- **Tasks:**
  - Removed ghost columns from INSERT: `last_status_updated`, `tracking_id`, `customer_reference` (shipments)
  - Fixed `shipment_files` INSERT: `file_size`→`file_size_kb`, `uploaded_by`→`uploaded_by_uid`, removed `permission`+`category`
  - Fixed `system_logs` INSERT: `timestamp`→`created_at`
  - Fixed `file_tags` SELECT: `name`→`label`, removed `category`
  - Removed `vessel_name`/`voyage_number` flat column updates from `update_from_bl` (data lives in `booking` JSONB)
  - Cleaned up `_file_row_to_dict` — removed `permission` parse
- **Files Modified:** `af-server/routers/shipments.py`
- **Notes:** No logic changes. Column name alignment only against `create_schema.py` source of truth.

### [2026-03-02 17:00 UTC] — v2.55: SQLAlchemy ::jsonb cast syntax fix — full sweep
- **Status:** Completed
- **Tasks:** Replaced all `:param::jsonb` patterns with `CAST(:param AS jsonb)` in SQLAlchemy text() strings
- **Files Modified:** `af-server/routers/shipments.py` — 28 occurrences across 13 locations
- **Notes:** Column casts (e.g. `cargo_ready_date::text`) left unchanged. No logic changes.

### [2026-03-02 16:00 UTC] — v2.54: BLUploadTab — Add shipper, consignee address, and notify party fields
- **Status:** Completed
- **Tasks:**
  - TASK 1: Added shipperName, shipperAddress, consigneeAddress, notifyPartyName to BLFormState + defaults
  - TASK 2: Pre-fill new fields from parsed BL data in handleFile()
  - TASK 3: Added Shipper section, Consignee Address textarea, conditional Notify Party section to preview UI
  - TASK 4: Updated CreateShipmentModal to read party fields from blFormState instead of raw parsed
  - TASK 5: Updated AF-Test-List.md to v2.27 — BU series (7 tests)
- **Files Modified:**
  - `af-platform/src/components/shipments/BLUploadTab.tsx` — 4 new form fields + 3 new UI sections
  - `af-platform/src/components/shipments/CreateShipmentModal.tsx` — party fields from blFormState
  - `claude/tests/AF-Test-List.md` — v2.27
- **Notes:** Notify Party section conditionally shown only when name is non-empty. Section order matches prompt spec.

### [2026-03-02 15:00 UTC] — v2.53: DS-01 + DS-02: Migrate createShipmentOrder and deleteShipmentOrder to af-server
- **Status:** Completed
- **Tasks:**
  - TASK 1: Replaced create-manual stub with full POST /api/v2/shipments implementation (PostgreSQL, incoterm tasks, workflow)
  - TASK 2: Added DELETE /api/v2/shipments/{id} with soft delete (default) and hard delete (dev-only, environment-guarded)
  - TASK 3: Migrated createShipmentOrderAction to fetch POST /api/v2/shipments
  - TASK 4: Migrated deleteShipmentOrderAction to fetch DELETE /api/v2/shipments/{id}
  - TASK 5: Cleaned up lib/shipments-write.ts — removed createShipmentOrder, deleteShipmentOrder, all helpers
  - TASK 6: Updated AF-Test-List.md to v2.26 — DS-01/02 YES, MC series (5 tests), SD series (5 tests) added
- **Files Modified:**
  - `af-server/routers/shipments.py` — POST /api/v2/shipments + DELETE /api/v2/shipments/{id}
  - `af-platform/src/app/actions/shipments-write.ts` — migrated create + delete to af-server fetch
  - `af-platform/src/lib/shipments-write.ts` — removed Datastore write functions, kept result types + deprecated updateInvoicedStatus
  - `claude/tests/AF-Test-List.md` — v2.26
  - `claude/prompts/log/PROMPT-LOG-v2.53-v2.62.md` — created
- **Notes:** STATUS_CONFIRMED (1002) used as initial status for manually created shipments. Hard delete guarded by ENVIRONMENT env var defaulting to "production".
