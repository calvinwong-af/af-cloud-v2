# Session Handover — Session 16 → Session 17
**Date:** 03 March 2026
**Platform:** AcceleFreight v2 (af-cloud-v2)

---

## What Was Done This Session

### Issues Investigated
1. **Port code resolution (v3.06) working on backend but not showing in BLReview combobox**
   — Root cause: `DocumentParseModal` calls two parse endpoints for BL; the second (`/parse-bl`) returns resolved codes at the top level but `parseBLDocumentAction` discarded them. Fix: inject `origin_un_code` / `destination_un_code` into the `parsed` object before returning.

2. **NINGBO alias resolving to `CNNBO` — not in database**
   — Database has `CNNGB`, not `CNNBO`. Fixed alias map in `_helpers.py`. Coding standard added: fix port aliases as encountered, ports table is source of truth.

3. **Terminal selector for multi-terminal ports (v3.07)**
   — MYPKG (Port Klang) has Westport/Northport. Added conditional `<select>` below PortCombobox in BLReview and BCReview when `has_terminals: true`.

4. **Production parse endpoint 500 error (v3.06 regression)**
   — `conn = Depends(get_db)` was added in v3.06, `Connection` type annotation removed in a follow-up. But 500 persists on Cloud Run. Diagnosis: the `get_db` dependency is interfering with `os.environ.get("ANTHROPIC_API_KEY")` on Cloud Run (confirmed because frontend shows "ANTHROPIC_API_KEY" in error detail, meaning endpoint body IS running). Fix written into prompt — remove `conn` from signature entirely, use `get_db_direct()` manually inside Step 3 try/except.

5. **BLUpdateModal appearing after "Use This Data"**
   — `_doc-handler.ts` BL branch intentionally opened the legacy `BLUpdateModal` as a second step. Now that `BLReview` is the review UI, this must be bypassed. Fix written into prompt — apply BL directly via `updateShipmentFromBLAction` FormData call, same pattern as AWB and BC.

### Files Modified (confirmed code changes applied)
| File | Change |
|---|---|
| `af-platform/src/app/actions/shipments-files.ts` | Inject `origin_un_code`/`destination_un_code` into `parsed` in `parseBLDocumentAction` |
| `af-server/routers/shipments/_helpers.py` | NINGBO alias `CNNBO` → `CNNGB` |
| `af-platform/src/components/shipments/_doc-parsers/BLReview.tsx` | Conditional terminal selector for POL/POD |
| `af-platform/src/components/shipments/_doc-parsers/BCReview.tsx` | Conditional terminal selector for POL/POD |
| `af-server/routers/ai.py` | Removed `Connection` type annotation (partial fix — full fix in PROMPT-CURRENT) |
| `AF-Coding-Standards.md` | Added § 16: port alias fix-as-encountered rule |

---

## PROMPT-CURRENT Status

**File:** `claude/prompts/PROMPT-CURRENT.md`
**Version:** v3.08 + v3.09 (combined — ready to run with Opus)

Three parts, all self-contained:

### Part A — Production 500 Fix (`af-server/routers/ai.py`)
Remove `conn = Depends(get_db)` from `parse_document` signature. Acquire connection
manually inside Step 3 try/except using `get_db_direct()` with explicit `conn.close()`
in a finally block. Remove any remaining `get_db` import from `ai.py`.

**Key context for Opus:**
- `LOCAL_DEV_SKIP_AUTH=true` bypass exists in `core/auth.py` — added in a previous
  session for local dev token workaround. Never active on Cloud Run. Not the failure point.
- `core/db.py` already reviewed: Cloud Run uses pg8000 + Cloud SQL connector;
  `get_db_direct()` exists and returns a raw connection (caller closes).
- The endpoint body IS running (API key check is hit) — so this is not a dep injection
  crash. The `get_db` dependency is likely interfering with `os.environ` on Cloud Run.

### Part B — Bypass BLUpdateModal (`_doc-handler.ts`)
Replace 4-line BL branch with direct `updateShipmentFromBLAction` FormData call.
Data shape uses `Record<string, unknown>` (not `ParsedBL`) because `BLReview` augments
formState with `pol_code`/`pod_code`/`pol_terminal`/`pod_terminal`.
`setShowBLModal`, `setDocParseBLData`, `setPendingBLFile` stay in params — still used
by ShipmentFilesTab reparse flow.

