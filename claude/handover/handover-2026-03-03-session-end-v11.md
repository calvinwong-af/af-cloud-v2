# Session Handover — 03 March 2026 (Session 11 End)
**Platform Version:** v2.95 (local — not yet deployed)
**Test Master:** v2.57 — 211/250 passing, 31 pending
**Handover written:** End of Session 11

---

## What Was Done This Session

### v2.93 — PROMPT-CURRENT written (FILE-02/03: Read File Again routing)
Prompt written and saved to `claude/prompts/PROMPT-CURRENT.md`. Not yet executed.
- New `reparseDocumentFileAction` server action routes AWB/BC to `/ai/parse-document` with correct hint
- `handleReparse` rewritten to be doc-type-aware via `docTypeFromTags` helper
- Opens correct modal per doc type (BLUpdateModal for BL, new result display for AWB/BC)
- Opus prompt is ready to pass to VS Code

### v2.94 — FILE-01 Fixed (MCP) ✅
- `ShipmentFile` TypeScript type: `file_size` renamed to `file_size_kb` in `shipments-files.ts`
- `ShipmentFilesTab.tsx`: render call updated from `file.file_size` → `file_size_kb`
- Confirmed working: screenshot shows "228 KB" displaying correctly

### v2.95 — Three backend fixes (MCP) ✅

**Fix 1 — AWB create: initial status now uses flight_date**
- `af-server/routers/shipments/bl.py`
- AWB parse path previously hardcoded `STATUS_BOOKING_CONFIRMED`
- Now calls `_determine_initial_status(parsed.get("flight_date"))` — same logic as BL uses `on_board_date`
- Past flight date → STATUS_DEPARTED (4001); future/absent → STATUS_BOOKING_CONFIRMED (3002)

**Fix 2 — CNF_IMPORT added to Path A status combos**
- `af-platform/src/lib/types.ts`
- `CNF_IMPORT` added to `_PATH_A_COMBOS`
- Root cause: AF-003876 is CNF + IMPORT — `CNF_IMPORT` was missing so `getStatusPath` returned Path B
- Path B (`[1001, 1002, 2001, 4001, 4002, 5001]`) doesn't contain status 3002 → `currentIdx = -1` → all nodes rendered empty
- Confirmed fixed: status tracker now shows Pre-op ✅ Confirmed ✅ Booking ✅ (Bkg Confirmed) with correct "Advance to Departed" button

---

## Test Results This Session

| # | Test | Result |
|---|---|---|
| FILE-01 | File size shows correctly in Files tab (not "Unknown") | ✅ YES |

---

## Known Issues / Backlog

| # | Item | Priority |
|---|---|---|
| FILE-02 | "Read file again" on AWB/BC files attempts BL reparse flow — prompt written (v2.93), not yet executed | High |
| FILE-03 | "Read file again" on AWB parses with wrong prompt — same fix as FILE-02 | High |
| UI-01 | Keyboard arrow nav on all dropdowns | Medium |
| UI-03 | Pencil icon position on RouteCard | Low |
| UI-05 | Edit order details (type/incoterm/transaction) on detail page | Medium |

---

## Pending DP Tests (9 remaining)

| Test | Notes |
|---|---|
| DP-06, 09, 10, 11 | Need AYN1317670 BC PDF |
| DP-15, 16, 37, 38 | BC apply flow |
| DP-42 | No diff badge when parsed shipper matches |
| DP-47 | Files tab badge after BC apply |
| DP-48 | AWB diff badge on shipment details page |

---

## System State

| Item | State |
|---|---|
| Production | v2.92 live — appv2.accelefreight.com |
| Local | v2.95 — not yet deployed (3 MCP fixes + 1 prompt ready) |
| Commit needed | FILE-01 fix, AWB initial status fix, CNF_IMPORT path fix |
| PROMPT-CURRENT | v2.93 — FILE-02/03 Read File Again routing — READY for Opus |
| PostgreSQL migration | Complete |
| Datastore write dependencies | createShipmentOrder() + deleteShipmentOrder() — still pending |

---

## Next Session Priorities

1. **Deploy v2.95** — commit and push the 3 MCP fixes
2. **Execute PROMPT-CURRENT (v2.93)** — pass to Opus in VS Code for FILE-02/03 fix
3. **DT series sweep** — 15 datetime tests, clean standalone module
4. **BC PDF tests** — DP-06, 09, 10, 11, 15, 16 using AYN1317670

---

## File Locations (reminder)

| File | Path |
|---|---|
| Handover | claude/handover/ |
| Active prompt | claude/prompts/PROMPT-CURRENT.md |
| Test master | claude/tests/AF-Test-Master.md |
| Test series | claude/tests/series/ |
| Prompt log | claude/prompts/log/ |
