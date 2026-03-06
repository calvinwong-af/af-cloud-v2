# Session 38 Handover — AcceleFreight v2
**Date:** 2026-03-07
**Version:** v5.05 Live (deployed) | v5.06 Prompt Ready (unchanged from v37)
**Tests:** ~270/284 (unchanged — no Opus prompt executed this session)

---

## Session Work

This was a debugging/hotfix session. No Opus prompts were executed. All fixes were applied directly via MCP.

### Fixes Applied (MCP direct edits)

**1. Status 1002 — distinct string mapping**
- `af-server/core/constants.py` — `NUMERIC_TO_STRING_STATUS[1002]` was `("draft", None)` same as 1001. Changed to `("pending_review", None)`. Also added `"pending_review": 1002` to `STRING_STATUS_TO_NUMERIC`.
- `af-platform/src/lib/types.ts` — Added `if (s === 'pending_review') return 1002` to `normalizeStatusToNumeric`.
- **Effect:** Status 1002 no longer reverts to Draft on page reload.

**2. Upload Document button — visibility fix**
- `af-platform/src/app/(platform)/shipments/[id]/page.tsx` — Changed `order.status >= 2001` to `order.status !== -1` for the Upload Document button condition.
- **Effect:** Upload Document now visible for Draft (1001), Pending Review (1002), and all active statuses — not just Confirmed+.

**3. `order_type` overwrite bug — critical fix**
- `af-server/core/db_queries.py` — `get_shipment_by_id` was spreading `orders.*` which includes `order_type = 'shipment'` (the system discriminator), overwriting the freight mode. Added explicit override: `data["order_type"] = data.get("order_type_detail") or ""`.
- **Effect:** Detail API now correctly returns `"SEA_FCL"`, `"AIR"` etc. instead of `"shipment"`.

**4. AWB upload rejection — downstream fix of #3**
- The `DocumentParseModal` `allowedTypes` check was failing for AIR shipments because `order.order_type` was `'shipment'` instead of `'AIR'`. Fix #3 resolves this — no additional code change needed.
- **Effect:** AWB documents can now be uploaded on AIR shipments.

**5. V1 numeric string statuses — data backfill**
- `AF-003859` was invisible in the Active list because its `orders.status = '3002'` (raw numeric string) — the active tab filter `o.status IN ('confirmed', 'in_progress')` never matched it.
- Root cause: V1 migrated records that already had numeric strings in the legacy `shipments` table were not converted by Migration 011's CASE statement.
- Fix: ran `af-server/scripts/backfill_numeric_status.py` on **both local and prod DB**.
- `AF-003859` now shows `status = 'in_progress'`, `sub_status = 'booking_confirmed'` and is visible in Active list.

**6. Diagnostic script added**
- `af-server/scripts/diagnose_order.py` — new utility script. Takes an order ID as argument, prints key columns from `orders` + `shipment_details` and evaluates whether the record would appear in the list and Active tab. Useful for future debugging.

---

## Pending Work Queue

### Immediate
1. **Run Opus on v5.06 prompt** — `claude/prompts/PROMPT-CURRENT.md` is ready, unchanged from v37
2. **Deploy af-server** — Session 38 MCP fixes (constants.py, db_queries.py) need deploy to prod
3. **Deploy af-platform** — Session 38 MCP fixes (types.ts, page.tsx) need deploy to prod
4. **Smoke test after deploy:**
   - AIR shipment AWB upload (was broken — fix #3/#4)
   - Status 1002 → Pending Review does not revert to Draft on reload (fix #1)
   - Upload Document visible on Draft shipments (fix #2)
   - AF-003859 visible in Active list on prod (fix #5 — data already fixed)

### Backlog (active)
- Delete retired route folders: `shipments/` and `ground-transport/` (stubs remain)
- Move detail routes: `shipments/[id]` → `orders/shipments/[id]`, `ground-transport/[id]` → `orders/deliveries/[id]`
- Update `orders/page.tsx` action menu links to new detail paths
- GT smoke tests (GT-10 through GT-13)

### Design/Build (deferred)
- `/orders/haulage` page design
- Geography → Pricing → Quotation workstream (designed; implementation status unknown)
- Ground transportation design (not yet scoped)
- Operations Playbook (Jermaine — deferred post core)
- AI agent phases (all deferred post core)

---

## Key Architecture Reminders

- **DB:** `orders.status` = string (`'draft'`, `'pending_review'`, `'confirmed'`, `'in_progress'`, `'completed'`, `'cancelled'`)
- **DB:** `orders.sub_status` = string (`'confirmed'`, `'booking_pending'`, `'booking_confirmed'`, `'in_transit'`, `'arrived'`, null)
- **DB:** `orders.order_type` = `'shipment'` or `'transport'` — system discriminator ONLY, never the freight mode
- **DB:** `shipment_details.order_type_detail` = `'SEA_FCL'` / `'SEA_LCL'` / `'AIR'` — the freight mode
- **API boundary:** Backend must translate string → numeric before responding to frontend
- **Frontend type:** `ShipmentOrderStatus` is a numeric union — do not change
- **Status 1001** = Draft, **1002** = Pending Review (distinct since this session)
- **Backfill script:** `af-server/scripts/backfill_numeric_status.py` — already run on prod; safe to re-run

---

## File Locations
- Active prompt: `claude/prompts/PROMPT-CURRENT.md` (v5.06 — unchanged, ready for Opus)
- Prompt log: `claude/prompts/log/PROMPT-LOG-v5.00-v5.10.md`
- Tests master: `claude/tests/AF-Test-Master.md`
- Backlog: `claude/other/AF-Backlog.md`
- API Contract: `claude/other/AF-API-Contract.md`
- Diagnostic script: `af-server/scripts/diagnose_order.py`
- Backfill script: `af-server/scripts/backfill_numeric_status.py`
