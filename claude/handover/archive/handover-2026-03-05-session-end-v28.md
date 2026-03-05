# Session Handover — Session 28 -> Session 29
**Date:** 05 March 2026
**Platform:** AcceleFreight v2 (af-cloud-v2)
**Session type:** Feature Development

---

## What Was Done This Session

### Prompts Executed This Session

| Prompt | Title | Status |
|---|---|---|
| v4.10 | StatusCard Frontend Update + Backend Tab Fix | Completed (at session start) |
| v4.11 | BC Apply — Sync ETD/ETA to TRACKED Task Timing + Remove Stale route_nodes Writes | Completed |
| v4.12 | Deprecate shipments.etd / shipments.eta — Single Source of Truth: Task Legs | Completed |

### Responsive Table Fixes (no prompt — direct MCP edits)
- Shipments page tab nav: scrollable with hidden scrollbar, large badge counts abbreviated (2020 → 2.0K)
- ShipmentOrderTable: removed "Updated" column, tighter company name font
- Dashboard page: overflow-x-auto on table wrappers
- Files: `af-platform/src/app/(platform)/shipments/page.tsx`, `af-platform/src/components/shipments/ShipmentOrderTable.tsx`, `af-platform/src/app/(platform)/dashboard/page.tsx`

### Architecture Decision — Single Source of Truth for ETD/ETA
Major cleanup completed this session:

- `shipments.etd` and `shipments.eta` flat columns are fully deprecated as a maintained data store
- TRACKED POL/POD task legs (`scheduled_end` / `scheduled_start`) are the single source of truth
- All write paths removed: BC apply, AWB apply, BL apply, create_from_bl, create_shipment_manual
- At creation time (BL/manual), ETD/ETA now seeded directly onto task legs, not flat columns
- BL apply syncs ETD to POL task scheduled_end (fill-blanks only)
- `_lazy_init_tasks_pg` no longer reads etd/eta for V1 lazy init — V1 records get null task timing (acceptable, V1 records retained for reference data only: index, incoterm, origin/destination, type, customer)
- `db_queries.py` no longer serialises etd/eta in get_shipment_by_id
- `page.tsx` Transport card reads ETD from `routePolEtd` state (TRACKED POL task)
- Schema columns NOT dropped yet — future migration
- Also cleaned stale route_nodes timing writes from AWB apply (missed in v4.11)
- Also fixed task timing field clearing: explicit null now clears values via Pydantic v1 `__fields_set__`

---

## Current State

### Prompt Log
- Latest completed: v4.12
- Next prompt: v4.13
- Active log file: `claude/prompts/log/PROMPT-LOG-v4.11-v4.20.md` (2 entries, 8 slots remaining)

### Test Status
- 270/284 passing — unchanged this session (no formal testing)

### PROMPT-CURRENT.md
- Contains v4.12 (already executed) — clear to `_No active prompt._` at next session start

---

## Known Open Bugs

| # | Description | Priority |
|---|---|---|
| BUG-01 | Status not auto-advancing after BC apply | Medium |
| BUG-02 | Containers from BC not written to shipment | Medium |
| BUG-03 | Recurring "Unauthorised" badge on Files tab | Medium |
| MAP-01 | Route Map not rendering on prod | Medium |

---

## Next Session — Suggested Starting Points

1. Verify v4.12 in testing — BC apply, BL apply, manual create should all seed task timing correctly; task clearing should work
2. Address BUG-01, BUG-02, BUG-03
3. Schema migration to drop etd/eta columns (when ready)

---

## Open Backlog

| # | Item | Priority |
|---|---|---|
| MAP-01 | Route Map not rendering on prod | Medium |
| TD-01 | Refactor _helpers.py into domain modules | Low — trigger on AI agent phase |
| UI-01 | Keyboard arrow nav on combobox/dropdowns | Low |
| UI-02/04 | Port list filtered by freight type | Low |
| UI-03 | Port edit pencil icon position | Low |

---

## Key File Locations

| Item | Path |
|---|---|
| Prompt log (active) | claude/prompts/log/PROMPT-LOG-v4.11-v4.20.md |
| Active prompt | claude/prompts/PROMPT-CURRENT.md |
| Backlog | claude/other/AF-Backlog.md |
| API contract | claude/other/AF-API-Contract.md v1.4 |
| Task timing logic | af-server/routers/shipments/tasks.py |
| Doc apply | af-server/routers/shipments/doc_apply.py |
| BL apply | af-server/routers/shipments/bl.py |
| Core shipment create | af-server/routers/shipments/core.py |
| DB queries | af-server/core/db_queries.py |
| Shipment detail page | af-platform/src/app/(platform)/shipments/[id]/page.tsx |
