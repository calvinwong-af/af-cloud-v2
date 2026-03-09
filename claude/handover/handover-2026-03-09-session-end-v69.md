# AF Dev Handover — Session 69 End
**Date:** 2026-03-09
**Version Live:** v5.55
**Last Prompt Executed:** v5.60 (completed)
**Tests:** v2.61 — 272/286 (unchanged this session)

---

## What Was Done This Session

### Prod Migrations Run
- Migration 022 (`customs_rates` port_code fix) — already partially applied on prod; completed without errors
- Migration 023 (`local_charges` unification) — already partially applied on prod; completed without errors
- Both prod schemas confirmed in correct state

### Migration 024 (via Prompt v5.60)
- `af-server/migrations/024_local_charges_uom.sql` — drops and recreates `lc_uom_check` to add `QTL` and `RAIL_3KG`
- `af-server/routers/pricing/local_charges.py` — `_VALID_UOMS` updated to include `QTL` and `RAIL_3KG`
- Run on local DB only — **NOT YET RUN ON PROD**

### Legacy Data Migration Script (MCP direct iterations)
`af-server/scripts/migrate_local_charges.py` — built iteratively via MCP across this session. Final state:

**Remapping rules applied:**
- Port codes: `MYPKG_N` → `MYPKG` (NorthPort Penang)
- Container types: `DRY` → `GP`, `REEFER` → `RF`
- UOMs: `CTR` → `CONTAINER`, `RT` → `W/M`, `CW` → `CW_KG`, `C3KG` → `RAIL_3KG`

**New UOMs agreed:**
- `QTL` — Quintal (per 100kg), EU freight standard
- `RAIL_3KG` — Rail volumetric weight at 1:3 density ratio (renamed from legacy `C3KG`)

**Final dry run results:**
- 1,059 `PricingLocalCharges` entities fetched
- 61,042 `PTMonthlyRatePortCharges` rate entries fetched
- 60,994 rows ready to insert
- 48 rows skipped (container_size `45` — 45ft containers, not in new system, accepted)
- 0 invalid UOMs, 0 invalid ports, 0 invalid container types

**Script is approved for live run. `DRY_RUN = True` still set.**

### Google Maps API Key
Calvin confirmed this is already resolved. Removed from backlog.

---

## Immediate Next Steps

1. **Run migration 024 on prod** — before live insert:
   ```bash
   psql "host=127.0.0.1 port=5432 dbname=accelefreight user=af_server password=Afserver_2019" -f af-server/migrations/024_local_charges_uom.sql
   ```

2. **Run live local charges migration** — flip `DRY_RUN = False` in `af-server/scripts/migrate_local_charges.py` then:
   ```bash
   cd C:\dev\af-cloud-v2
   af-server\.venv\Scripts\python.exe af-server/scripts/migrate_local_charges.py
   ```
   Expected: ~60,994 rows inserted, small conflict count possible if any rows already exist.
   **Reset `DRY_RUN = True` after run.**

3. **Legacy data migration — Customs charges** — next dataset after local charges confirmed. Same pattern: `PricingCustomsCharges` + `PTMonthlyRatePortCharges` (kind=`PT-CUSTOMS-CHARGES`) → `customs_rates` table.

---

## Migrations State

| # | File | Local | Prod |
|---|---|---|---|
| 020 | `020_lcl_min_quantity.sql` | ✅ | ✅ |
| 021 | `021_thc_customs_rates.sql` | ✅ | ✅ |
| 022 | `022_customs_port_code.sql` | ✅ | ✅ |
| 023 | `023_local_charges.sql` | ✅ | ✅ |
| 024 | `024_local_charges_uom.sql` | ✅ | ⚠️ NOT YET RUN |

---

## Active Prompt
`PROMPT-CURRENT.md` — contains completed v5.60. Safe to overwrite.

---

## Backlog / Deferred
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
