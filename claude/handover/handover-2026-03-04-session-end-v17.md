# Session Handover — Session 17 → Session 18
**Date:** 04 March 2026
**Platform:** AcceleFreight v2 (af-cloud-v2)

---

## What Was Done This Session

### Tests Run & Completed
- **DP-48** YES — Persistent diff badge on Parties card after AWB apply confirmed (AF-003864, amber badge on CONSIGNEE)
- **DP-63** YES — BL "Use This Data" applies directly, no legacy BLUpdateModal
- **DP-64** YES — All fields (vessel, BL No, ETD, ports, parties) update after BL apply
- **DP-65** YES — BL file appears in Files tab after apply
- **DP-66** YES — Files tab "Read File" still opens legacy BLUpdateModal (expected)
- **DP-67** YES — Terminal selector appears for MYPKG in BLReview
- **DP-68** YES — Terminal selector appears for MYPKG in BCReview
- **DP-69** FAIL — Bug: switching away from terminal port does not clear terminal state (UI-13)
- **DP-70** YES — Production parse endpoint working after ANTHROPIC_API_KEY fix

### DP-63–70 Added to Test Suite
8 new tests added to `DP-document-parse.md`. Total now 70 tests (66 YES, 1 PENDING, 1 FAIL, 1 NA).

### Backlog Items Added
- **UI-11** — LCL BL apply: container + seal should be stored as flat fields, not in containers array
- **UI-12** — BL apply: packaging details (qty, weight, volume) not written; cargo_description not written
- **UI-13** — Port combobox: switching from terminal port fails to clear terminal state (DP-69 bug)
- **UI-14** — Legacy BLUpdateModal: port fields not resolving (low priority, will be removed eventually)

### PROMPT-CURRENT written (v3.10)
Three-fix prompt covering UI-11, UI-12, UI-13, and the terminal write-through (partial fix for UI-13):
1. **Fix 1** — Packaging details: normalise `cargo_items` → `type_details["packages"]`; write `cargo_description` + `total_weight_kg` to `cargo` JSONB
2. **Fix 2** — LCL container/seal: new `lcl_container_number` + `lcl_seal_number` fields in extraction prompt, BLReview, backend
3. **Fix 3** — Terminal write-through: backend accepts `origin_terminal`/`dest_terminal`; frontend uncomments those lines; DP-69 bug fixed by always clearing terminal on port change

---

## Current Test Scores

| Suite | Total | YES | PENDING | FAIL | NA |
|---|---|---|---|---|---|
| DP | 77 | 66 | 7 | 2 | 1 |
| All series | 281 | 245 | 27 | 2 | 3 |

**Overall: 245/274 passing**

---

## PROMPT-CURRENT Status

**File:** `claude/prompts/PROMPT-CURRENT.md`
**Version:** v3.10 — Ready to run with Opus

### Files to Modify
- `af-server/routers/shipments/bl.py`
- `af-server/routers/shipments/_prompts.py`
- `af-platform/src/app/(platform)/shipments/[id]/_doc-handler.ts`
- `af-platform/src/components/shipments/_doc-parsers/BLReview.tsx`

---

## Active Backlog (ACTIVE TODOS)

| # | Item | Priority |
|---|---|---|
| UI-01 | Keyboard arrow nav on all combobox/dropdowns | Low |
| UI-02/04 | Port list filtered by freight type in PortEditModal | Low |
| UI-03 | Port edit pencil icon position on RouteCard | Low |
| UI-05 | No ability to edit order details on detail page | Medium |
| UI-07 | BL apply — packages not updated for LCL | → v3.10 |
| UI-08 | BL apply — cargo description not written | → v3.10 |
| UI-09 | "Read File" opens legacy dialog | Deferred — remove legacy modal in future |
| UI-11 | LCL BL apply — container + seal stored separately | → v3.10 |
| UI-12 | BL apply — packaging details not parsed/written | → v3.10 |
| UI-13 | Port combobox — switching from terminal port fails | → v3.10 |
| UI-14 | Legacy BLUpdateModal — port fields not resolving | Low — will be removed |

---

## Architecture Notes

### BL Apply — Two Flows
1. **DocumentParseModal → BLReview → `_doc-handler.ts` → `PATCH /bl`** (new flow — v3.08+)
   - "Upload Document" button on shipment detail page
   - Port combobox + terminal selector in BLReview
   - Calls `updateShipmentFromBLAction` directly

2. **Files tab "Read File" → BLUpdateModal** (legacy flow — untouched)
   - Triggered from Files tab
   - Ports NOT resolving in legacy dialog (UI-14, low priority)
   - Will be removed once new flow fully validated

### Key Infrastructure
- Production: `https://af-server-667020632236.asia-northeast1.run.app` (direct Cloud Run URL — bypass Cloudflare for server-to-server)
- ANTHROPIC_API_KEY now set in af-server Cloud Run env vars
- `LOCAL_DEV_SKIP_AUTH=true` in af-platform `.env.local` for local dev token bypass

---

## Key File Locations

| Item | Path |
|---|---|
| Prompt (ready) | `claude/prompts/PROMPT-CURRENT.md` |
| Prompt log | `claude/prompts/log/PROMPT-LOG-v3.03-v3.12.md` |
| Test master | `claude/tests/AF-Test-Master.md` |
| DP test series | `claude/tests/series/DP-document-parse.md` |
| Backlog | `claude/other/AF-Backlog.md` |
| BL router | `af-server/routers/shipments/bl.py` |
| BL prompts | `af-server/routers/shipments/_prompts.py` |
| Doc handler | `af-platform/src/app/(platform)/shipments/[id]/_doc-handler.ts` |
| BLReview | `af-platform/src/components/shipments/_doc-parsers/BLReview.tsx` |

---

## Next Actions (in order)
1. Run v3.10 prompt with Opus
2. Test on LCL shipment — verify packages card, cargo description, container/seal, terminal write-through, DP-69 fix
3. Mark DP-69 YES once terminal port switching confirmed working
4. Update prompt log with v3.10 entry
5. Move to next module (post-DP work)
