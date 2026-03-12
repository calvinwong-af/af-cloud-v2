# Handover — Session 117 End | v6.33 Prompt Ready

**AF Dev — Session 117 | AcceleFreight v2 | v6.30 Live | v6.33 Prompt Ready | Tests v2.61 (272/286)**

---

## Session Summary

Three workstreams completed this session:

### 1. Shipment Status Bug Fix (v6.31)
Resolved collision between `status = 'completed'` (string, written by pipeline step 5001) and `completed = TRUE` (boolean, required to unlock invoicing).

**Decisions locked:**
- `4002` (Arrived) = terminal pipeline node, labelled "End"
- `5001` removed from `STATUS_PATH_A` and `STATUS_PATH_B`
- `completed` boolean stays — can be set manually at any time
- When status advances to `4002`, auto-set `completed = TRUE`

**Files changed by Opus (v6.31):**
- `af-platform/src/lib/types.ts` — removed 5001 from path arrays
- `af-platform/src/app/(platform)/shipments/[id]/_components.tsx` — removed 5001 special case from `handleFutureNodeClick`, added auto-complete trigger on 4002, removed `5001` guard on "Mark Complete" button

**Pending data fix (not yet run):**
```sql
UPDATE orders SET completed = TRUE WHERE status = 'completed' AND completed = FALSE;
```
Run against prod via Auth Proxy before next test of invoicing flow.

---

### 2. Quotation Module — Backend (v6.32)
**Migration 046** applied to prod successfully.

**Table: `quotations`**
- `quotation_ref` — `AFQ-XXXXXXXX` format via `quotation_ref_seq`
- `shipment_id` FK → `orders(order_id) ON DELETE RESTRICT`
- `scope_snapshot JSONB` — scope flags at creation time
- `transport_details JSONB` — array of `{leg, vehicle_type_id, address}`
- `revision INTEGER` — increments per shipment (revisions allowed)
- `status` — DRAFT | SENT | ACCEPTED | REJECTED | EXPIRED

**Router: `af-server/routers/quotations.py`**
- `POST /api/v2/quotations` — create
- `GET /api/v2/quotations?shipment_id=` — list by shipment
- `GET /api/v2/quotations/{quotation_ref}` — single

**Bug fixes applied during migration:**
- FK was incorrectly referencing `orders(quotation_id)` — corrected to `orders(order_id)`
- Router also had same error — corrected
- `update_updated_at()` function added inline in migration (was missing from DB)

---

### 3. Quotation Module — Frontend (v6.33 — PROMPT READY, NOT YET RUN)

**Prompt written to `claude/prompts/PROMPT-CURRENT.md`**. Has not been executed in Opus yet.

**What v6.33 builds:**
1. `af-platform/src/app/actions/quotations.ts` — `createQuotationAction`, `listQuotationsAction`
2. `af-platform/src/components/shipments/CreateQuotationModal.tsx` — 3-step modal:
   - Step 1: Scope confirmation (reuses ScopeConfigDialog UI pattern)
   - Step 2: Transport details (vehicle type + address per ASSIGNED first_mile/last_mile leg)
   - Step 3: Review & confirm with notes
3. `af-platform/src/app/(platform)/shipments/[id]/page.tsx` — wiring: "Create Quotation" button, containerSizes helper, modal render, success banner

**Vehicle type → container size mapping (FCL):**
- `'20'` → `trailer_20`
- `'40'` → `trailer_40`
- `'40HC'` → `trailer_40`
- LCL/AIR → lorry options only, no default

---

## Immediate Next Actions

1. **Run v6.33 in Opus** — frontend modal (PROMPT-CURRENT.md is ready)
2. **Run data fix SQL** — `UPDATE orders SET completed = TRUE WHERE status = 'completed' AND completed = FALSE`
3. After v6.33: **v6.34** — quotation list/history display on shipment page (read existing quotations for a shipment, show revision history)

---

## Files Modified This Session

| File | Change |
|------|--------|
| `af-platform/src/lib/types.ts` | Removed 5001 from STATUS_PATH_A, STATUS_PATH_B |
| `af-platform/src/app/(platform)/shipments/[id]/_components.tsx` | Status bug fixes (5001 removal, auto-complete on 4002) |
| `af-server/migrations/046_quotations.sql` | New — quotations table |
| `af-server/scripts/run_migration_046.py` | New — migration runner |
| `af-server/routers/quotations.py` | New — quotations API |
| `af-server/main.py` | Router registered |
| `claude/prompts/PROMPT-CURRENT.md` | v6.33 ready |

---

## State Snapshot

- **Live version:** v6.30 (air freight list price edit bug fix)
- **Prompt ready:** v6.33 (quotation frontend modal)
- **Migration on prod:** 046_quotations.sql applied ✓
- **Tests:** v2.61 — 272/286 passing (no new tests this session)
- **Stale file to note:** `af-server/migrations/039_quotations.sql` was already deleted by Calvin
