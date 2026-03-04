# Session Handover — 03 March 2026 (Session 10 End)
**Platform Version:** v2.92 live on production (commit 03194a3)
**Test Master:** v2.56 — 210/250 passing, 32 pending
**Handover written:** End of Session 10

---

## What Was Done This Session

### v2.89 Carry-over Testing ✅
Verified all v2.89 fixes from Session 9:
- Issues 4 & 5 confirmed fixed (packages card, chargeable weight, port filtering)
- DP-49, 50, 51, 52 added and marked YES

### v2.90 — File Save Deep Fix ✅
- Switched from `saveDocumentFileAction` to `uploadShipmentFileAction` in both
  `_doc-handler.ts` (apply flow) and `CreateShipmentModal.tsx` (create flow)
- Root cause was Next.js server action boundary serialisation dropping file bytes
- Confirmed working locally after GCS permission was granted to service account

### v2.91 — Async Claude API Fix ✅
- Replaced sync `_call_claude` with async `_call_claude_async` using `AsyncAnthropic`
- Added 30s timeout + `APITimeoutError` → clean HTTP 503
- Resolves 80,000ms parse timeout caused by blocking the uvicorn event loop
- Also coincided with Anthropic API outage (Mar 2–3) — both issues now resolved

### v2.92 — Files Tab Fixes + Cleanup ✅
- `_helpers.py`: `user` field now mapped from `uploaded_by_email` — shows correctly
- `ShipmentFilesTab.tsx`: "Read file again" button now appears for `bl`, `awb`, `bc` tags
- `_doc-handler.ts`: Removed diagnostic `console.info` logs (kept `console.error`)
- `doc_apply.py`: Docstring updated to reflect current file saving contract

---

## Test Results This Session

| # | Test | Result |
|---|---|---|
| DP-36 | AWB file saved to Files tab after create flow | ✅ YES |
| DP-39 | AWB file saved to Files tab after apply flow | ✅ YES |
| DP-40 | Files tab badge updates without page reload | ✅ YES |
| DP-49 | Packages card shows pieces + weight after AWB create | ✅ YES |
| DP-50 | Chargeable weight shown on AIR shipment after AWB create | ✅ YES |
| DP-51 | Port edit modal shows only airports for AIR shipments | ✅ YES |
| DP-52 | Port edit modal shows only sea ports for SEA shipments | ✅ YES |

---

## Known Issues / Backlog

| # | Item | Priority |
|---|---|---|
| FILE-01 | File size shows "Unknown" — `file_size_kb` not mapping to frontend `file_size` | Medium |
| FILE-02 | "Read file again" on AWB/BC files attempts BL reparse flow — needs AWB/BC specific reparse endpoints | Low |
| FILE-03 | "Read file again" on AWB parses poorly — uses BL extraction prompt instead of AWB prompt, returns vessel/port fields instead of AWB fields | Medium |
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
| Commit | 03194a3 — v2.91 + v2.92 — deployed ✅ |
| ANTHROPIC_API_KEY | Secret Manager — mounted in Cloud Run |
| PostgreSQL migration | Complete |
| Datastore write dependencies | createShipmentOrder() + deleteShipmentOrder() — still pending |
| Local GCS permissions | Storage Object Creator granted to af-server service account |

---

## Next Session Priorities

1. **Fix file size "Unknown"** (FILE-01) — small server-side mapping fix
3. **DT series sweep** — 15 datetime tests all untouched, good standalone candidate
4. **BC PDF tests** — DP-06, 09, 10, 11, 15, 16 using AYN1317670

---

## File Locations (reminder)

| File | Path |
|---|---|
| Handover | claude/handover/ |
| Active prompt | claude/prompts/PROMPT-CURRENT.md |
| Test master | claude/tests/AF-Test-Master.md |
| Test series | claude/tests/series/ |
| Prompt log | claude/prompts/log/PROMPT-LOG-v2.83-v2.92.md |
