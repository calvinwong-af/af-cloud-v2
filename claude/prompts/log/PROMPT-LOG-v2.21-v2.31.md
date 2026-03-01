# Prompt Log — v2.21–v2.31
AF Platform — AcceleFreight

### [2026-03-01 21:00 UTC] — Fix parties update: clear/null semantics bug
- **Status:** Completed
- **Tasks:**
  - Frontend: changed EditPartiesModal to send `""` instead of `null` for cleared fields (removes `|| null` coercion)
  - Server: added cleanup logic to `update_parties` — if both name and address of a party are empty after merge, remove the party sub-object entirely (shipper, consignee, notify_party)
- **Files Modified:**
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx` — EditPartiesModal sends "" instead of null
  - `af-server/routers/shipments.py` — update_parties cleanup for empty party sub-objects
- **Notes:** Lint passes. Server compiles.

### [2026-03-01 21:30 UTC] — PROMPT PREPARED: Fix "To Invoice" Over-Count
- **Status:** Prompt written — awaiting Opus execution
- **Tasks:** Fix stats endpoint Loop 2 (V1 Quotation fallback) + Loop 3 (missing key guard); fix list endpoint to_invoice two-source check; new backfill_issued_invoice.py migration script
- **Files Modified:** `claude/prompts/PROMPT-CURRENT.md`
- **Notes:** Pending Invoice showing ~2,007 vs expected far lower. Root cause: issued_invoice absent on V1 ShipmentOrder records, treated as falsy = uninvoiced.

### [2026-03-01 22:00 UTC] — Fix "To Invoice" Over-Count
- **Status:** Completed
- **Tasks:**
  - Stats endpoint Loop 2 (V1): two-pass — batch-fetch Quotation for completed V1 records missing issued_invoice on SO; only count as to_invoice if Quotation exists AND issued_invoice is falsy
  - Stats endpoint Loop 3 (migrated): guard against missing Quotation keys — `mid in q_invoice_map and not bool(...)` instead of `if not issued`
  - List endpoint to_invoice tab: two-pass approach with Quotation batch-fetch and OR-logic verification
  - New script: `backfill_issued_invoice.py` — syncs issued_invoice across ShipmentOrder and Quotation using OR logic
- **Files Modified:**
  - `af-server/routers/shipments.py` — stats + list endpoint issued_invoice resolution
  - `af-server/scripts/backfill_issued_invoice.py` — new migration script
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx` — EditPartiesModal sends "" instead of null (parties clear fix)
- **Notes:** Build passes. Pushed as afe8e8f. Migration script must be run manually.

### [2026-03-01 22:15 UTC] — Status Icon Fix: Departed (4001)
- **Status:** Completed
- **Tasks:**
  - Replaced `Stamp` icon on status 4001 (Departed) with `Navigation` icon — clearer visual meaning of "underway"
  - Added order_type awareness: AIR shipments at 4001 show `Plane`, sea shows `Navigation`
  - Updated import: removed `Stamp`, added `Navigation`
  - Colour updated from purple `#7c3aed` to dark sky `#0369a1` to better separate from 3002 (Booking Confirmed, `#0284c7` lighter sky)
- **Files Modified:**
  - `af-platform/src/components/shipments/ShipmentOrderTable.tsx` — import swap, iconMap 4001 entry
- **Notes:** Single file, no lint issues expected. No server changes.

### [2026-03-01 23:30 UTC] — Session v2.26 Fixes + Migration Prompt Prep
- **Status:** Completed
- **Tasks:**
  - Status icon swap: 3002 Booking Confirmed gets Stamp, 4001 Departed gets Ship/Plane
  - Tab label fix: Pending Invoice to To Invoice on shipments page
  - Python 3.14 fix: added af-server/.python-version pinned to 3.11, updated CLAUDE.md with venv warning
  - EP series confirmed all passed by user
  - Deep analysis: V1 to V2 migration strategy, prefix re-key AFCQ- to AF-, collision check (clean)
  - Migration prompt written to claude/prompts/PROMPT-CURRENT.md
  - Handover notes written to claude/handover/AF-Handover-Notes-v2_26.md
- **Files Modified:**
  - `af-platform/src/components/shipments/ShipmentOrderTable.tsx`
  - `af-platform/src/app/(platform)/shipments/page.tsx`
  - `af-server/.python-version` (new)
  - `CLAUDE.md`
  - `claude/prompts/PROMPT-CURRENT.md`
  - `claude/handover/AF-Handover-Notes-v2_26.md` (new)
- **Notes:** Migration prompt in progress with Opus. Next session starts with validating migration output.

