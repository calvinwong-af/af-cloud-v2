# Prompt Log — v2.42–v2.51
AF Platform — AcceleFreight

### [2026-03-02 14:00 UTC] — v2.48 + v2.49: Status update out-of-path fix + search improvements
- **Status:** Completed
- **Tasks:**
  - v2.48: Added out-of-path guard in status transition validation for migrated shipments (e.g. AF-003851 CNF IMPORT with status 3001 not on Path B)
  - v2.49: Search results now sort active-first (CASE ordering), enriched SELECT with migrated_from_v1/transaction_type/incoterm/cargo_ready_date, status filter chips (Active/Completed/Other) in UI
- **Files Modified:**
  - `af-server/routers/shipments.py` — out-of-path guard in update_shipment_status()
  - `af-server/core/db_queries.py` — search_shipments() enriched SELECT + active-first ORDER BY
  - `af-platform/src/app/actions/shipments.ts` — SearchResult interface expanded
  - `af-platform/src/app/(platform)/shipments/page.tsx` — search result mapping + status filter chips

### [2026-03-02 01:00 UTC] — v2.47: PostgreSQL Migration — Phase 1 and 2
- **Status:** Completed
- **Tasks:**
  - TASK 1: Updated requirements.txt (removed google-cloud-datastore, added SQLAlchemy/pg8000/psycopg2/cloud-sql-python-connector)
  - TASK 2: Created core/db.py (engine factory with Cloud Run vs local detection, get_db FastAPI dependency)
  - TASK 3: Created scripts/create_schema.py (idempotent schema: 7 tables, indexes, sequence)
  - TASK 4: Created scripts/migrate_to_postgres.py (Datastore → PostgreSQL, --dry-run/--commit, FK-ordered)
  - TASK 5: Created core/db_queries.py (shared SQL helpers: stats, list, search, get_by_id, etc.)
  - TASK 6: Rewrote routers/shipments.py (all 24 endpoints, Datastore → PostgreSQL)
  - TASK 7: Implemented routers/companies.py (5 endpoints: list, stats, get, create, update)
  - TASK 8: Rewrote routers/geography.py (ports table queries, added GET /ports/{un_code})
  - TASK 9: Updated cloudbuild.yaml (Cloud SQL instance + Secret Manager secrets)
  - TASK 10: Removed Datastore from af-platform (deleted lib/v1-assembly.ts + lib/shipments.ts, rewrote actions cursor→offset, fixed company shipments action)
  - TASK 11: Updated test list to v2.18 (PG series: 15 tests, V2C series retired as NA)
- **Files Modified:**
  - `af-server/requirements.txt`
  - `af-server/core/db.py` (new)
  - `af-server/core/db_queries.py` (new)
  - `af-server/scripts/create_schema.py` (new)
  - `af-server/scripts/migrate_to_postgres.py` (new)
  - `af-server/routers/shipments.py` (full rewrite)
  - `af-server/routers/companies.py` (full rewrite)
  - `af-server/routers/geography.py` (rewrite)
  - `af-server/cloudbuild.yaml`
  - `af-platform/src/app/actions/shipments.ts` (cursor→offset, detail via af-server)
  - `af-platform/src/app/actions/companies.ts` (company shipments via af-server)
  - `af-platform/src/app/(platform)/shipments/page.tsx` (offset pagination)
  - `af-platform/src/app/(platform)/companies/[id]/page.tsx` (offset pagination)
  - `af-platform/src/lib/companies.ts` (removed shipments import)
  - `claude/tests/AF-Test-List.md` — v2.18
- **Notes:** lib/datastore.ts and lib/datastore-query.ts retained — still needed by users module (UserIAM/UserAccount/CompanyUserAccount remain on Datastore). @google-cloud/datastore kept in package.json for same reason. Build passes clean.

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
