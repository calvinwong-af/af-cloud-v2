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
