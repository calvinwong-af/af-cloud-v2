# Prompt Log — v2.42–v2.51
AF Platform — AcceleFreight

### [2026-03-01 13:00 UTC] — v2.44: Revert 003862 Migration Workaround
- **Status:** Completed
- **Tasks:** Created revert script to delete all entities written by migrate_003862.py
- **Files Modified:** `af-server/scripts/revert_003862_migration.py` (new)
- **Notes:** Deletes Quotation AF-003862, ShipmentOrderV2CountId AF-003862, ShipmentWorkFlow AF-003862. Re-keys Files back to AFCQ-003862. Verifies superseded=True on ShipmentOrder. Supports --dry-run (default) and --commit.

### [2026-03-01 12:00 UTC] — v2.43: Dashboard Active-Only View
- **Status:** Completed
- **Tasks:** Added fetchDashboardShipmentsAction (parallel active+to_invoice calls); replaced dashboard single table with two filtered sections
- **Files Modified:** `af-platform/src/app/actions/shipments.ts`, `af-platform/src/app/(platform)/dashboard/page.tsx`
- **Notes:** Dashboard now shows only active shipments + separate "To Invoice" section. No completed/migrated V1 records visible. AFC company scoping preserved.

### [2026-03-01 12:00 UTC] — v2.42: Fix AF-003862 Incoterm (IN-01)
- **Status:** Completed (revised)
- **Tasks:** Created fix script to patch missing incoterm_code on AF-003862
- **Files Modified:** `af-server/scripts/fix_af_003862_incoterm.py` (new)
- **Notes:** Script checks ShipmentOrder, QuotationFreight, and Quotation AFCQ-003862 for incoterm data; falls back to CNF default. Patches only incoterm_code + updated timestamp. Idempotent.