### Part C — Terminal Selector in BLReview + BCReview
Conditional `<select>` below PortCombobox when `has_terminals: true`. Port change
handler clears terminal when switching to port without terminals. (Already applied
in this session but included in prompt in case Opus needs to re-verify or fix.)

---

## Test Status

**229/266 passing, 29 pending, 12 deferred**

### Pending tests to run after PROMPT-CURRENT completes:
| Test | Description | Blocker |
|---|---|---|
| DP-55 | `_is_booking_relevant()` FOB import → True | Needs local dev run |
| DP-56 | `_is_booking_relevant()` FOB export → False | Needs local dev run |
| DP-57 | apply-bl Path A (FOB import) → status 3002 | Needs local dev run |
| DP-58 | apply-bl Path B past date → status 4001 | Needs local dev run |
| DP-59 | apply-bl Path B future date → status 3002 | Needs local dev run |
| DP-60 | apply-awb Path A (FCA import) → status 3002 | Was blocked by token issue; bypass now in place |

### New tests to add after this session's changes:
| Test ID | Description |
|---|---|
| DP-63 | BL "Use This Data" applies directly — no BLUpdateModal opens |
| DP-64 | apply-bl via new flow — vessel, BL No, ETD, ports, parties all update |
| DP-65 | apply-bl via new flow — BL file appears in Files tab |
| DP-66 | Files tab reparse still opens BLUpdateModal (existing flow unaffected) |
| DP-67 | Terminal selector appears for MYPKG in BLReview |
| DP-68 | Terminal selector appears for MYPKG in BCReview |
| DP-69 | Changing port to one without terminals clears terminal field |
| DP-70 | Production parse endpoint — no 500 on Cloud Run after fix |

---

## Architecture Notes (for next session)

### Two separate BL upload flows
1. **`DocumentParseModal` → BLReview → `_doc-handler.ts`** (new flow — PROMPT-CURRENT fixes this)
   - Triggered by "Upload Document" button on shipment detail page
   - Port combobox + terminal selector in BLReview
   - After fix: calls `updateShipmentFromBLAction` directly

2. **`ShipmentFilesTab` → BLUpdateModal** (legacy flow — untouched)
   - Triggered from Files tab "Upload BL" or file reparse
   - Has its own port combobox (no terminal selector yet)
   - `setShowBLModal` / `setDocParseBLData` / `setPendingBLFile` still wired for this

### Port resolution flow (BL documents)
1. `/api/v2/ai/parse-document` → classifies + extracts, resolves `pol_code`/`pod_code` (Step 3, non-fatal)
2. `/api/v2/shipments/parse-bl` → richer BL extraction, returns `origin_un_code`/`destination_un_code` at top level
3. `parseBLDocumentAction` injects resolved codes into `parsed` object
4. `BLReview` receives pre-filled `pol_code`/`pod_code` in formState

### Local dev auth bypass
`LOCAL_DEV_SKIP_AUTH=true` in `.env.local` skips Firebase + DB user lookup.
Returns hardcoded AFU-ADMIN claims. Never set on Cloud Run.

---

## Key File Locations

| Item | Path |
|---|---|
| Prompt (ready to run) | `claude/prompts/PROMPT-CURRENT.md` |
| Prompt log | `claude/prompts/log/PROMPT-LOG-v3.03-v3.12.md` |
| Test master | `claude/tests/AF-Test-Master.md` |
| DP test series | `claude/tests/series/DP-document-parse.md` |
| Coding standards | `AF-Coding-Standards.md` |
| Parse endpoint | `af-server/routers/ai.py` |
| DB core | `af-server/core/db.py` |
| Auth core | `af-server/core/auth.py` |
| Port helpers | `af-server/routers/shipments/_helpers.py` |
| BL parse action | `af-platform/src/app/actions/shipments-files.ts` |
| Doc result handler | `af-platform/src/app/(platform)/shipments/[id]/_doc-handler.ts` |
| BLReview | `af-platform/src/components/shipments/_doc-parsers/BLReview.tsx` |
| BCReview | `af-platform/src/components/shipments/_doc-parsers/BCReview.tsx` |
| BLUpdateModal (legacy) | `af-platform/src/components/shipments/BLUpdateModal.tsx` |

---

## Next Actions (in order)
1. Run PROMPT-CURRENT with Opus
2. Deploy to Cloud Run and verify production parse works (DP-70)
3. Run DP-55–60 on local dev (token bypass is in place, should work now)
4. Add DP-63–70 to test master
5. Update prompt log with v3.08/v3.09 completion entry
