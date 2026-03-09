# AF Dev Handover — Session 68 End
**Date:** 2026-03-09
**Version Live:** v5.55
**Last Prompt Executed:** v5.58 (completed)
**Tests:** v2.61 — 272/286 (unchanged this session)

---

## What Was Done This Session

### Prompt v5.58 — Local Charges Unification
Written by Claude (MCP) and executed by Opus. Full scope:

1. **Migration 023** (`af-server/migrations/023_local_charges.sql`) — dropped `thc_rates`, updated `customs_rates` (amount→price, +cost, +is_domestic, ALL shipment type), created `local_charges` table (container_size, container_type, paid_with_freight, ALL wildcard support). Run on local DB.
2. **`local_charges.py`** — new router, full CRUD, validation for container_size/type enums
3. **`customs.py`** — price/cost/is_domestic fields, ALL added to `_VALID_SHIPMENT_TYPES`
4. **`__init__.py`** — deregistered thc router, registered local_charges at `/local-charges`
5. **`pricing.ts`** — removed THCRate + 4 THC actions; added LocalCharge interface + 4 actions; updated CustomsRate interface
6. **New `/pricing/local-charges/` module** — page, table (DOM/PWF flag badges, container ALL badge), modal (all fields)
7. **Customs modal + table** — price/cost/is_domestic, ALL type badge, Cost column added
8. **Sidebar + Dashboard** — THC → Local Charges, Warehouse icon, `/pricing/local-charges` href

### Cleanup
- `af-server/routers/pricing/thc.py` — deleted (replaced by `local_charges.py`, no longer imported)

### CLAUDE.md Updated
- Test paths: `AF-Test-List.md` → `AF-Test-Master.md` + `claude/tests/series/`
- Handover path: old filename format → `claude/handover/` with archive policy and naming convention
- Python version note updated (3.14 removed, 3.11.9 only)
- af-web marked as parked
- Stack updated: added Cloud SQL PostgreSQL
- Architecture: added pricing/ router, migrations/ to server structure
- Added AF- prefix rule and timing source of truth rule
- Last updated: 09 Mar 2026

### Workflow Improvements Agreed
- Prompts touching 5+ files or both backend+frontend will be split into sub-prompts (e.g. v5.58a backend / v5.58b frontend)
- Sub-prompts executed sequentially — each verified before the next is written
- Claude Code autonomy: `CLAUDE.md` autonomy block already in place; `claude config` not supported in current version; `--dangerously-skip-permissions` flag available if needed

---

## Current State

### Migrations
| # | File | Local | Prod |
|---|---|---|---|
| 020 | `020_lcl_min_quantity.sql` | ✅ | ✅ |
| 021 | `021_thc_customs_rates.sql` | ✅ | ✅ |
| 022 | `022_customs_port_code.sql` | ✅ | ⚠️ NOT YET RUN |
| 023 | `023_local_charges.sql` | ✅ | ⚠️ NOT YET RUN |

### Active Prompt
`PROMPT-CURRENT.md` — contains completed v5.58 content. Safe to overwrite for next prompt.

---

## Immediate Next Steps

1. **Run migration 022 on prod** — `customs_rates` port_code schema fix (table is empty, safe)
2. **Run migration 023 on prod** — after 022 completes
3. **Legacy data migration script** — design complete (see v67 handover); script not yet written
   - `PricingLocalCharges` → `local_charges`
   - `PricingCustomsCharges` → `customs_rates`
   - Wildcard `*` → `ALL`; monthly rates → flattened effective_from/to rows
   - Service account: `cloud-accele-freight-b7a0a3b8fd98.json` in legacy repo

---

## Backlog / Deferred
- Ground transportation design — not yet scoped
- Geography → Pricing → Quotation workstream — pricing module in progress
- Operations Playbook — deferred (Jermaine to participate)
- AI agent phases — deferred until core platform complete
- Prod/dev Google Maps API key separation — deferred

---

## Architecture Reminders
- `shipments.etd` / `shipments.eta` deprecated; POL/POD task legs are source of truth
- BC writes scheduled timing only; BL/AWB writes actual timing only
- Forward-only status progression
- All shipment records use `AF-` prefix; `AFCQ-` retired
- af-web (Vue public site) parked indefinitely
