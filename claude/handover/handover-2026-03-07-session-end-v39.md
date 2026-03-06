# Session 39 Handover — AcceleFreight v2
**Date:** 2026-03-07
**Version:** v5.05 Live (deployed) | v5.07 Prompt Executed (not yet deployed)
**Tests:** 279/299 (unchanged — no test series affected this session)

---

## Session Work

### Prompt v5.07 — Order Scope + Task Mode Redesign (Opus executed)

Complete redesign of the Order Scope system. Key design decisions:

**New mental model:**
- Scope flags are **derived from incoterm rules**, not manually set from scratch
- Each eligible leg has three states: `ASSIGNED` (AF manages), `TRACKED` (another party, AF monitors), `IGNORED` (outside incoterm scope)
- Scope flags **drive task mode** — changing scope updates the corresponding workflow task mode
- POL / POD tasks are always TRACKED, not scope-configurable
- FREIGHT_BOOKING task is always ASSIGNED, not scope-configurable
- `sea_freight` flag removed entirely — implicit for all freight shipments
- FCL → "Haulage" label; LCL/AIR → "Trucking" label for first/last mile

**New scope schema** (`orders.scope` JSONB):
```json
{
  "first_mile":       "ASSIGNED | TRACKED | IGNORED",
  "export_clearance": "ASSIGNED | TRACKED | IGNORED",
  "import_clearance": "ASSIGNED | TRACKED | IGNORED",
  "last_mile":        "ASSIGNED | TRACKED | IGNORED"
}
```
Old boolean schema (`first_mile_haulage: true`) treated as null → re-derived from incoterm.

**UI change:** ScopeFlagsCard and GroundTransportReconcileCard removed from Overview tab. Replaced by "Configure Scope" button in Tasks tab (AFU only) that opens `ScopeConfigDialog`.

### MCP Fixes This Session
1. `backfill_scope_from_tasks.py` — fixed missing `load_dotenv`, wrong table (`shipment_details` → `orders`) in both SELECT and UPDATE
2. Backfill run on local DB: **33 updated, 2006 skipped (no tasks — V1 legacy records)**

---

## Pending Work Queue

### Immediate
1. **Run backfill on prod** after deploying af-server:
   ```
   .venv\Scripts\python scripts\backfill_scope_from_tasks.py --dry-run
   .venv\Scripts\python scripts\backfill_scope_from_tasks.py
   ```
2. **Deploy af-server** — v5.07 changes + Session 38 MCP fixes still pending
3. **Deploy af-platform** — v5.07 changes + Session 38 MCP fixes still pending
4. **Smoke test after deploy:**
   - Tasks tab shows "Configure Scope" button (AFU only)
   - Dialog shows only incoterm-eligible legs
   - Toggle Assigned → Tracked → task mode updates in task list
   - Toggle to "Not in Scope" → task disappears (IGNORED/HIDDEN)
   - Overview tab no longer shows ScopeFlagsCard or GroundTransportReconcileCard
   - New FCL FOB EXPORT shipment: correct tasks generated with correct modes

### Session 38 Fixes Still Needing Deploy
- Status 1002 distinct string mapping (`constants.py`, `types.ts`)
- Upload Document button visibility fix (`page.tsx`)
- `order_type` overwrite bug fix (`db_queries.py`)
- V1 numeric string status backfill (already run on prod data)

### Backlog (active)
- Delete retired route folders: `shipments/` and `ground-transport/` (stubs remain)
- Move detail routes: `shipments/[id]` → `orders/shipments/[id]`, `ground-transport/[id]` → `orders/deliveries/[id]`
- Update `orders/page.tsx` action menu links to new detail paths
- GT smoke tests (GT-10 through GT-13)

### Design/Build (deferred)
- `/orders/haulage` page design
- Ground transportation design (not yet scoped)
- Operations Playbook (Jermaine — deferred post core)
- AI agent phases (all deferred post core)

### Pricing → Quotation workstream (design captured, not yet scoped)
**Flow:** Shipment created → user requests quotation (checks scope) → staff reviews scope → quotation built from rate card/tariff → issued to customer.

**Scope ↔ Pricing connection:** Scope flags drive which line items appear in the quotation. `ASSIGNED` legs are billable by AF; `TRACKED`/`IGNORED` legs are not AF's service → no line item.

**Line items:** Each scope leg can expand into multiple line items (e.g. First Mile Haulage → chassis fee, fuel surcharge, handling, etc.).

**Rate source:** Rate card / tariff table (structured). Special/ad-hoc services can be manually added.

**Legacy data:** Pricing and quotation structures exist in the old Vue/Flask/GAE system — must be studied before designing new schema. No pricing tables exist yet in af-server. Next step: extract legacy quotation + rate card data model from old system before writing any prompts for this workstream.

---

## Key Architecture Reminders

- **`orders.scope`** = JSONB with new schema `{ first_mile, export_clearance, import_clearance, last_mile }` each `ASSIGNED | TRACKED | IGNORED`
- **Scope endpoint** = `GET/PATCH /api/v2/shipments/{id}/scope` (moved from GT router — GT router never had it implemented)
- **Task mode source of truth** = scope flags; POL/POD always TRACKED, FREIGHT_BOOKING always ASSIGNED
- **2006 V1 legacy shipments** have no workflow_tasks → scope will be derived fresh on first task generation
- **Backfill idempotent** — safe to re-run; skips records already on new schema

---

## File Locations
- Active prompt: `claude/prompts/PROMPT-CURRENT.md` (cleared — v5.07 complete)
- Prompt log: `claude/prompts/log/PROMPT-LOG-v5.00-v5.10.md`
- Tests master: `claude/tests/AF-Test-Master.md`
- Backlog: `claude/other/AF-Backlog.md`
- Backfill script: `af-server/scripts/backfill_scope_from_tasks.py`
- Scope router: `af-server/routers/shipments/scope.py`
- Scope dialog: `af-platform/src/components/shipments/ScopeConfigDialog.tsx`
