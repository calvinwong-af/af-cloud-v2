# AF Dev Handover - Session 71 End
**Date:** 2026-03-09
**Version Live:** v5.55
**Last Prompt Executed:** v5.62b (completed this session)
**Prompt Ready:** none — awaiting customs migration completion before next prompt
**Tests:** v2.61 - 272/286 (unchanged this session)

---

## What Was Done This Session

### Local Charges Migration — Confirmed Complete
- 60,994 rows inserted into `local_charges` table on prod
- `migrate_local_charges.py` `DRY_RUN` still sitting on `False` — **needs manual flip to `True`** (MCP write_file not safe to use for partial edits)

### Migration 025 — Run on Prod
- `af-server/migrations/025_customs_rates_price_cost.sql` applied to prod successfully
- Drops `amount` column, adds `price` + `cost` columns to `customs_rates`

### Customs Migration Script — Recovered (v5.62b)
- `migrate_customs_charges.py` was accidentally truncated to 1004 B by a bad `write_file` call
- Opus regenerated the full script (now 13.47 KB)
- `DRY_RUN = False` — **ready to run live migration**
- Dry-run previously confirmed: 18,056 rows, zero skips

### Prompt v5.62 — Local Charges Rate Card View
- Backend: `GET /ports` + `GET /cards` added to `local_charges.py`
- Frontend: `_local-charges-table.tsx` fully replaced with `LocalChargesTab` + `LocalChargeCardList`
- Country default = `MY`, port gate (no load until port selected), time-series cell view per charge code
- `page.tsx` updated to import `LocalChargesTab` with `countryCode="MY"`
- **Not yet tested in browser**

---

## Immediate Next Steps

1. **Flip `DRY_RUN = True` in `migrate_local_charges.py`** — do manually, line ~25

2. **Run customs live migration** (proxy must be running):
   ```
   tools\start-proxy.bat
   cd C:\dev\af-cloud-v2
   af-server\.venv\Scripts\python.exe af-server/scripts/migrate_customs_charges.py
   ```
   Expected: `Rows inserted: 18,056`
   Then flip `DRY_RUN = True` in `migrate_customs_charges.py`

3. **Test v5.62 in browser** — navigate to `/pricing/local-charges`, verify:
   - Malaysia pre-selected, port list populated
   - Port gate works (empty state until port selected)
   - Cards load with time-series cells
   - Expand/collapse works

4. **Deploy to prod** — once customs migration and browser test are confirmed

---

## Migrations State

| # | File | Local | Prod |
|---|---|---|---|
| 020 | `020_lcl_min_quantity.sql` | YES | YES |
| 021 | `021_thc_customs_rates.sql` | YES | YES |
| 022 | `022_customs_port_code.sql` | YES | YES |
| 023 | `023_local_charges.sql` | YES | YES |
| 024 | `024_local_charges_uom.sql` | YES | YES |
| 025 | `025_customs_rates_price_cost.sql` | YES | YES |

---

## Data Migration State

| Script | Status | Rows |
|---|---|---|
| `migrate_local_charges.py` | ✅ Complete | 60,994 inserted |
| `migrate_customs_charges.py` | ⏳ Ready to run live | 18,056 confirmed dry-run |

---

## Active Prompt
None — `PROMPT-CURRENT.md` contains v5.62b (completed). Clear before writing next prompt.

---

## Known Issues / Watch Items
- `migrate_local_charges.py` `DRY_RUN` still `False` — needs manual fix
- v5.62 local charges UI not yet browser-tested
- `ExpandedRateRows` in local charges shows rate history from time_series only (no `effective_from/to` range per row) — minor limitation, acceptable for now, revisit when edit/add is added

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
