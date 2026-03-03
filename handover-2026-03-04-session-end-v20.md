# Session Handover — Session 20 -> Session 21
**Date:** 04 March 2026
**Platform:** AcceleFreight v2 (af-cloud-v2)

---

## What Was Done This Session

### Session Parameters — Formalised
New working rules established for all future sessions:
- Claude AI (Sonnet): design discussion, architecture, high-level rationale, small MCP edits, handover files, prompt preparation
- VS Code (Opus): complex coding and file creation
- Handover files: repo root only, written on request
- Prompt: written to `claude/prompts/PROMPT-CURRENT.md`
- `af-web` workstream: parked indefinitely until decided

### Backlog Items Closed (screenshot verified)
- **UI-07** — BL apply packages not updated for LCL: CLOSED — confirmed working
- **UI-08** — BL apply cargo description not updated: CLOSED — confirmed working
- **UI-12** — BL apply packaging details not parsed/written: CLOSED — confirmed working

### Prompts Run This Session

**v3.16 — Fix LCL Container/Seal Not Saving After BL Apply**
Root cause: AI extraction prompt was ambiguous — Claude was routing LCL consolidation container into `containers[]` instead of `lcl_container_number`/`lcl_seal_number`. Fixed by replacing the ambiguous paragraph in `_BL_EXTRACTION_PROMPT` with explicit CONTAINER RULES block distinguishing FCL vs LCL patterns.
- File: `af-server/routers/shipments/_prompts.py`

**v3.17 — LCL Container Reference: Type Definition + Detail Page Display**
Root cause: `TypeDetailsLCL` lacked `container_number`/`seal_number` fields, and `TypeDetailsCard` had no rendering logic for them. Fixed both.
- Files: `af-platform/src/lib/types.ts`, `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`

### UI-11 — Fully Resolved
Required two prompts: v3.16 (extraction) + v3.17 (display). Confirmed via screenshot — Container Reference section now showing PCIU9526378 / MSC017994 correctly on detail page after LCL BL apply.

---

## Current Test Scores

| Suite | Total | YES | PENDING | DEFERRED | NA |
|---|---|---|---|---|---|
| All series | 284 | 270 | 8 | 12 | 9 |

**Overall: 270/284 passing (95.1%)**

Remaining 8 PENDING are all UI backlog items (low priority cosmetic/UX).
Remaining 12 DEFERRED are all mobile tests (MB series).

---

## Open Backlog (UI)

| # | Item | Priority | Notes |
|---|---|---|---|
| UI-01 | Keyboard arrow nav on combobox/dropdowns | Low | |
| UI-02/04 | Port list filtered by freight type in PortEditModal | Low | Same fix, two places |
| UI-03 | Port edit pencil icon position on RouteCard | Low | |

All BL apply backlog items (UI-07, UI-08, UI-11, UI-12) are now closed.

---

## Next Session Focus

**Design discussion: Geography, Pricing Tables, Pricing, and Quotation components.**

This is a net-new design workstream — these are not ports of existing functionality but new capabilities. Expect heavy design discussion before any prompts are written.

Topics to cover:
- Geography model: ports, zones, routes — what exists vs what's needed
- Pricing tables: rate card structure, surcharges, validity periods
- Pricing: how costs and margins are modelled
- Quotation: commercial quotation flow, line items, customer-facing output

Read the following files at session start:
1. This handover file
2. `claude/tests/AF-Test-Master.md`
3. `claude/other/AF-Backlog.md`
4. `af-platform/src/lib/types.ts` (CommercialQuotation + PricingLineItem already defined — relevant context)

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
| Types | af-platform/src/lib/types.ts |
| TypeDetailsCard | af-platform/src/app/(platform)/shipments/[id]/_components.tsx |
| BL prompts | af-server/routers/shipments/_prompts.py |
