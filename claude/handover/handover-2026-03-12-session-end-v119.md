# Handover — 2026-03-12 — Session 112 End — v6.20-A Prompt Ready

## Session Header
AF Dev — Session 112 | AcceleFreight v2 | v6.19 Live | v6.20-A Prompt Ready | Tests v2.61 (272/286)

---

## What Was Done This Session

### v6.20-A — Air List Price Structural Refactor (migrations + prompt) ✅ COMPLETE
Migrations 044 and 045 written. PROMPT-CURRENT.md at v6.20-A written and ready for Opus.

See previous handover (v118) for full context on the air list price refactor design.

### Container / Seal Number Bug Fix — INCOMPLETE ⚠️

Two bugs were reported against v6.19 (container & seal number editing):

**Bug 1 — Only 1 input row shown for FCL with qty > 1**
Root cause: The `startEditing` function expanded `draftContainers` one entry per container *type*, ignoring the `quantity` field. A type with `quantity: 5` produced only 1 input row.

**Bug 2 — Values not shown after save**
Root cause: Values were being saved but the display code wasn't showing them correctly. The saved values go into `container_numbers[]` (array) on the JSONB, but the display was also checking `container_number` (singular) first.

A fix was attempted via direct MCP file rewrite of `_components.tsx` (this was a mistake — the file is ~1400 lines and should have gone to Opus). The rewrite logic is correct in principle but:
- The save still does not persist values (confirmed by Calvin after the rewrite)
- Risk of regression from full-file rewrite cannot be ruled out

**Status: This fix needs to be handed to Opus.** See the Opus prompt section below.

---

## Opus Prompt Needed — Container/Seal Fix

The following needs to be written as a prompt for Opus to fix. Do NOT attempt further MCP direct edits on this file.

### Problem Summary
In `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`, the `TypeDetailsCard` component:
1. Only shows 1 input row in edit mode regardless of container `quantity` (e.g. qty 5 → should show 5 rows)
2. Values entered are not persisted / not shown after save

### Backend (`af-server/routers/shipments/core.py`)
The `PATCH /{shipment_id}/type-details` endpoint (`update_type_details`) is believed to be correct:
- Reads `type_details` JSONB from `shipment_details`
- For `SEA_FCL`: iterates `body.containers`, merges `container_numbers[]` / `seal_numbers[]` by index into `existing[idx]`
- Writes back via `CAST(:type_details AS jsonb)`, commits via `get_db()` dependency

The `get_db()` pattern in `core/db.py` commits correctly (`conn.commit()` on success).

**However**: the backend iterates `body.containers` against `existing[idx]` — so the payload must be **per-type** (one entry per container type, `container_numbers` as an array of length = quantity). If the frontend sends a flat list of individual containers instead, the backend won't map correctly.

### Frontend — what the current code does after the rewrite
The rewrite introduced `FclDraftSlot` interface and `draftSlots` state. In theory:
- `startEditing` expands each container type by `quantity` into individual slots
- `handleSave` collapses slots back to per-type arrays before POSTing
- Display mode merges `container_number` (singular) and `container_numbers` (array) into `allNums[]`

The fact that save still doesn't work suggests either:
- The collapse-to-per-type logic in `handleSave` is wrong
- The `updateTypeDetailsAction` payload is malformed
- Or the rewrite introduced a regression elsewhere

### What Opus should do
1. Read the current state of `_components.tsx` (specifically `TypeDetailsCard` and its helpers)
2. Read `af-server/routers/shipments/core.py` (`update_type_details` endpoint)
3. Read `af-platform/src/app/actions/shipments-write.ts` (`updateTypeDetailsAction`)
4. Diagnose why save doesn't work — add console.log to `handleSave` before the fetch call to confirm what payload is being sent, and add a `logger.info` in the backend to log the received body
5. Fix both bugs cleanly:
   - Edit mode: show one input row per individual container (expanded by `quantity`)
   - Save: correctly collapse to per-type arrays matching backend expectations
   - Display: show all saved container numbers with `#N` labels when qty > 1

### Files to read/modify
- `af-platform/src/app/(platform)/shipments/[id]/_components.tsx` — TypeDetailsCard
- `af-server/routers/shipments/core.py` — update_type_details endpoint
- `af-platform/src/app/actions/shipments-write.ts` — updateTypeDetailsAction

---

## Active Prompt (Main Workstream)

**File:** `claude/prompts/PROMPT-CURRENT.md`
**Version:** v6.20-A

This is the air list price structural refactor backend prompt. Migrations 044 and 045 must be applied to prod before running this prompt in Opus.

### Pre-flight checklist before running v6.20-A in Opus:
1. Apply `af-server/migrations/044_air_list_price_cards.sql` to prod via Auth Proxy
2. Apply `af-server/migrations/045_migrate_air_list_price_data.sql` to prod via Auth Proxy
3. Verify row counts from migration 045 verification queries
4. Then run PROMPT-CURRENT.md in Opus

---

## Key File Locations

| Area | Path |
|---|---|
| Migration 044 (new list price tables) | `af-server/migrations/044_air_list_price_cards.sql` |
| Migration 045 (data migration) | `af-server/migrations/045_migrate_air_list_price_data.sql` |
| Air backend | `af-server/routers/pricing/air.py` |
| Pricing actions (TS types) | `af-platform/src/app/actions/pricing.ts` |
| Air rate list | `af-platform/src/app/(platform)/pricing/air/_air-rate-list.tsx` |
| Air expanded panel | `af-platform/src/app/(platform)/pricing/air/_air-expanded-panel.tsx` |
| Shipment type details component | `af-platform/src/app/(platform)/shipments/[id]/_components.tsx` |
| Shipment write actions | `af-platform/src/app/actions/shipments-write.ts` |
| Shipment core backend | `af-server/routers/shipments/core.py` |
| Active prompt | `claude/prompts/PROMPT-CURRENT.md` |
| Prompt log | `claude/prompts/log/PROMPT-LOG-v6.11-v6.20.md` |

---

## Backlog

| Item | Status |
|---|---|
| Container/seal fix — needs Opus prompt | ⚠️ BROKEN — write Opus prompt next session |
| Apply migrations 044 + 045 to prod | ⏳ Before running v6.20-A |
| v6.20-A — Run Opus on PROMPT-CURRENT.md | ⏳ After migrations applied |
| v6.20-B — Air list price frontend + sparkline fix | ⏳ After v6.20-A |
| Quotation module | ⏳ Deferred until air freight stabilises |
| TD-02: drop deprecated flat surcharge columns | Deferred |
| Drop supplier_id IS NULL rows from air_freight_rates | Deferred (after v6.20-B confirmed) |
| UI-17: per-user country preference | Deferred |
| Gen transport + cross-border | No data, deferred |
| Retrofit hard FK to existing pricing tables | Backlog |

---

## Test Status
**v2.61 — 272/286 passing** — no test changes this session.

---

## Session Startup Instructions (Next Session)
```
Read files:
- claude/handover/handover-2026-03-12-session-end-v119.md
- claude/tests/AF-Test-Master.md
- claude/prompts/log/PROMPT-LOG-v6.11-v6.20.md (tail:10)
- claude/prompts/PROMPT-CURRENT.md (head:20)
```

Display session header:
**AF Dev — Session 113 | AcceleFreight v2 | v6.19 Live | v6.20-A Prompt Ready | Tests v2.61 (272/286)**

### First actions next session:
1. Write Opus prompt for container/seal bug fix (see section above)
2. Apply migrations 044 + 045 to prod
3. Run v6.20-A prompt in Opus
