# AF Dev Handover — Session 126 End — v6.60

**Date:** 2026-03-13
**Session:** 126
**Live on Cloud Run:** v6.38
**Prompt version at close:** v6.60 (in PROMPT-CURRENT.md, not yet run in Opus)
**Tests:** v2.61 (272/286) — no changes this session

---

## What Was Done This Session

### Prompts completed (Opus)
- **v6.57** — Quotation detail UX overhaul: merged scope+transport card, collapsible groups with subtotals, indented rows, Other Charges group, area name fetch (URL fixed to `/api/v2/geography/areas`)
- **v6.58** — Quotation ref format `AF-003859-Q1`, cargo ready date as `ref_date`, scope-gated local/DG warnings
- **v6.59** — Company name in header, order_type-based transport labels (Haulage/Transport), ASSIGNED-only scope display, column-aligned subtotals (multi-cell `<tr>`), Other Charges conditional visibility + button below table

### Direct MCP fix (this session, geography.py)
**Area name bug fixed directly** — `af-server/routers/geography.py` `list_areas` function.

**Root cause:** `bindparam("ids", expanding=True)` (SQLAlchemy IN-expansion) was combined with `= ANY(:ids)` (PostgreSQL array syntax) — these two approaches conflict. SQLAlchemy tried to expand the list into individual params; PostgreSQL expected an array. Query returned nothing, frontend fell back to `"Area ${td.area_id}"`.

**Fix:** Removed `expanding=True` and the `bindparam` import. Passing a plain Python `list` to psycopg2 via SQLAlchemy correctly binds as a PostgreSQL integer array, compatible with `= ANY(:ids)`. File rewritten in full (str_replace unreliable on this path).

**Restart the local uvicorn server to pick up this change.**

### Prompt ready for next session
**v6.60** is written in `PROMPT-CURRENT.md`. Run in Opus at start of next session.

**v6.60 scope** (2 files: `page.tsx` + `_components.tsx`):
1. `page.tsx` → async server component, resolves `accountType` via `verifySessionAndRole`, passes as prop
2. UOM dropdown in manual item form + edit row (`SHIPMENT, CONTAINER, CBM, KG, W/M, CW_KG, SET, BL, QTL, RAIL_3KG`)
3. `+ Add Manual Item` button moved into totals bar flex row (left side), saves vertical space
4. AFU/Customer view toggle — pill button in header (AFU only), hides Cost/unit, Eff.Cost, Margin, Actions columns in customer view; AFC users always in customer view with no toggle

---

## Pending Deploy Queue

v6.39–v6.59 = **21 versions** pending. v6.60 will be 22 once Opus runs it.

| Version | Description |
|---------|-------------|
| v6.39 | Pricing engine backend |
| v6.40 | Quotation detail frontend + currency fix |
| v6.41 | Local charges + customs filtering fix |
| v6.42 | Container size normalisation (3 resolvers) |
| v6.43 | local_charges DG dimension — migration + engine |
| v6.44 | local_charges router dg_class_code |
| v6.45 | dg_class_charges table + engine |
| v6.46 | dg_class_charges CRUD router |
| v6.47 | dg_class_charges legacy data migration script |
| v6.48 | DG Class Charges frontend UI |
| v6.49 | DG Class Charges clickable time-series cells |
| v6.50 | is_international flag — migration + backend |
| v6.51 | Local charges modal fixes + paid_with_freight removal + DG Class dropdown |
| v6.52 | is_international frontend (modals + types) |
| v6.53 | Phantom row fix + card-level PATCH propagation |
| v6.54 | DG class charges card-level edit fix + Effective To alignment |
| v6.55 | DG classification on shipment orders |
| v6.56 | Port combobox in pricing modals |
| v6.57 | Quotation detail page UX overhaul |
| v6.58 | Quotation ref format + scope-gated warnings + cargo ready date |
| v6.59 | Company name, transport labels, scope display, column-aligned subtotals, Other Charges |
| v6.60 | UOM dropdown, button layout, AFU/customer view toggle ← PENDING OPUS |

---

## Open Items / Backlog

- **NEXT:** Run v6.60 in Opus, then continue quotation module UX/functionality review
- **PENDING:** `is_domestic` audit on DG Class Charges — many rows tagged `is_domestic = true` from migration; verify before deploy
- **PENDING:** Deploy v6.39–v6.60 batch
- Customs module delete support
- AF-API-Pricing.md — needs update after quotation module stabilises
- Air freight data migration — next major workstream after quotation module
- Retrofit hard FK pattern to existing pricing tables (backlog)

---

## Key File Paths (quotation module)

| Purpose | Path |
|---------|------|
| Quotations router | `af-server/routers/quotations.py` |
| Geography router | `af-server/routers/geography.py` ← fixed this session |
| Quotation actions | `af-platform/src/app/actions/quotations.ts` |
| Quotation list page | `af-platform/src/app/(platform)/quotations/page.tsx` |
| Quotation detail page | `af-platform/src/app/(platform)/quotations/[ref]/page.tsx` |
| Quotation detail components | `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx` |
| Prompt log | `claude/prompts/log/PROMPT-LOG-v6.51-v6.60.md` |
| Test master | `claude/tests/AF-Test-Master.md` |

---

## Session Startup Checklist (next session)

```
read_multiple_files:
  - claude/handover/handover-2026-03-13-session-end-v6.60.md
  - claude/tests/AF-Test-Master.md
  - claude/prompts/log/PROMPT-LOG-v6.51-v6.60.md  (tail:25)
  - claude/prompts/PROMPT-CURRENT.md
```

Session header:
`AF Dev — Session 127 | AcceleFreight v2 | v6.38 Live | v6.60 Prompt Ready | Tests v2.61 (272/286)`
