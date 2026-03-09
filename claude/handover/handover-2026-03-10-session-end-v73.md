# AF Dev Handover — Session 74 End
---
# [REPLACED — see handover-2026-03-10-session-end-v74.md]
---
# AF Dev Handover — Session 73 End
**Date:** 2026-03-10
**Version Live:** v5.55
**Last Prompt Executed:** v5.67 (completed this session)
**Tests:** v2.61 — 272/286 (unchanged this session)

---

## What Was Done This Session

### MCP Direct — Customs & Local Charges Group Order
- `_customs-table.tsx` — EXPORT group now renders before IMPORT
- `_local-charges-table.tsx` — EXPORT group now renders before IMPORT (ALL remains last)

### v5.66 — FCL/LCL Time Series Window Alignment
- Root cause: backend built 9-month time_series (6 past + current + 2 future); frontend ResizeObserver caps `historicalCount` at 9, meaning it could request up to 12 months. Months 7–9 ago were absent from backend response → cells showed `—` on wide screens.
- Fix: expanded window to 12 months (9 past + current + 2 future) in both `fcl.py` and `lcl.py`. `range(9)` → `range(12)`, offset `-6` → `-9`. `month_start`/`month_end` SQL bounds auto-adjust.
- Files: `af-server/routers/pricing/fcl.py`, `af-server/routers/pricing/lcl.py`

### v5.67 — Clear effective_to Across Financial Rate Modals
- Added "× Remove end date" button to `effective_to` field in three modals
- Visible only in edit mode when `effectiveTo` is non-empty
- Clears field to `''` → submits as `null` → PATCH sets `effective_to = NULL` (open-ended)
- Consistent styling: `text-xs text-[var(--text-muted)] hover:text-red-500 underline`
- Input placeholder changed to "Ongoing" when cleared
- `_rate-modal.tsx`: button shown only for `mode === 'edit'` (not `update`, `add-list-price`, `add-supplier`)
- Files: `_local-charges-modal.tsx`, `_customs-modal.tsx`, `_rate-modal.tsx`

### DRY_RUN Flipped Back to True
- `af-server/scripts/migrate_local_charges.py` — `DRY_RUN = True` ✅
- `af-server/scripts/migrate_customs_charges.py` — `DRY_RUN = True` ✅

---

## Pending Before Deploy

1. **Browser test** — verify:
   - v5.65: pencil icon hover on local charges + customs card rows; pre-filled modal; PATCH vs POST branching
   - v5.66: FCL/LCL cells populate on wide screen (historicalCount > 6)
   - v5.67: "× Remove end date" appears on edit when end date set; clears correctly; saves as null
2. **Deploy to prod** — v5.63 through v5.67 + all MCP edits this session
3. **Commit** — all changes since last deploy

---

## Migrations State

| # | File | Local | Prod |
|---|---|---|---|
| 020 | `020_lcl_min_quantity.sql` | ✅ | ✅ |
| 021 | `021_thc_customs_rates.sql` | ✅ | ✅ |
| 022 | `022_customs_port_code.sql` | ✅ | ✅ |
| 023 | `023_local_charges.sql` | ✅ | ✅ |
| 024 | `024_local_charges_uom.sql` | ✅ | ✅ |
| 025 | `025_customs_rates_price_cost.sql` | ✅ | ✅ |

---

## Data Migration State

| Script | Status | Notes |
|---|---|---|
| `migrate_local_charges.py` | ✅ Complete | 60,994 inserted → consolidated to 1,143; `DRY_RUN = True` |
| `migrate_customs_charges.py` | ✅ Complete | 16,929 inserted → consolidated to 358; `DRY_RUN = True` |
| `consolidate_rates.py` | ✅ Complete | Both tables consolidated |
| `openend_rates.py` | ✅ Complete | 766 + 260 rows open-ended |

---

## Active Prompt
`PROMPT-CURRENT.md` — cleared (`_No active prompt._`). Safe to use.

---

## Backlog / Deferred
- Add new effective_from (POST new rate row) — discussed, not yet designed/prompted; relates to edit vs new-rate distinction in local charges + customs modals
- Ground transportation design — not yet scoped
- Geography → Pricing → Quotation workstream — pricing module in progress
- Operations Playbook — deferred (Jermaine to participate)
- AI agent phases — deferred until core platform complete

---

## Architecture Reminders
- `shipments.etd` / `shipments.eta` deprecated; POL/POD task legs are source of truth
- BC writes scheduled timing only; BL/AWB writes actual timing only
- Forward-only status progression
- All shipment records use `AF-` prefix; `AFCQ-` retired
- af-web (Vue public site) parked indefinitely
