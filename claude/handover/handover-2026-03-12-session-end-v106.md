# AF Dev — Session 106 Handover
**Date:** 2026-03-12 | **Last Prompt:** v6.09 | **Next Session:** 107

---

## Session Summary

This session resolved the systemic integer status bug that was causing shipments to disappear
from the Active list after document apply operations, and cleaned up the denormalized
`shipment_workflows.company_id` column.

### Root cause (resolved)
`orders.status` is VARCHAR(30) — expects strings like `'in_progress'`. Document apply paths
(`doc_apply.py`, `bl.py`, `_status_helpers.py`, `tasks.py`) were writing raw integers (e.g. `3002`)
directly. PostgreSQL stored them as the string `"3002"`, which failed to match
`WHERE status IN ('in_progress', 'confirmed')`. Shipments created or updated via these paths
became invisible in the Active tab.

### Prompts completed this session
- **v6.08** — Company null UI fixes (detail page + create wizard). Status: **Completed by Opus.**
- **v6.09** — Status string fix (7 write sites) + drop `shipment_workflows.company_id`. Status: **Completed by Opus.**

### Data fixes applied manually
- `AF-003884`: `UPDATE orders SET status = 'in_progress', sub_status = 'bkg_confirmed' WHERE order_id = 'AF-003884'`
- `AF-003882`: `UPDATE orders SET status = 'in_progress', sub_status = 'bkg_confirmed' WHERE order_id = 'AF-003882'`
- `shipment_workflows`: `UPDATE shipment_workflows SET company_id = 'AFC-0637' WHERE order_id = 'AF-003884' AND company_id IS NULL` (pre-migration 043)

### Migration 043 applied to prod ✅
`ALTER TABLE shipment_workflows DROP COLUMN IF EXISTS company_id` — confirmed dropped.

---

## v6.09 scope (all completed)

**Part A — 7 integer status write sites fixed:**
- `doc_apply.py` — `apply_booking_confirmation` + `apply_awb`
- `bl.py` — `create_from_bl` (INSERT) + `update_from_bl` (PATCH)
- `_status_helpers.py` — `_check_atd_advancement_pg`
- `tasks.py` — POL ATD auto-advancement + POD ATA auto-advancement

**Bonus fixes by Opus (not in prompt spec):**
- 3 read-back comparisons in `_status_helpers.py` and `tasks.py` that compared DB string status against integer constants — would have caused TypeError. Now compare against `sub_status` strings.

**Part B — `shipment_workflows.company_id` removed:**
- Migration 043 SQL created and applied
- `get_status_history` in `core.py` now JOINs `orders` for company_id auth check
- `create_shipment_manual` INSERT in `core.py` — `company_id` removed
- `create_from_bl` INSERT in `bl.py` — `company_id` removed

**Backlog item closed:** TD-03 (drop `shipment_workflows.company_id`) — complete.

---

## Current state

| Item | Status |
|---|---|
| Status string fix (all write paths) | ✅ Complete — v6.09 |
| Migration 043 (drop workflow company_id) | ✅ Applied to prod |
| AF-003884 data fix | ✅ Applied |
| AF-003882 data fix | ✅ Applied |
| PROMPT-CURRENT.md | Clear |

---

## Immediate next actions

1. **Verify** — check a few shipments in the Active list to confirm no further integer status anomalies
2. **Consider a broader data audit** — check if any other shipments have integer status values:
   ```sql
   SELECT order_id, status, sub_status FROM orders
   WHERE status NOT IN ('draft', 'pending_review', 'confirmed', 'in_progress', 'completed', 'cancelled')
     AND trash = FALSE;
   ```
3. **Next workstream** — options: Air Freight pricing UI, or Quotation module

---

## Active backlog

| Item | Status |
|---|---|
| Air Freight pricing UI | Deferred — structurally different (weight breakpoint tiers) |
| Haulage FAF data entry | Ready — migration + export done, UI working |
| Quotation module | Next major workstream after pricing stable |
| TD-02: drop deprecated flat surcharge columns | Deferred |
| TD-03: drop shipment_workflows.company_id | ✅ Closed — migration 043 applied |
| UI-17: per-user country preference | Deferred (schema migration needed) |
| Gen transport + cross-border | No data, deferred |
| Operations Playbook | Deferred until platform complete |

---

## Key file locations

| Area | Path |
|---|---|
| Status constants + mapping | `af-server/core/constants.py` |
| Doc apply endpoints | `af-server/routers/shipments/doc_apply.py` |
| BL endpoints | `af-server/routers/shipments/bl.py` |
| Status helpers | `af-server/routers/shipments/_status_helpers.py` |
| Tasks endpoint | `af-server/routers/shipments/tasks.py` |
| Core shipment endpoints | `af-server/routers/shipments/core.py` |
| Migration 043 | `af-server/migrations/043_drop_workflow_company_id.sql` |
| Migration runner 043 | `af-server/scripts/run_migration_043.py` |
| Prompt log | `af-cloud-v2/claude/prompts/log/PROMPT-LOG-v6.01-v6.10.md` |
