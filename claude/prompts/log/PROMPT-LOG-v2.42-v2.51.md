# Prompt Log — v2.42–v2.51
AF Platform — AcceleFreight

### [2026-03-01 12:00 UTC] — v2.42: Fix AF-003862 Incoterm (IN-01)
- **Status:** Completed
- **Tasks:** Created fix script to patch missing incoterm_code on AF-003862
- **Files Modified:** `af-server/scripts/fix_af_003862_incoterm.py` (new)
- **Notes:** Script checks ShipmentOrder, QuotationFreight for incoterm data; falls back to CNF default. Idempotent.

### [2026-03-01 12:00 UTC] — v2.43: Dashboard Active-Only View
- **Status:** Completed
- **Tasks:** Added fetchDashboardShipmentsAction (parallel active+to_invoice calls); replaced dashboard single table with two filtered sections
- **Files Modified:** `af-platform/src/app/actions/shipments.ts`, `af-platform/src/app/(platform)/dashboard/page.tsx`
- **Notes:** Dashboard now shows only active shipments + separate "To Invoice" section. No completed/migrated V1 records visible. AFC company scoping preserved.
