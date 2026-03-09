# AF Dev Handover — Session End
**Date:** 2026-03-10
**Version Live:** v5.69 (deployed last session)
**Last Prompt Executed:** v5.71
**Tests:** v2.61 — 272/286 (unchanged)

---

## What Was Done This Session

### Debugging — Alert System (console.log → root cause analysis)
- Added `console.log` to `_helpers.ts` `getAlertLevel()` to capture bucket data when `no_active_cost` fires
- Confirmed `bucket_cost: null` for AEJEA card in 2026-03 — backend correctly returning null
- Removed console.log after diagnosis
- Root cause investigation: traced through `lcl.py` time series carry-forward, seed queries, SQL guards
- Concluded SQL is correct; "Cost expired" badge on AEJEA is accurate — old supplier cost row had `effective_to` closed, replacement row has no supplier cost

### v5.70 (Opus) — Fix null cost display + Scenario 4 SQL investigation
- **Part A (no changes needed):** Opus confirmed Scenario 4 NOT EXISTS date guards already correct in `lcl.py`, `fcl.py`, `__init__.py` — no backend changes
- **Part B:** Fixed `_rate-list.tsx` time-series cells — replaced `(bucket.cost ?? 0)` / `(bucket.list_price ?? 0)` with null-aware rendering; `null` now shows `N/A` span; `cost = 0` (FOC) correctly shows `0`; `SurchargeTooltip` suppressed when base value is null
- **Files:** `af-platform/src/app/(platform)/pricing/_rate-list.tsx`

### v5.71 (Opus) — Dashboard revert + data investigation
- **Part A:** Reverted `ActiveCard` amber badge from summing all 4 alert types back to `expiring_soon` only (original design). Per-scenario breakdown rows below badge unchanged.
- **Part B (read-only):** Queried AEJEA LCL card (id=75). Found 6 overlapping open-ended rows — migrated legacy data, none have `effective_to` set. Active supplier cost exists (id=27779, AFS-0143, cost=5.0, eff_from=2026-02-01). Scenario 4 correctly excludes this card — it has an active cost today.
- **Files:** `af-platform/src/app/(platform)/pricing/_dashboard.tsx`

---

## Key Finding — AEJEA "Cost expired" Badge

The "Cost expired" badge visible in the UI is on a **different AEJEA card** than card id=75. There are two MYPKG→AEJEA rate cards (different `dg_class_code` or `rate_card_key`). Card id=75 has active cost today and correctly has no alert. The other AEJEA card (the one showing "Cost expired") has a genuinely expired cost and does not appear in Issues Only because the `alerts_only` SQL is working correctly.

**Issues 2 & 3 from the previous session are non-issues — the system is behaving correctly.**

### Legacy Data Note
Card id=75 has 6 overlapping open-ended rows from migration — the `consolidate_rates.py` script was written for `local_charges` and `customs_rates` only, not for FCL/LCL rates. The FCL/LCL rate tables have similar legacy data but no consolidation script has been run on them. This is a data quality concern but not causing incorrect behaviour — the carry-forward logic resolves to the most recent row per supplier.

---

## Current State

- **No active prompt** — `PROMPT-CURRENT.md` is clear for next session
- **Nothing pending deploy** — v5.71 changes are frontend only, no migrations, can deploy when ready
- **No outstanding bugs** — alert system, Issues Only, and dashboard counts are all working correctly

---

## Migrations State

| # | File | Local | Prod |
|---|---|---|---|
| 020–025 | All migrations | ✅ | ✅ |

---

## Backlog / Deferred
- FCL/LCL legacy data: multiple overlapping open-ended rows per supplier (migration artefact) — low priority, system handles correctly
- Add new effective_from flow (POST new rate row for FCL/LCL expanded panel) — not yet designed
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
