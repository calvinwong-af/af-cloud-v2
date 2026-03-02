# Handover — 03 March 2026 (Session End — v2.78 running)

## Session Summary
This session covered v2.77 verification, test ticking (DP-41/43-46), optimisation
planning discussion, prompt sequence restructure (v2.78→v2.81), and writing the
v2.78 prompt. v2.78 is currently running in Opus.

---

## Current System State

### Versions
| Item | Value |
|---|---|
| Last completed prompt | v2.77 ✅ |
| Currently running | v2.78 (Opus — page.tsx split) |
| Next prompt | v2.79 (DocumentParseModal split) |
| Test master version | 2.51 |
| Prompt log file | claude/prompts/log/PROMPT-LOG-v2.73-v2.82.md |

### Stats (unchanged)
| Metric | Value |
|---|---|
| Total Orders | 2,043 |
| Active | 23 |
| Completed | 2,019 |
| Draft | 1 |
| To Invoice | 8 |

---

## What Was Done This Session

### v2.77 — Verified Complete
- 10-file package confirmed in `routers/shipments/`
- `routers/shipments.py` confirmed deleted
- Smoke test: all 3 endpoints returned auth 401 (correct — not 404/500)
- Backlog updated: v2.77 marked ✅ Complete

### DP Tests Ticked
| Test | Result |
|---|---|
| DP-41 | YES — amber diff badge shown in parser dialog |
| DP-43 | YES — "Applying..." spinner confirmed |
| DP-44 | YES — modal non-dismissible during apply |
| DP-45 | YES — success state ~800ms confirmed |
| DP-46 | YES — Files tab badge updates after AWB apply |
| DP-48 | PENDING — new test added: AWB diff shown in dialog but NOT on details page |

DP series now: 48 total, 22 YES, 22 PENDING

### Optimisation Planning Discussion
Key decisions made:
- One concern per prompt going forward (not combined prompts)
- DocumentParseModal needs doc type plugin pattern (not just file split)
- User data must migrate from Datastore to PostgreSQL — v2.81
- V1/V2 conditional branching should not exist in API — confirmed all data
  is in unified PostgreSQL structure, data_version tag is display-only only
- AFCQ- prefix records: workflow skip during migration is a known gap to revisit
- API contract document needed before AI agent phase

### Prompt Sequence Restructured
| Prompt | Item | Status |
|---|---|---|
| v2.77 | shipments.py split | ✅ Complete |
| v2.78 | page.tsx split (shell + _components + _doc-handler) | 🔄 Running in Opus |
| v2.79 | DocumentParseModal — doc type plugin pattern + fix DP-48 | Planned |
| v2.80 | BLUploadTab + BLUpdateModal + CreateShipmentModal split | Planned |
| v2.81 | User migration — Datastore → PostgreSQL | Planned |

### v2.78 Prompt Written
Saved to `claude/prompts/PROMPT-CURRENT.md`. Key details:
- 3-file split: page.tsx shell + _components.tsx + _doc-handler.ts
- page.tsx target: ~150-200 lines after extraction
- _components.tsx: all sub-components + inline modals + STATUS_STYLES + helpers
- _doc-handler.ts: createDocResultHandler() factory (~50-60 lines)
- STATUS_STYLES must be re-exported from _components.tsx (used in both files)
- flagExceptionAction lazy import inside StatusCard must be preserved as-is
- No other files to be modified

---

## What To Do Next Session

1. **Verify v2.78** when Opus finishes:
   - `npm run dev` — zero TypeScript errors
   - Navigate to `/shipments/AF-003861` — page loads
   - All tabs work (Overview / Tasks / Files)
   - Upload Document button opens DocumentParseModal
   - Check `[id]/` directory has exactly 3 files: page.tsx, _components.tsx, _doc-handler.ts

2. **Continue optimisation planning** — items to discuss:
   - API contract document: what a shipment object, user object, parties object
     always looks like — write this before AI agent phase
   - AFCQ- workflow gap: verify if orphaned workflows need cleanup
   - Rolling handover policy: keep last 3 files, archive older ones

3. **Write v2.79 prompt** — DocumentParseModal doc type plugin pattern:
   - Split into AWBReview, BCReview, BLReview sub-components
   - Fix DP-48: AWB diff badge not showing on shipment details page after apply
   - Each doc type owns its own review section — extensible for future doc types

---

## Key Architecture Decisions (This Session)

### Optimisation Principles Agreed
- One prompt = one responsibility. No combined prompts.
- Tight content allocation in every Opus prompt — Opus executes, doesn't reason about structure
- API contract document before AI agent phase (v2.82 or similar)
- User migration to PostgreSQL at v2.81 — remove Datastore entirely

### Data Architecture Confirmed
- All shipment data in PostgreSQL — unified V2 structure
- data_version field is display-only ('V1 Legacy' tag) — no conditional branching
- Datastore remaining dependency: user/auth records only (core/auth.py)
- V2.81 removes this last dependency completely

### Test DP-48 — AWB Diff on Details Page
- Dialog shows diff correctly (DP-41 ✅)
- Details page Parties card does NOT show diff after AWB apply
- Root cause: PartiesCard uses `order.bl_document` for diff — AWB apply does not
  write to bl_document field, so diff logic never fires for AWB
- Fix: v2.79 — after AWB apply, store parsed parties in a separate awb_parties
  field on shipment, and update PartiesCard to check both bl_document and awb_parties

---

## Files Modified This Session
| File | Change |
|---|---|
| `claude/tests/series/DP-document-parse.md` | DP-41/43-46 → YES, DP-48 added |
| `claude/tests/AF-Test-Master.md` | DP counts updated: 48 total, 22 YES, 22 PENDING |
| `claude/other/AF-Backlog.md` | v2.77 marked complete, v2.78-v2.81 restructured |
| `claude/prompts/PROMPT-CURRENT.md` | v2.78 prompt written |
| `claude/handover/handover-2026-03-03-session-end-v3.md` | This file |