### [2026-03-02 01:00 UTC] — V1 → V2 Full Migration — Prefix Re-key + Code Cleanup
- **Status:** Completed
- **Tasks:**
  - Task 1: Rewrote `scripts/migrate_v1_to_v2.py` — full 7-step migration with prefix re-key (AFCQ→AF), issued_invoice OR-logic, ShipmentWorkFlow re-key, Files update, ShipmentOrderV2CountId registration, Quotation Kind writes, idempotency, --commit/--only flags, structured report
  - Task 2: Fixed `is_v1` detection in all write endpoints — switched from `shipment_id.startswith(PREFIX_V1_SHIPMENT)` to `(entity.get("data_version") or 1) < 2`. Fixed: update_shipment_status, update_from_bl, update_parties, assign_company, get_shipment (added AFCQ→AF redirect), route-nodes PUT/PATCH. Dual-write guards now check both Quotation and ShipmentOrder data_version
  - Task 3: Marked V1 constants as deprecated in constants.py — PREFIX_V1_SHIPMENT, V1_STATUS_*, V1_TO_V2_STATUS, V1_ACTIVE_MIN/MAX, V1_Q_* all tagged with `# DEPRECATED post-migration`
- **Files Modified:**
  - `af-server/scripts/migrate_v1_to_v2.py` (full rewrite)
  - `af-server/routers/shipments.py` (is_v1 detection + AFCQ redirect)
  - `af-server/core/constants.py` (deprecation comments)
- **Notes:** Script not yet tested against live Datastore. Test with `--only AFCQ-003829` before full migration.

### [2026-03-02 02:00 UTC] — Fix Shipment Stats & List Tab Filters Post-Migration
- **Status:** Completed
- **Tasks:**
  - Added `V2_OPERATIONAL_STATUSES` constant (3001/3002/4001/4002) — excludes STATUS_CONFIRMED (2001)
  - Updated stats endpoint: V2 and migrated sections use `V2_OPERATIONAL_STATUSES` for active bucket, STATUS_CONFIRMED treated as completed
  - Updated `_v2_tab_match()` and `_migrated_tab_match()`: active uses operational statuses, completed includes STATUS_CONFIRMED, to_invoice includes STATUS_CONFIRMED
- **Files Modified:**
  - `af-server/core/constants.py` — added V2_OPERATIONAL_STATUSES
  - `af-server/routers/shipments.py` — import + stats/list filter updates

### [2026-03-02 03:00 UTC] — Dashboard Order ID + Duplicate AFCQ-/AF- Entries + Incoterm Column
- **Status:** Completed
- **Tasks:**
  - Issue 1: Fixed Order ID column blank — extract entity key via `Datastore.KEY` symbol and populate `quotation_id` fallback in list query
  - Issue 2: Fixed duplicate AFCQ-/AF- entries — added `migrated_numerics` dedup set in stats, list, and search endpoints; added `superseded` fast-skip; created `mark_superseded.py` one-time script
  - Issue 3: Moved Incoterm column after Type (before Route); added colour-coded `IncotermBadge` component with 13 incoterm colours
- **Files Modified:**
  - `af-platform/src/lib/shipments.ts` — Datastore.KEY extraction for quotation_id
  - `af-platform/src/components/shipments/ShipmentOrderTable.tsx` — IncotermBadge + column reorder
  - `af-server/routers/shipments.py` — dedup logic in stats, list, search endpoints
  - `af-server/scripts/mark_superseded.py` — new one-time script

### [2026-03-02 06:00 UTC] — Fix To Invoice Overcount: Restrict to STATUS_COMPLETED Only
- **Status:** Completed
- **Tasks:**
  - Change 1: V2 Quotation stats — added `s == STATUS_COMPLETED` guard on to_invoice increment (was counting STATUS_CONFIRMED too)
  - Change 2: `_v2_tab_match()` to_invoice — removed STATUS_CONFIRMED, now STATUS_COMPLETED only
  - Change 3: `_migrated_tab_match()` to_invoice — removed STATUS_CONFIRMED, now STATUS_COMPLETED only
  - Change 4: Migrated stats loop — only append to `migrated_completed_ids` when STATUS_COMPLETED (was including STATUS_CONFIRMED in batch Quotation lookup)
- **Files Modified:**
  - `af-server/routers/shipments.py` — 4 changes across stats + tab match functions
- **Notes:** `completed` count unchanged (still includes both 5001+2001). Only to_invoice tightened. Expected dashboard drop from 17 to ~8.

### [2026-03-02 07:00 UTC] — V1 Badge on Order ID + Fix Cancelled V1 Orders in To Invoice
- **Status:** Completed
- **Tasks:**
  - Change 1: V1 to_invoice two-pass loop — added debug logging (`[to_invoice] SO ... raw_status=... resolved=...`) and explicit STATUS_CANCELLED + STATUS_COMPLETED guards
  - Change 2: Migrated ShipmentOrder to_invoice — removed `migrated_tab = "completed"` substitution; now uses `tab` directly so `_migrated_tab_match("to_invoice")` correctly requires STATUS_COMPLETED only; added debug logging for migrated records
  - Change 2b: V2 Quotation to_invoice — added per-entity debug logging showing status, issued_invoice, and match result
  - Change 3: V1 badge on mobile ShipmentCard — added same gray "V1" badge next to quotation_id, matching desktop style
- **Files Modified:**
  - `af-server/routers/shipments.py` — debug logs in V1/V2/migrated to_invoice paths; removed migrated_tab substitution; explicit cancelled guard
  - `af-platform/src/components/shipments/ShipmentOrderTable.tsx` — V1 badge on ShipmentCard mobile component
- **Notes:** Lint passes. Server compiles. Debug logs are temporary — remove after confirming to_invoice count drops to 8.
