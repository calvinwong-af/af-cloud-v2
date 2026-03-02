# Prompt Completion Log — v2.73–v2.82

### [2026-03-03 09:00 UTC] — v2.77: Split routers/shipments.py into package
- **Status:** Completed
- **Tasks:**
  - Split 118 KB / 3209-line `routers/shipments.py` into `routers/shipments/` package (10 files)
  - Created: `__init__.py`, `_helpers.py`, `_prompts.py`, `core.py`, `status.py`, `bl.py`, `files.py`, `tasks.py`, `route_nodes.py`, `doc_apply.py`
  - Deleted `routers/shipments.py`; import path unchanged (`from routers import shipments` / `shipments.router`)
  - `_helpers.py` = all shared utilities + constants; `_prompts.py` = AI prompt strings only
  - `get_file_tags` placed in `core.py` (before `get_shipment`) to preserve route priority over `/{shipment_id}`
  - `generate_tasks` alias fix: `from logic.incoterm_tasks import generate_tasks as generate_incoterm_tasks`
  - Root path routes changed `""` → `"/"` (list_shipments, create_shipment_manual) to satisfy FastAPI include_router constraint; redirect_slashes=True handles non-slash requests transparently
  - 29 routes registered; all compile clean; router import verified
- **Files Modified:**
  - `af-server/routers/shipments.py` (deleted)
  - `af-server/routers/shipments/` (10 new files)

### [2026-03-03 08:00 UTC] — v2.76: AWB apply UX: diff indicator, files tab refresh, loading state
- **Status:** Completed
- **Tasks:**
  - Issue 1: Added `currentParties` prop to DocumentParseModal; amber "Differs from current" badge shown next to Shipper/Consignee in AWB review when parsed name differs from shipment's current party
  - Issue 2: Added `refreshKey` prop + skip-first-render `useEffect` to ShipmentFilesTab; `filesRefreshKey` state in page.tsx incremented after successful file save; `router.refresh()` called after apply
  - Issue 3: Added `isApplying/applyError/applySuccess` state to DocumentParseModal; content dimmed + pointer-events-none while applying; X button disabled; 800ms success state before auto-close; error shown in footer for retry
  - Updated DP series test file: added DP-41–DP-47, counts 40→47 total, 19→26 PENDING
  - Updated AF-Test-Master.md DP row and TOTAL row
- **Files Modified:**
  - `af-platform/src/components/shipments/DocumentParseModal.tsx`
  - `af-platform/src/components/shipments/ShipmentFilesTab.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
  - `claude/tests/series/DP-document-parse.md`
  - `claude/tests/AF-Test-Master.md`

### [2026-03-03 07:30 UTC] — v2.75: Test list modularization
- **Status:** Completed
- **Tasks:**
  - Created `claude/tests/AF-Test-Master.md` — series registry dashboard with 24 rows + totals (239/193/38/12/2)
  - Created `claude/tests/series/` directory with 24 individual series files (DP, DT, VD, PP, DS, BUG2, MB, AUTH, PT, BL, BU, TL, TS, TV, GS, AC, PG, BUG1, EP, TI, LV, MC, SD, LO)
  - Deleted `claude/tests/AF-Test-List.md` (fully superseded)
  - `AF-Test-Archive.md` untouched
  - Updated `claude/PROMPT-LOG.md` with v2.75 entry
- **Files Modified:**
  - `claude/tests/AF-Test-Master.md` (new)
  - `claude/tests/series/*.md` (24 new files)
  - `claude/tests/AF-Test-List.md` (deleted)
  - `claude/PROMPT-LOG.md`

### [2026-03-03 07:00 UTC] — v2.74: File tag display labels (formatTagLabel)
- **Status:** Completed
- **Tasks:**
  - Added `KNOWN_ACRONYMS` set and `formatTagLabel()` helper in `ShipmentFilesTab.tsx`
  - Applied to file list row tag badges: `bl` → `BL`, `awb` → `AWB`, `packing_list` → `Packing List`, etc.
  - Applied to `UploadModal` and `EditTagsModal` tag selector buttons (falls back to `formatTagLabel(name)` when `tag_label` absent)
  - Display-only fix — stored tag values in DB/payloads/state remain lowercase
- **Files Modified:**
  - `af-platform/src/components/shipments/ShipmentFilesTab.tsx`

### [2026-03-03 06:30 UTC] — v2.73: Apply AWB/BC: ETD write + file save + consistency sweep
- **Status:** Completed
- **Tasks:**
  - Fix 1: `apply_awb` — write `flight_date` to flat `etd` column (route card ETD now updates)
  - Fix 2: New `POST /{shipment_id}/save-document-file` endpoint — saves AWB/BC/BL PDF to GCS + creates file record with correct tag; documents the post-apply file saving pattern
  - Fix 3: `apply_booking_confirmation` — write ETD/ETA flat columns unconditionally before route_nodes loop (V1 shipments with no route nodes now get ETD/ETA updated)
  - Fix 4a/4b: Consistency sweep — all three apply endpoints verified for flat column writes and JSONB booking field writes; no gaps found (BL already correct)
  - Fix 4c: File saving pattern documented as code comment on new endpoint
  - Fix 4d: TODO comment added in `apply_awb` noting task due-date recalculation is deferred
  - Fix 5 (Frontend): `saveDocumentFileAction` added to `shipments-files.ts`; `DocumentParseModal.onResult` signature extended to pass `file: File | null`; `page.tsx` calls `saveDocumentFileAction` after AWB/BC apply succeeds
- **Files Modified:**
  - `af-server/routers/shipments.py`
  - `af-platform/src/app/actions/shipments-files.ts`
  - `af-platform/src/components/shipments/DocumentParseModal.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
