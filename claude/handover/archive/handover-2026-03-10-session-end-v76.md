# AF Dev Handover — Session End
**Date:** 2026-03-10
**Version Live:** v5.69 (no new deployment this session — all changes are backend only)
**Last Prompt Executed:** v5.74
**Tests:** v2.61 — 272/286 (unchanged)

---

## What Was Done This Session

### Bug Investigation — Dashboard vs Issues Only Scenario 4 mismatch

Dashboard was showing incorrect `no_active_cost` counts:
- LCL: 4 costs expired (dashboard) vs 2 cards in Issues Only
- FCL: 1 cost expired (dashboard) vs 0 cards in Issues Only

**Root cause identified:** The dashboard `s4_row` query was reasoning at the
**supplier-row level** rather than the **card level**. A card with two suppliers where
one has an expired cost but the other is still active was being counted as "cost expired"
on the dashboard, even though Issues Only (correctly) excluded it.

**Design decision (Calvin):** A card is only flagged as "cost expired" if ALL its
suppliers have expired costs. If at least one supplier remains active, the card is
healthy. The `alerts_only` filter in `fcl.py` and `lcl.py` already implemented this
correctly. The dashboard had to match.

### v5.73 — FCL alerts_only supersession fix (partial fix, superseded by v5.74)
- Applied supersession-aware NOT EXISTS to `fcl.py` `alerts_only` Scenario 4
- Added `AND r.cost IS NOT NULL` to `__init__.py` dashboard `s4_row`
- Did not fully resolve the mismatch — root cause was deeper (card vs supplier level)

### v5.74 — Simplify dashboard s4_row to card-level logic
- Replaced `s4_row` in `__init__.py` with clean card-level EXISTS/NOT EXISTS query
- Removed all supersession logic from `s4_row` — not needed at card level
- Opus also removed supersession from `lcl.py` and `fcl.py` alerts_only Scenario 4
  for consistency, and re-applied data patches to 8 orphan open-ended supplier rows
  on LCL cards 109 (MYPKG_N:AEJEA) and 110 (MYPKG_N:AUBNE)
- **Verified:** FCL `no_active_cost = 0`, LCL `no_active_cost = 2` — dashboard and
  Issues Only now consistent ✅

**Files modified:**
- `af-server/routers/pricing/__init__.py`
- `af-server/routers/pricing/fcl.py`
- `af-server/routers/pricing/lcl.py`

---

## Current State

- **No active prompt** — `PROMPT-CURRENT.md` clear
- **Nothing pending deploy** — all changes are backend Python only, no migrations
- **Dashboard alert counts verified correct** for MY — Malaysia filter
- **Pricing module considered stable** for current scope

---

## Known Deferred Items

- **Orphan open-ended supplier rows** — migration artefact. Cards 109/110 patched
  manually. A broader cleanup script for all FCL/LCL migrated rows with overlapping
  open-ended date ranges is deferred. Low priority — system handles them correctly now
- **`expiring_soon` dashboard query** — currently overcounts (flags all open-ended
  cards). Deferred — do not touch until explicitly scoped
- **Scenarios 1 & 2 in lcl.py/fcl.py** — may have similar data-quality sensitivity
  with legacy rows. Not investigated this session
- **`effective_from` flow** — POST new rate row for FCL/LCL expanded panel not yet designed
- **Ground transportation design** — not yet scoped
- **Geography → Pricing → Quotation workstream** — pricing module stable; quotation
  workstream next
- **Operations Playbook** — deferred (Jermaine to participate)
- **AI agent phases** — deferred until core platform complete

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
- Scenario 4 alert = card-level, not supplier-level (decision locked in v5.74)
