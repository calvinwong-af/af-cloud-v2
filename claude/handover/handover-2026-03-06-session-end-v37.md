# Session 37 Handover — AcceleFreight v2
**Date:** 2026-03-06  
**Version:** v5.05 Live (deployed) | v5.06 Prompt Ready  
**Tests:** ~270/284 (verify at session start)

---

## Session Work

### Completed This Session
- **v5.04** — Numeric/string status mismatch fix (backend write paths) — DONE & deployed
- **v5.05** — "Create as Confirmed" option on new shipment modal — DONE

### Prompt Written (NOT YET EXECUTED)
- **v5.06** — Status consistency sweep — `PROMPT-CURRENT.md` is ready for Opus

---

## v5.06 — Status Consistency Sweep

### Context
AF-003861 (v1 legacy shipment) was reported stuck — stepper broken, status update to "Arrived" not showing. Investigation revealed a **systemic mismatch** across the entire stack: the DB now stores string status (`'in_progress'`), but multiple read paths still assume integer codes (`4001`).

### Root Cause
The unified orders architecture (v5.00) changed `orders.status` to string + `orders.sub_status` for granularity. v5.04 fixed the **write paths**. v5.06 fixes the **read paths**.

### Fixes in Prompt (6 items, 6 files)

**Backend — `af-server`:**

1. **`af-server/routers/shipments/core.py`** — `status_label` in search uses `STATUS_LABELS` (integer-keyed dict) to look up a string status. Fix: use `get_status_display(status, sub_status)` from `constants.py` instead. Two places in this file.

2. **`af-server/core/db_queries.py`** — Three issues:
   - `search_shipments`: same `status_label` lookup bug — same fix
   - `list_shipments`: returns raw string `status` to frontend — fix: convert to numeric at API boundary using `SUB_STATUS_TO_NUMERIC` / `STRING_STATUS_TO_NUMERIC`
   - `get_shipment_by_id`: same raw string issue — same conversion fix
   - **DB stores strings (correct). API must return numerics (frontend contract).**

**Frontend — `af-platform`:**

3. **`af-platform/src/lib/types.ts`** — Add exported `normalizeStatusToNumeric(status, subStatus?)` utility function. Single source of truth used by all 3 frontend files.

4. **`af-platform/src/app/(platform)/shipments/[id]/_components.tsx`** — Two fixes:
   - `StatusCard`: add normalization at top (`currentStatus = normalizeStatusToNumeric(order.status, sub_status)`)
   - `PartiesCard`: normalize before `canEditParties` check
   - Sub-step dialog: remove `({s.status})` numeric code span

5. **`af-platform/src/components/shipments/ShipmentOrderTable.tsx`** — `StatusIcon` uses `iconMap[order.status]` keyed by integer. Strings resolve to `undefined` → wrong icon. Fix: normalize before lookup.

6. **`af-platform/src/app/(platform)/orders/shipments/page.tsx`** — Search summary badge filters compare `r.status` against numeric literals. Fix: normalize before comparison.

### Verification After v5.06
- AF-003861: stepper shows correct position; badge shows "Arrived" not "in_progress"
- Draft tab count correct for new shipments
- Search `status_label` shows "Booking Confirmed" not "booking_confirmed"  
- Status icons in list correct per status
- Sub-step dialog: labels only, no `(4001)` codes
- Parties edit button visible on non-terminal shipments

---

## Pending Work Queue

### Immediate (after v5.06 Opus execution)
1. Run Opus on v5.06 prompt
2. Deploy af-server (v5.04+v5.05 already done? Confirm)
3. Run `af-server/scripts/backfill_numeric_status.py` on **prod DB** if not yet done
4. Smoke test AF-003861 on prod after deploy

### Backlog (active)
- BL-01 Search Pagination — completed as v4.22 (closed)
- BL-03 Transport Card Inline Edit — completed as v4.24 (closed)
- Delete retired route folders: `shipments/` and `ground-transport/` (stubs remain)
- Move detail routes: `shipments/[id]` → `orders/shipments/[id]`, `ground-transport/[id]` → `orders/deliveries/[id]`
- Update `orders/page.tsx` action menu links to new detail paths

### Design/Build (deferred)
- `/orders/haulage` page design
- GT smoke tests (GT-10 through GT-13)
- Geography → Pricing → Quotation workstream (designed; implementation status unknown)
- Ground transportation design (not yet scoped)
- Operations Playbook (Jermaine — deferred post core)
- AI agent phases (all deferred post core)

---

## Key Architecture Reminders

- **DB:** `orders.status` = string (`'draft'`, `'confirmed'`, `'in_progress'`, `'completed'`, `'cancelled'`)
- **DB:** `orders.sub_status` = string (`'confirmed'`, `'booking_pending'`, `'booking_confirmed'`, `'in_transit'`, `'arrived'`, null)
- **API boundary:** Backend must translate string → numeric before responding to frontend
- **Frontend type:** `ShipmentOrderStatus` is a numeric union — do not change
- **Write path:** `NUMERIC_TO_STRING_STATUS` in `constants.py` — already correct since v5.04
- **Path A vs Path B:** Incoterm + transaction_type determines which statuses are valid (booking nodes vs skip)
- **Status history:** Still stores numeric codes for backwards compat — do not change

---

## File Locations
- Active prompt: `claude/prompts/PROMPT-CURRENT.md`
- Prompt log: `claude/prompts/log/PROMPT-LOG-v5.00-v5.10.md`
- Tests master: `claude/tests/AF-Test-Master.md`
- Backlog: `claude/other/AF-Backlog.md`
- API Contract: `claude/other/AF-API-Contract.md`
- Backfill script: `af-server/scripts/backfill_numeric_status.py`
