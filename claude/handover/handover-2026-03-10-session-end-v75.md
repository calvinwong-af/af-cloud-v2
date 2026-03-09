# AF Dev Handover — Session End
**Date:** 2026-03-10
**Version Live:** v5.69 (deployed prior session)
**Last Prompt Executed:** v5.72b
**Tests:** v2.61 — 272/286 (unchanged)

---

## What Was Done This Session

### Debugging — "Cost expired" cards missing from Issues Only

Two LCL cards (MYPKG→AEJEA and MYPKG→AUBNE) were correctly showing "Cost expired"
badges in the time-series view but were not appearing in Issues Only, and the
dashboard `no_active_cost` count was showing 0 instead of 2.

**Root cause identified:** Legacy migrated data contains multiple open-ended supplier
rows per card (all `effective_to = NULL`). When a newer supplier row was added and
later expired, the older rows were never closed. The Scenario 4 NOT EXISTS check found
those older open-ended rows and incorrectly concluded an active cost still existed.

**Design decision:** The correct fix is not a data patch. A supplier cost is only
considered "active" if the **most recent row for that supplier on that card** is active
today. Older rows superseded by a newer row should be ignored, regardless of their
`effective_to` value.

### v5.72 — Diagnostic script
- Written `af-server/scripts/debug_scenario4.py` to query actual DB state
- Confirmed card 109 (MYPKG_N:AEJEA) had 5 orphan open-ended supplier rows; card 110
  (MYPKG_N:AUBNE) had 3
- Also confirmed two distinct MYPKG→AEJEA rate cards exist (different terminals) —
  expected behaviour, not a bug

### v5.72b — Scenario 4 supersession fix
- Added inner NOT EXISTS to Scenario 4 in `lcl.py` to exclude supplier rows that have
  been superseded by a newer row for the same supplier on the same card
- Applied same fix to `no_active_cost` count query in `__init__.py` (covers both FCL
  and LCL via `{rate_table}` template)
- No data changes — the 8 rows temporarily patched in v5.72 were reverted
- Verified: Scenario 4 now matches cards 109 and 110; dashboard `no_active_cost = 2`

**Files modified:**
- `af-server/routers/pricing/lcl.py`
- `af-server/routers/pricing/__init__.py`
- `af-server/scripts/debug_scenario4.py` (diagnostic only)

---

## Current State

- **No active prompt** — `PROMPT-CURRENT.md` clear
- **Nothing pending deploy** — v5.72b is backend only, no migrations needed
- **Issues Only now correctly shows:** AEJEA (Cost expired) + AUBNE (Cost expired) +
  CNSHG (Price review needed) — 3 cards for MY LCL
- **Dashboard `no_active_cost` = 2 for LCL**

---

## Known Deferred Items

- **Scenarios 1 & 2 in lcl.py** may have the same supersession vulnerability — not
  fixed this session, to be reviewed separately
- **fcl.py Scenario 4** — same fix not yet applied, to be assessed separately
- **`expiring_soon` dashboard query** — currently overcounts (flags all open-ended
  cards). Deferred for future review — do not touch until explicitly scoped
- **FCL/LCL legacy data** — multiple overlapping open-ended rows per supplier remain
  in the DB as a migration artefact. System now handles them correctly via supersession
  logic. Low priority data cleanup deferred
- Add new `effective_from` flow (POST new rate row for FCL/LCL expanded panel) — not
  yet designed
- Ground transportation design — not yet scoped
- Geography → Pricing → Quotation workstream — pricing module in progress
- Operations Playbook — deferred (Jermaine to participate)
- AI agent phases — deferred until core platform complete

---

## Migrations State

| # | File | Local | Prod |
|---|---|---|---|
| 020–025 | All migrations | ✅ | ✅ |

---

## Architecture Reminders
- `shipments.etd` / `shipments.eta` deprecated; POL/POD task legs are source of truth
- BC writes scheduled timing only; BL/AWB writes actual timing only
- Forward-only status progression
- All shipment records use `AF-` prefix; `AFCQ-` retired
- af-web (Vue public site) parked indefinitely
