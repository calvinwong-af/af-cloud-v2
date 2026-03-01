# Prompt Log — v2.42–v2.51
AF Platform — AcceleFreight

### [2026-03-01 23:00 UTC] — v2.46: Batch — backlog cleanup + mobile/UX improvements
- **Status:** Completed ✅
- **Tasks:**
  - TASK 1: MI series retired in test list (NA). V2C series added (10 tests, all PENDING). Test list → v2.17
  - TASK 2: URL-based tab persistence on shipments page (?tab= param)
  - TASK 3: Server-side cursor pagination for completed tab
  - TASK 4: Mobile dashboard — active shipments tap card replacing table
  - TASK 5: Mobile shipments page — KPI cards hidden on mobile
- **Files Modified:**
  - `claude/tests/AF-Test-List.md` — v2.17
  - `af-platform/src/app/(platform)/shipments/page.tsx`
  - `af-platform/src/app/(platform)/dashboard/page.tsx`
  - `af-server/routers/shipments.py`
  - `af-platform/src/app/actions/shipments.ts` (verified — no changes needed)

### [2026-03-01 22:00 UTC] — v2.45: Remove V1 dual-path code from shipments.py
- **Status:** Completed ✅
- **Tasks:**
  - Removed all V1 ShipmentOrder read/write paths from `shipments.py` (stats, list, search, get, status update, BL update, parties update, assign company)
  - Removed V1 helpers: `_resolve_so_status_to_v2()`, `_V1_NATIVE_CODES`, `_make_v1_summary()`, `_get_port_label()`, `_V1_TO_V2`/`_V2_TO_V1` dicts
  - Removed V1 imports: `V1_ACTIVE_MIN`, `V1_ACTIVE_MAX`, `V1_STATUS_BOOKING_STARTED`, `V1_STATUS_COMPLETED`, `V1_TO_V2_STATUS`, `OLD_TO_NEW_STATUS`
  - Cleaned up `constants.py`: deleted `V1_TYPE_FCL/LCL/AIR`, `V1_Q_*` (7 constants), `V1_ACTIVE_MIN/MAX`
  - Kept `V1_STATUS_*` and `V1_TO_V2_STATUS` (still used by migration scripts), `PREFIX_V1_SHIPMENT` (still used for AFCQ- routing)
- **Files Modified:**
  - `af-server/routers/shipments.py` — removed all V1 dual-path code (~300 lines)
  - `af-server/core/constants.py` — deleted 12 deprecated V1 constants
- **Notes:** Server compiles clean. All endpoints now serve exclusively from V2 Quotation Kind (data_version=2). AFCQ- prefix in get_shipment() resolves to AF- migrated record.

### [2026-03-01 19:00 UTC] — v2.43: Dashboard active-only shipments
- **Status:** Completed ✅
- **Tasks:**
  - Added `fetchDashboardShipmentsAction()` to `af-platform/src/app/actions/shipments.ts` — calls `GET /api/v2/shipments?tab=active&limit=24`
  - Updated `af-platform/src/app/(platform)/dashboard/page.tsx` — replaced `fetchShipmentOrdersAction({ limit: 10 })` with new action, renamed section to "Active Shipments", removed completed records from view
- **Files Modified:**
  - `af-platform/src/app/actions/shipments.ts` — new `fetchDashboardShipmentsAction()`
  - `af-platform/src/app/(platform)/dashboard/page.tsx` — active-only fetch, section rename
- **Notes:** Confirmed ✅ — dashboard now shows only 23 active records. AF-000001 through AF-000014 (completed historical) no longer appear.

### [2026-03-01 20:00 UTC] — v2.44: Revert 003862 migration workaround
- **Status:** Completed ✅
- **Tasks:**
  - Created `af-server/scripts/revert_003862_migration.py` — deletes Quotation AF-003862, ShipmentOrderV2CountId AF-003862, ShipmentWorkFlow AF-003862. Re-keys any Files back to AFCQ-003862. Verifies ShipmentOrder AFCQ-003862 superseded=True.
  - Script run with --commit. All three entities deleted. AFCQ-003862 superseded=True confirmed.
  - IN series and SU series retired as NA in test list (v2.14).
  - GS-11 confirmed YES from mobile snapshot. MB series added and deferred (v2.16).
- **Files Modified:**
  - `af-server/scripts/revert_003862_migration.py` (new)
  - `claude/tests/AF-Test-List.md` — v2.14 → v2.16
- **Notes:** Total=2,043, Active=23 confirmed ✅. 003862 was a cancelled order replaced by 003867. migrate_003862.py was an incorrect workaround — now fully cleaned up.
