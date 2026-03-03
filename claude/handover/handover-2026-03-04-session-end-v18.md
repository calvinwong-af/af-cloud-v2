# Session Handover — Session 18 -> Session 19
**Date:** 04 March 2026
**Platform:** AcceleFreight v2 (af-cloud-v2)

---

## What Was Done This Session

### Prompts Completed (Opus)

**v3.10 - BL Apply Completeness** (carried from Session 17)
- Packages card: cargo_items normalised to type_details.packages
- cargo_description + total_weight_kg written to cargo JSONB
- LCL container/seal: new lcl_container_number + lcl_seal_number fields end-to-end
- Terminal write-through: origin_terminal/dest_terminal accepted by backend

**v3.11 - BL Reparse Port Resolution (UI-15 + UI-16)**
- reparseDocumentFileAction now injects pol_code/pod_code from origin_un_code/destination_un_code - mirrors parseBLDocumentAction pattern
- Reparse onResult BL handler in ShipmentFilesTab.tsx updated to send origin_port/dest_port + terminals + new v3.10 fields
- DocumentParseModal.tsx useEffect simplified - stale data.parsed unwrap removed

**v3.12 - BLReview Port Combobox Fix (UI-15)**
- PortCombobox outside-click handler replaced: document.addEventListener mousedown -> onBlur + setTimeout(150)
- POL/POD onChange handlers batched into single setFormState calls - prevents stale closure on terminal clear
- Both comboboxes now fully interactive in fresh upload and reparse flows

### Tests Completed This Session

| # | Test | Result |
|---|---|---|
| DP-69 | Terminal clears when switching from terminal port | YES |
| DP-71 | LCL Packages card - normalised line items after apply | YES |
| DP-72 | Cargo description updates after BL apply | YES |
| DP-73 | Cargo weight updates after BL apply | YES |
| DP-74 | Container Reference section shown in BLReview for LCL | YES |
| DP-75 | LCL container + seal written as flat fields in type_details | YES |
| DP-76 | Terminal written to shipment when terminal port selected | YES |
| DP-78 | Read File reparse - POL/POD pre-selected (no amber warning) | YES |
| DP-79 | Read File reparse - apply not blocked by port validation | YES |
| DP-80 | Read File reparse - route card updates with correct ports | YES |
| DP-81 | Read File reparse - terminal selector appears for MYPKG | YES |
| DP-82 | BLReview port combobox - search and select working | YES |

### Bugs Resolved This Session
- UI-13 - Port combobox terminal clear on switch -> CLOSED (v3.10 + v3.12 batch fix)
- UI-15 - Port combobox not editable in BLReview -> CLOSED (v3.12 onBlur fix)
- UI-16 - Ports not auto-resolved on BL reparse -> CLOSED (v3.11 injection fix)

---

## Current Test Scores

| Suite | Total | YES | PENDING | FAIL | NA |
|---|---|---|---|---|---|
| DP | 82 | 78 | 1 | 1 | 1 |
| All series | 286 | 257 | 21 | 1 | 3 |

**Overall: 257/286 passing**

DP remaining: only DP-77 (legacy BLUpdateModal port fields - UI-14, deferred, dialog will be removed).

---

## Open Backlog (ACTIVE TODOS)

| # | Item | Priority |
|---|---|---|
| UI-01 | Keyboard arrow nav on all combobox/dropdowns | Low |
| UI-02/04 | Port list filtered by freight type in PortEditModal | Low |
| UI-03 | Port edit pencil icon position on RouteCard | Low |
| UI-05 | No ability to edit order details on detail page | Medium |
| UI-09 | Read File opens legacy dialog (all doc types) - route through DocumentParseModal | Medium |
| UI-14 | Legacy BLUpdateModal - port fields not resolving | Low - deferred, will be removed |

---

## Architecture Notes

### BL Apply - Two Flows (current state)
1. Fresh upload - DocumentParseModal -> BLReview -> _doc-handler.ts -> PATCH /bl (new flow - v3.08+)
   - Upload Document button on shipment detail page
   - Port combobox + terminal selector fully working (v3.12)
2. Read File (reparse) - ShipmentFilesTab -> DocumentParseModal -> BLReview -> updateShipmentFromBLAction (v3.11)
   - Now fully functional - ports pre-resolved, apply not blocked
   - Uses DocumentParseModal with initialDocType + initialParsedData
3. Legacy BLUpdateModal - still present but broken ports (UI-14), will be removed

### Key Infrastructure
- Production: https://af-server-667020632236.asia-northeast1.run.app
- LOCAL_DEV_SKIP_AUTH=true in af-platform .env.local for local dev token bypass
- Python venv: .venv (Python 3.11) - always use this, not system Python 3.14

---

## Key File Locations

| Item | Path |
|---|---|
| Prompt log | claude/prompts/log/PROMPT-LOG-v3.03-v3.12.md |
| Test master | claude/tests/AF-Test-Master.md |
| DP test series | claude/tests/series/DP-document-parse.md |
| Backlog | claude/other/AF-Backlog.md |
| BLReview | af-platform/src/components/shipments/_doc-parsers/BLReview.tsx |
| ShipmentFilesTab | af-platform/src/components/shipments/ShipmentFilesTab.tsx |
| shipments-files.ts | af-platform/src/app/actions/shipments-files.ts |
| DocumentParseModal | af-platform/src/components/shipments/DocumentParseModal.tsx |

---

## Next Actions (in order)
1. No prompt queued - PROMPT-CURRENT.md is v3.12 (completed)
2. Apply same PortCombobox onBlur fix to BCReview.tsx - same combobox pattern, likely same bug
3. Address UI-09 - route Read File through DocumentParseModal for all doc types, removing legacy BLUpdateModal
4. Review remaining active series: DT (15 pending), VD (2 pending), PP (1 pending), BUG2 (1 deferred)
5. Begin next module planning
