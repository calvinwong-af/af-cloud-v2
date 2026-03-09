# AF Dev Handover - Session 70 End
**Date:** 2026-03-09
**Version Live:** v5.55
**Last Prompt Executed:** v5.60 (completed previous session)
**Prompt Ready:** v5.61
**Tests:** v2.61 - 272/286 (unchanged this session)

---

## What Was Done This Session

### Migration 024 - Run on Prod
- `af-server/migrations/024_local_charges_uom.sql` run on prod successfully
- Adds `QTL` and `RAIL_3KG` to `lc_uom_check` constraint
- Prod schema now matches local

### Local Charges Live Migration
- `DRY_RUN` flipped to `False` in `af-server/scripts/migrate_local_charges.py`
- Migration run started - **still running at session end**
- Dry run confirmed: 60,994 rows to insert, 0 invalid entries, 48 skipped (45ft containers - accepted)
- Expected output when complete: `Rows inserted: 60,994`
- **Action required: flip `DRY_RUN` back to `True` once run completes**

### Prompt v5.61 - Written
- `claude/prompts/PROMPT-CURRENT.md` - ready for Opus
- Single task: create `af-server/scripts/migrate_customs_charges.py`
- No DB migration or router changes needed - `customs_rates` schema and `customs.py` were already fully updated in v5.58 (migration 023)
- Script modelled on `migrate_local_charges.py` with key differences: no container fields, no `paid_with_freight`, trimmed UOM set (no QTL/RAIL_3KG), `PricingCustomsCharges` kind, `PT-CUSTOMS-CHARGES` rate filter

---

## Immediate Next Steps

1. **Wait for local charges migration to finish** - paste summary to Claude, confirm `Rows inserted: 60,994`, then flip `DRY_RUN = True` in `migrate_local_charges.py`

2. **Execute Prompt v5.61 in Opus** - creates `migrate_customs_charges.py`

3. **Run customs migration dry-run** - paste summary to Claude to review before going live

---

## Migrations State

| # | File | Local | Prod |
|---|---|---|---|
| 020 | `020_lcl_min_quantity.sql` | YES | YES |
| 021 | `021_thc_customs_rates.sql` | YES | YES |
| 022 | `022_customs_port_code.sql` | YES | YES |
| 023 | `023_local_charges.sql` | YES | YES |
| 024 | `024_local_charges_uom.sql` | YES | YES |

---

## Active Prompt
`PROMPT-CURRENT.md` - v5.61 ready for Opus execution.

---

## Backlog / Deferred
- Ground transportation design - not yet scoped
- Geography -> Pricing -> Quotation workstream - pricing module in progress
- Operations Playbook - deferred (Jermaine to participate)
- AI agent phases - deferred until core platform complete

---

## Architecture Reminders
- `shipments.etd` / `shipments.eta` deprecated; POL/POD task legs are source of truth
- BC writes scheduled timing only; BL/AWB writes actual timing only
- Forward-only status progression
- All shipment records use `AF-` prefix; `AFCQ-` retired
- af-web (Vue public site) parked indefinitely
