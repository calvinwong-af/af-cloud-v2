# Handover — Session 36 End | v5.02 | 2026-03-06

## Session Header
AF Dev — Session 36 | AcceleFreight v2 | v5.01 Live | v5.02 Prompt Completed | Tests: 279/299

---

## What Was Done This Session

### 1. GT Actions Menu Z-Index Fix (direct edit — Session 36 carry-over from 35)
- Rendered GT list page actions menu via React portal to escape `overflow-hidden` table clipping
- File: `af-platform/src/app/(platform)/ground-transport/page.tsx`

### 2. DG Icon Fix — Shipments List (direct edits)
Root cause: `cargo_is_dg` was in the backend SQL and dict but was silently dropped in `toShipmentOrder()`.
- `af-server/core/db_queries.py` — added `o.is_test` to `list_shipments` SELECT (col index 18), dict key `"is_test": r[18] or False`
- `af-platform/src/app/actions/shipments.ts` — added `is_test?: boolean` to `ShipmentListItem`
- `af-platform/src/app/(platform)/shipments/page.tsx` — `toShipmentOrder()` now spreads both `cargo_is_dg` and `is_test` via conditional spread pattern

### 3. TEST Badge — Shipments List (direct edit)
- `af-platform/src/components/shipments/ShipmentOrderTable.tsx` — TEST badge (amber-100/amber-800) added to `ShipmentRow` Order ID cell

### 4. v5.02 Prompt — Executed by Opus
**New files created:**
- `af-server/routers/orders.py` — `GET /api/v2/orders` unified list endpoint (all order types), `GET /api/v2/orders/stats`; tab filters: all/active/closed/cancelled; `created_at DESC` sort; AFC company scoping
- `af-platform/src/app/actions/orders.ts` — `listOrdersAction` + `fetchOrderStatsAction`
- `af-platform/src/app/(platform)/orders/page.tsx` — unified orders list page

**Modified:**
- `af-server/main.py` — registered orders router at `/api/v2/orders`
- `af-platform/src/components/shell/Sidebar.tsx` — Orders nav item added

### 5. Orders Page Polish (direct edits, post-Opus review)
Multiple rounds of direct edits to `orders/page.tsx` and `Sidebar.tsx`:

**Orders page:**
- Rebuilt to match freight shipments table style: same column structure (Order ID · Status · Type · Route · Company · Created · Actions), `min-w-max` table, skeleton loading, row count footer
- Status column replaced text badge with icon (same icon vocabulary as `ShipmentOrderTable` for shipments; Truck/AlertTriangle for transport)
- Actions menu (⋯) added via React portal: View Details, Copy Order ID (AFU only) + Delete + Hard Delete
- Delete: soft delete via `deleteShipmentOrderAction(id, false)` or `deleteGroundTransportOrderAction(id, false)`
- Hard Delete: `hard=true` equivalent; dark red-900 header modal matching freight shipments pattern exactly
- Both delete options have confirmation dialogs before executing; error display; loading spinner
- `accountType` state added; delete options gated to `accountType === 'AFU'`
- TEST badge on Order ID cell; parent link icon when `parent_order_id` set

**Sidebar:**
- Final structure: flat list under OPERATIONS (no dropdown)
  - All Orders → `/orders` (exact match active state)
  - Freight Shipments → `/orders/shipments`
  - Deliveries → `/orders/deliveries`
  - Haulage → `/orders/haulage`
- "Freight Shipments" replaces old "Shipments" label
- Old flat "Shipments" and "Ground Transport" links removed
- Correct active state logic: `/orders` uses exact match to avoid lighting up when on sub-routes

---

## Current State

### Platform Version
- **Live:** v5.01
- **Ready to deploy:** v5.02 (all changes committed locally)

### Test Results
- 279/299 passing (unchanged from session start — no test file updates this session)
- GT-10 through GT-13 (is_test badge visibility, non-AFU access) remain PENDING smoke test

### Routes
| Route | Status |
|---|---|
| `/orders` | ✅ Built — unified all orders list |
| `/orders/shipments` | ⚠️ 404 — sidebar link exists, page not yet built |
| `/orders/deliveries` | ⚠️ 404 — sidebar link exists, page not yet built |
| `/orders/haulage` | ⚠️ 404 — sidebar link exists, page not yet built |
| `/shipments` | ✅ Still active (not retired) |
| `/ground-transport` | ✅ Still active (not retired) |

---

## Files Modified This Session

### Backend (`af-server`)
- `af-server/core/db_queries.py` — `is_test` added to `list_shipments` query
- `af-server/routers/orders.py` — NEW
- `af-server/main.py` — orders router registered

### Frontend (`af-platform`)
- `af-platform/src/app/actions/shipments.ts` — `is_test` in `ShipmentListItem`
- `af-platform/src/app/actions/orders.ts` — NEW
- `af-platform/src/app/(platform)/shipments/page.tsx` — `toShipmentOrder()` spread fix
- `af-platform/src/app/(platform)/orders/page.tsx` — NEW (full build + multiple polish passes)
- `af-platform/src/app/(platform)/ground-transport/page.tsx` — portal fix for actions menu
- `af-platform/src/components/shipments/ShipmentOrderTable.tsx` — TEST badge in ShipmentRow
- `af-platform/src/components/shell/Sidebar.tsx` — Orders nav restructure (flat, no dropdown)

---

## On the Horizon

### Immediate (next session)
- Smoke test v5.02 on prod: DG badge, TEST badge, orders page tabs, delete actions
- Smoke test GT-10–GT-13 (is_test badge, non-AFU access)
- Verify `/orders` route count badges and stats endpoint working on prod

### Pending Design / Build
- `/orders/shipments` — Freight Shipments sub-page (filtered orders view)
- `/orders/deliveries` — Deliveries sub-page (transport + trucking)
- `/orders/haulage` — Haulage sub-page (transport + haulage)
- Ground transportation design discussion (separate, pending)
- API Contract update for v5.02 endpoints (parallel session)

### Deferred
- v4.03 prompt (route node timing redesign) — parked
- Operations Playbook session (with Jermaine)
- AI agent phases (BL parsing, Incoterm tasks, WhatsApp, Gmail)
- New development PC (prod/dev API key separation)

---

## Key Reminders
- `db_queries.py` was modified — backend deploy required for DG + TEST badges to appear on shipments list
- No DB migration needed for any v5.02 changes
- Stats endpoint is inlined in `orders.py` (not in `db_queries.py`) — self-contained by design
- Portal dropdown standard applies to all future floating menus — see comment at top of `ShipmentOrderTable.tsx`
