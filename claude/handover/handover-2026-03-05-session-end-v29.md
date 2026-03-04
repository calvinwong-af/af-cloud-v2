# Session Handover — Session 29 -> Session 30
**Date:** 05 March 2026
**Platform:** AcceleFreight v2 (af-cloud-v2)
**Session type:** Feature Development

---

## What Was Done This Session

### Prompts Executed This Session

| Prompt | Title | Status |
|---|---|---|
| v4.13 | SOB→ATD Write, BC Task Timing Always-Overwrite, Route Nodes Refresh Fix | Completed |
| v4.14 | BC Apply: Default ETA POL to ETD - 1 Day When ETA POL is Absent | Completed |
| v4.15 | Route Node Timeline: Refresh Fix, ORIGIN ETA/ATA Display, 4-Timing Grid Layout, Task ATD/ATA Visibility Fix | Completed |
| v4.16 | Route Node Sync on Doc Apply (BC + BL + AWB) + Files Tab Re-parse Refresh Fix | Completed |
| v4.17 | AWB scheduled_etd Correction + POL ATA Wiring + Remove Route Node Strikethroughs | Completed |
| v4.18 | Investigate and fix: POL ATA (actual_eta) not showing on route node | **Pending — pass to Opus** |

### Summary of Work

**Document apply → task timing** (v4.13–v4.14):
- BL SOB date now writes to TRACKED POL task `actual_end` (ATD), triggering status auto-advance to Departed
- AWB `flight_date` same treatment as BL for consistency
- BC apply task timing changed from fill-blanks to always-overwrite (user dialog values now respected)
- BC apply adds ETA POL fallback: if no ETA POL provided, defaults to ETD - 1 day → written to POL task `scheduled_start`
- Removed `router.refresh()` from all 3 doc-type branches in `_doc-handler.ts` (race condition fix)

**Route node timeline** (v4.15–v4.17):
- `RouteNodeTimeline` now accepts `refreshKey` prop — re-fetches when doc is applied
- ORIGIN node redesigned as 2×2 grid: ETA (top-left), ETD (top-right), ATA (bottom-left, blue), ATD (bottom-right, green). ORIGIN `min-w` widened to 140px
- Task card actual timing row now shows whenever `actual_start || actual_end` is set (previously hidden when task PENDING)
- `_sync_route_node_timings` helper added to `_helpers.py` — syncs timing to `route_nodes` JSONB, bootstraps minimal nodes from port codes if null
- BC apply → writes `scheduled_etd`, `scheduled_eta` (planned values only)
- BL apply → writes `actual_etd` only (post-sailing fact, no scheduled overwrite)
- AWB apply → writes `actual_etd` only (post-flight fact, no scheduled overwrite)
- Files tab re-parse now triggers route node timeline refresh via `onDocApplied` prop
- All strikethroughs removed from route node timing cells
- `routePolAta` state added to `page.tsx`, populated from `polTask.actual_start`
- `tasks.py` backend: `_sync_route_node_timings` called with `origin_actual_eta` when TRACKED POL `actual_start` is saved

---

## Current State

### Prompt Log
- Latest completed: v4.17
- Pending: v4.18 (Opus investigation — POL ATA still not showing on route node)
- Active log file: `claude/prompts/log/PROMPT-LOG-v4.11-v4.20.md`

### Test Status
- 270/284 passing — unchanged this session (no formal testing this session)

### PROMPT-CURRENT.md
- Contains v4.18 — pass to Opus before starting next session

---

## Known Open Issues

| # | Description | Priority |
|---|---|---|
| v4.18 | POL ATA (actual_eta) not displaying on route node — Opus to investigate | High — pending |
| BUG-03 | Recurring "Unauthorised" badge on Files tab | Medium |
| MAP-01 | Route Map not rendering on prod | Medium |

Note: BUG-01 (status not advancing after BC) and BUG-02 (containers from BC) were addressed as part of v4.13/v4.16 work — verify in testing.

---

## Next Session — Suggested Starting Points

1. Run v4.18 in Opus — investigate and fix POL ATA on route node
2. Verify all route node timing (ETA, ETD, ATA, ATD) across BC/BL/AWB apply flows
3. Start **Geography** work (new feature area — Calvin's intent for next session)
4. Address BUG-03 and MAP-01 when convenient

---

## Scheduled vs Actual Separation Principle (established this session)

Important design rule for all future doc-apply work:
- **BC** (planning doc) → writes `scheduled_*` only
- **BL** (post-sailing) → writes `actual_*` only, never overwrites `scheduled_*`
- **AWB** (post-flight) → writes `actual_*` only, never overwrites `scheduled_*`

This enables delay analysis: `scheduled_etd` (BC plan) vs `actual_etd` (BL/AWB fact).

---

## Key File Locations

| Item | Path |
|---|---|
| Prompt log (active) | claude/prompts/log/PROMPT-LOG-v4.11-v4.20.md |
| Active prompt | claude/prompts/PROMPT-CURRENT.md |
| Backlog | claude/other/AF-Backlog.md |
| Route node sync helper | af-server/routers/shipments/_helpers.py |
| Doc apply (BC + AWB) | af-server/routers/shipments/doc_apply.py |
| BL apply | af-server/routers/shipments/bl.py |
| Task update handler | af-server/routers/shipments/tasks.py |
| Route node endpoints | af-server/routers/shipments/route_nodes.py |
| Shipment detail page | af-platform/src/app/(platform)/shipments/[id]/page.tsx |
| Doc handler | af-platform/src/app/(platform)/shipments/[id]/_doc-handler.ts |
| Route node timeline | af-platform/src/components/shipments/RouteNodeTimeline.tsx |
| Shipment tasks | af-platform/src/components/shipments/ShipmentTasks.tsx |
| Files tab | af-platform/src/components/shipments/ShipmentFilesTab.tsx |
