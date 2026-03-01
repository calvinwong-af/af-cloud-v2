# Prompt Log — v2.32–v2.41
AF Platform — AcceleFreight

### [2026-03-02 08:00 UTC] — Prompt Log Archiving System
- **Status:** Completed
- **Tasks:**
  - Change 1: Created `claude/prompts/log/` folder with `README.md` documenting naming convention and 10-entry-per-file rule
  - Change 2: Migrated all 30 existing entries from `claude/PROMPT-LOG.md` into 3 versioned archive files (v2.01-v2.10, v2.11-v2.20, v2.21-v2.31), sorted chronologically oldest-first
  - Change 3: Deprecated root `claude/PROMPT-LOG.md` — replaced content with redirect to archive folder
  - Change 4: Updated `CLAUDE.md` prompt log references to point to `claude/prompts/log/` with archive file instructions
  - Change 5: Updated auto-memory with prompt log system location
- **Files Modified:**
  - `claude/prompts/log/README.md` (new)
  - `claude/prompts/log/PROMPT-LOG-v2.01-v2.10.md` (new — 10 entries)
  - `claude/prompts/log/PROMPT-LOG-v2.11-v2.20.md` (new — 10 entries)
  - `claude/prompts/log/PROMPT-LOG-v2.21-v2.31.md` (new — 10 entries)
  - `claude/PROMPT-LOG.md` (deprecated, redirect only)
  - `CLAUDE.md` (prompt log path + rules updated)
- **Notes:** No entries lost. 30 entries split into 3 files of 10.

### [2026-03-02 08:30 UTC] — Remove To Invoice Debug Logging + Fix V1 Badge Detection
- **Status:** Completed
- **Tasks:**
  - Change 1: Removed all `[to_invoice]` debug log statements from `list_shipments()` — 7 logger.info calls removed across V2, migrated, and V1 sections
  - Change 2: Updated V1 badge detection to catch all V1-origin records: `data_version === 1 || migrated_from_v1 === true || quotation_id?.startsWith('AFCQ-')` — applied to both desktop ShipmentRow and mobile ShipmentCard
  - Added `migrated_from_v1?: boolean` to ShipmentOrder type (types.ts), ShipmentListItem (actions/shipments.ts), and toShipmentOrder mapping (shipments page.tsx)
- **Files Modified:**
  - `af-server/routers/shipments.py` — removed 7 debug log statements
  - `af-platform/src/lib/types.ts` — added `migrated_from_v1` to ShipmentOrder
  - `af-platform/src/app/actions/shipments.ts` — added `migrated_from_v1` to ShipmentListItem
  - `af-platform/src/app/(platform)/shipments/page.tsx` — added `migrated_from_v1` to toShipmentOrder mapping
  - `af-platform/src/components/shipments/ShipmentOrderTable.tsx` — updated V1 badge condition in ShipmentRow and ShipmentCard
- **Notes:** Lint passes. Server compiles. V1 badge now covers un-migrated AFCQ-, migrated AF- with migrated_from_v1, and AFCQ- prefix fallback.

### [2026-03-02 09:00 UTC] — Shipment List: Missing V2 Orders + AFCQ Dedup + V1 Badge
- **Status:** Completed
- **Tasks:**
  - Problem 1: Replaced Datastore-level `trash=False` filter with in-memory `if entity.get("trash") is True: continue` on 4 queries: stats V2 Quotation, stats migrated SO, list V2 Quotation, list migrated SO. Fixes missing native V2 AF- records where `trash` property is None/missing.
  - Problem 2: Created `af-server/scripts/fix_afcq_003862_superseded.py` one-time script to mark AFCQ-003862 as superseded
  - Problem 3: V1 badge — no code change needed; resolves once Problem 1 fix surfaces migrated records with `migrated_from_v1=true`
- **Files Modified:**
  - `af-server/routers/shipments.py` — removed 4 Datastore-level trash filters, added 4 in-memory guards
  - `af-server/scripts/fix_afcq_003862_superseded.py` (new)
- **Notes:** Server compiles. Build passes. Script must be run manually against Datastore.

### [2026-03-02 10:00 UTC] — Active tab missing native V2 records + double API call fix
- **Status:** Completed
- **Tasks:**
  - Fix A: `_v2_tab_match()` — distinguish native V2 vs migrated records for STATUS_CONFIRMED; native V2 2001 = active, migrated 2001 = completed historical
  - Fix B: `get_shipment_stats()` V2 Quotation bucketing — same migrated_from_v1 distinction for active vs completed counts
  - Fix C: Removed `[list_diag]` diagnostic logging from `list_shipments()`, restored clean fetch loop
  - Problem 2: Consolidated stats fetching — removed `fetchShipmentOrderStatsAction()` from mount useEffect; `load()` now owns all data fetching; stats fetched on page 1 only, skipped on load-more; removed statsRef
- **Files Modified:**
  - `af-server/routers/shipments.py` — `_v2_tab_match` migrated distinction, stats bucketing, removed diagnostic logging
  - `af-platform/src/app/(platform)/shipments/page.tsx` — consolidated data fetching, removed double stats call, removed statsRef
- **Notes:** Build passes. Active count should go from 22 → 24. Page load now makes 2 API calls instead of 4.
