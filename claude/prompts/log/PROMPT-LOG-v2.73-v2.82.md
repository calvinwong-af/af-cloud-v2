# Prompt Completion Log — v2.73–v2.82

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
