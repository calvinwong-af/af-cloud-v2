# Handover Notes — v2.22
**Date:** 28 February 2026
**Session type:** Testing + Debugging + Prompt Prep

---

## Session Summary

Testing session for work deployed in v2.21. Three bugs found and fixed live during the session. New VS Code prompt prepared for next session.

---

## Confirmed ✅ This Session

| Test | Notes |
|---|---|
| DT-10 | DateTimeInput two-digit hour/minute input — confirmed working |
| BL-16 | Vessel and voyage display after BL update — fixed and confirmed |
| BL-17 | Transport card visible on Overview tab after BL update — fixed and confirmed |

---

## Bugs Fixed This Session (Both in Next.js layer — no af-server changes)

### Fix 1 — `v1-assembly.ts` booking merge (BL-16/BL-17)
**File:** `af-platform/src/lib/v1-assembly.ts`

**Root cause:** `assembleV1ShipmentOrder` merged booking with:
```typescript
booking: (oldShipmentOrder?.booking ?? q.booking) ?? null
```
`oldShipmentOrder.booking` on V1 records is a legacy object with all fields set to `null` — not null itself. The `??` operator never fell through to `q.booking` (which has the real data written by BL update).

**Fix:** Replaced with explicit falsy check on meaningful vessel fields:
```typescript
booking: (() => {
  const soBooking = oldShipmentOrder?.booking ?? null;
  const qBooking = q.booking ?? null;
  if (!soBooking) return qBooking;
  const soHasData = soBooking.vessel_name || soBooking.voyage_number || soBooking.bl_number || soBooking.booking_reference;
  return soHasData ? soBooking : (qBooking ?? soBooking);
})()
```

### Fix 2 — `shipments.py` V1 detail merge (defensive fix)
**File:** `af-server/routers/shipments.py`

**Root cause:** Same pattern — V1 detail endpoint merged fields from Quotation into ShipmentOrder response using `is None` check, which missed empty string `""` fields.

**Fix:** Changed `if field not in data or data[field] is None` to `if not data.get(field)` for the vessel/voyage/booking merge block.

Note: This fix is defensive — the real data path for the detail page goes through the Next.js assembly layer (Fix 1), not af-server. Both fixed for correctness.

---

## Design Decisions Confirmed This Session

### Port pair display
- Port name: tooltip/hover only (never persistent text) — already implemented
- Labels: POL/POD for AFC staff, Origin/Destination for AFU customers — already implemented
- ETD/ETA: shown below respective port codes — already implemented

### Vessel display (new — confirmed this session)
- **Route card header:** Vessel name + voyage number as muted subtitle row below port pair
- **TRACKED task cards (POL/POD only):** Vessel name + voyage number shown inline on card
- ETD/ETA remain on the port codes, not on the vessel row

### POL/POD task timing labels (new — confirmed this session)
- TRACKED POL tasks: `scheduled_start/end` → ETD, `actual_start/end` → ATD
- TRACKED POD tasks: `scheduled_start/end` → ETA, `actual_start/end` → ATA
- Non-TRACKED tasks: keep existing generic labels unchanged

---

## Pending — Next VS Code Session

Prompt written to: `af-cloud-v2/claude/prompts/PROMPT-CURRENT.md`

Three tasks:
1. **Task label changes** — POL/POD TRACKED tasks show ETD/ATD and ETA/ATA labels
2. **Vessel in route card** — Vessel name + voyage as subtitle row below PortPair component
3. **Vessel on task cards** — Pass vessel data down prop chain from page.tsx → ShipmentTasks → TRACKED POL/POD cards

---

## Test Status at End of Session

Full test run deferred to next session. Current confirmed tests:

**Confirmed ✅:** TS-01–07, TV-01–04, BL-05, BL-07–10, BL-12, BL-16, BL-17, GS-01, GS-03–07, DT-10

**Pending test (deployed, not yet tested):**
- PP-01 to PP-10 (PortPair component)
- DT-01 to DT-05, DT-12 to DT-16 (ETD/ETA DateTimeInput changes)
- BL-01 to BL-04, BL-06, BL-11, BL-13 to BL-15 (various BL features)
- GS-02 (V2 shipment loads)

---

## Files Modified This Session

| File | Change |
|---|---|
| `af-platform/src/lib/v1-assembly.ts` | Fix booking merge — falsy check on vessel fields |
| `af-platform/src/lib/shipments.ts` | Debug logs added then removed (no net change) |
| `af-server/routers/shipments.py` | Fix V1 detail merge — falsy check on field values |
| `af-cloud-v2/claude/tests/AF-Test-List.md` | Updated to v1.6 — BL-16/17 marked ✅ |
| `af-cloud-v2/claude/prompts/PROMPT-CURRENT.md` | New prompt — task labels + vessel display |
