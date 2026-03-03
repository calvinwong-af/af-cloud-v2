# Session Handover — Session 19 -> Session 20
**Date:** 04 March 2026
**Platform:** AcceleFreight v2 (af-cloud-v2)

---

## What Was Done This Session

### Backlog Items Closed (no code required)
- **UI-05** — Edit Order Details: CLOSED — IncotermEditModal already live on RouteCard; order_type + transaction_type scoped read-only by design decision
- **UI-09** — Read File legacy dialog: CLOSED — ShipmentFilesTab always routed through DocumentParseModal (v3.11); BLUpdateModal deletion in v3.15 removes last legacy path
- **UI-13** — Port combobox terminal clear: CLOSED (v3.12 + v3.15)
- **UI-14** — BLUpdateModal port fields broken: CLOSED — BLUpdateModal deleted in v3.15
- **UI-16** — Dead state cleanup: CLOSED — handled inline in v3.15 scope

### Bug Fix (MCP direct edit)
- **DateTimeInput default time** — `DateInput.tsx` `useEffect` on open was falling back to `new Date()` for hour/minute when no value set, causing time picker to show current time instead of 00:00. Fixed: calendar nav still uses `new Date()` for month/year, but hour/minute now default to 0 when value is empty.

### Prompt v3.15 — Prepared but NOT yet run
Scope: BCReview combobox fix + StepRoute combobox fix + BLUpdateModal deletion + reference cleanup.
File: `claude/prompts/PROMPT-CURRENT.md`
**This prompt must be run first thing next session.**

### Test Suite — Major Progress
All active series cleared of pending tests (except BUG2-02 which is deferred to mobile pass):

| Series | Result |
|---|---|
| DT | ✅ Complete — 10 YES, 5 NA (BLUpdateModal), 00:00 default bug fixed |
| DP | ✅ Complete — 79 YES, 2 NA |
| VD | ✅ Complete — 7 YES |
| PP | ✅ Complete — 9 YES |

---

## Current Test Scores

| Suite | Total | YES | PENDING | DEFERRED | NA |
|---|---|---|---|---|---|
| All series | 284 | 270 | 8 | 12 | 9 |

**Overall: 270/284 passing (95.1%)**

Remaining 8 PENDING are all UI backlog items (BL apply completeness), not test suite gaps.
Remaining 12 DEFERRED are all mobile tests (MB series).

---

## Open Backlog (UI)

| # | Item | Priority | Notes |
|---|---|---|---|
| UI-01 | Keyboard arrow nav on combobox/dropdowns | Low | |
| UI-02/04 | Port list filtered by freight type in PortEditModal | Low | Same fix, two places |
| UI-03 | Port edit pencil icon position on RouteCard | Low | |
| UI-07 | BL apply — packages not updated for LCL | Medium | Backend + frontend |
| UI-08 | BL apply — cargo description not updated | Medium | Backend + frontend |
| UI-11 | BL apply (LCL) — container + seal stored separately | Medium | Old BLUpdateModal did this correctly |
| UI-12 | BL apply — packaging details not parsed/written | Medium | qty, gross weight, volume |

---

## Prompt Queue

**Empty** — v3.15 already completed (confirmed via prompt log). No prompt queued for next session.

---

## Next Session Focus
**Calvin wants to discuss maintenance and performance improvement.**
This is a design/architecture discussion — no coding prompt queued beyond v3.15.

Topics likely to cover:
- Bundle size / Next.js performance (large component files, code splitting)
- Cloud Run cold start / response time
- Database query performance (PostgreSQL indexes, N+1 patterns)
- Frontend render performance (unnecessary re-renders, large state objects)
- Monitoring / observability gaps
- Dependency audit / version hygiene
- Any technical debt items not yet in backlog

Read the following files at session start to establish context:
1. This handover file
2. `claude/tests/AF-Test-Master.md`
3. `claude/other/AF-Backlog.md`

---

## Key Infrastructure
- Production backend: `https://af-server-667020632236.asia-northeast1.run.app`
- Frontend: `appv2.accelefreight.com` | API: `api.accelefreight.com`
- Python venv: `.venv` (Python 3.11) — always use, not system Python 3.14
- LOCAL_DEV_SKIP_AUTH=true in af-platform `.env.local` for local dev token bypass

## Key File Locations

| Item | Path |
|---|---|
| Prompt current | claude/prompts/PROMPT-CURRENT.md |
| Prompt log | claude/prompts/log/PROMPT-LOG-v3.13-v3.22.md |
| Test master | claude/tests/AF-Test-Master.md |
| Backlog | claude/other/AF-Backlog.md |
| DateInput fix | af-platform/src/components/shared/DateInput.tsx |
| BCReview (combobox pending fix) | af-platform/src/components/shipments/_doc-parsers/BCReview.tsx |
| StepRoute (combobox pending fix) | af-platform/src/components/shipments/_create-shipment/StepRoute.tsx |
| BLUpdateModal (pending deletion) | af-platform/src/components/shipments/BLUpdateModal.tsx |
| _doc-handler (pending cleanup) | af-platform/src/app/(platform)/shipments/[id]/_doc-handler.ts |
| page.tsx (pending cleanup) | af-platform/src/app/(platform)/shipments/[id]/page.tsx |
