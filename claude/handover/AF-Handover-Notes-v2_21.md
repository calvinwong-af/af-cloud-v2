# AF Handover Notes — v2.21
**Date:** 28 February 2026
**Session:** BL Update fixes, datetime inputs, task visibility, port pair review
**Previous:** v2.20

---

## Completed This Session

### 1. BL Update — File Serialization Fix (BLOCKING)
**Root cause:** `File` object passed as plain property in Server Action payload — Next.js cannot serialize `File` across server action boundary. Request never reached af-server (~15s timeout, silent 200).
**Fix:** `updateShipmentFromBLAction` now accepts `FormData` directly. `BLUpdateModal.tsx` builds FormData in `handleUpdate` and passes it. Both confirmed working.
**Files:** `af-platform/src/app/actions/shipments-write.ts`, `af-platform/src/components/shipments/BLUpdateModal.tsx`

### 2. Vessel / Voyage Display
**Fix:** `update_from_bl` server handler now writes flat `vessel_name` / `voyage_number` fields alongside `booking{}` dict. Detail page reads with fallback: flat field first, then `booking.vessel_name`.
**Transport section** added to Overview tab — renders only if at least one field has a value.
**Status:** Code in place. BL-16 / BL-17 not yet confirmed — needs test on AFCQ-003829.
**Files:** `af-server/routers/shipments.py`, `af-platform/src/app/(platform)/shipments/[id]/page.tsx`

### 3. Task Timestamps
- All task card dates now show date + time: "28 Feb 2026, 14:30"
- COMPLETED tasks — edit button now visible (status guard removed)
- `actual_start`, `actual_end`, `completed_at` editable on completed tasks
- TS-01 ✅, TS-02 ✅, TS-07 ✅ confirmed

### 4. DateInput / DateTimeInput Components
New shared component: `af-platform/src/components/shared/DateInput.tsx`
- `DateInput` — DD/MM/YYYY text input with calendar dropdown (portaled), auto-slash formatting
- `DateTimeInput` — same + time picker: two numeric fields (HH / mm) with colon separator, arrow key increment
- Applied to 10 inputs across: ShipmentTasks, BLUpdateModal, BLUploadTab, RouteNodeTimeline
- DT series tests deferred — will test as encountered in normal use

### 5. Task Visibility (Customer View)
- Hidden task: full opacity, no strikethrough, EyeOff icon with amber highlight
- Visible task: Eye icon default muted style
- TV-01 through TV-04 ✅ all confirmed

---

## Open Items

### BL-16 / BL-17 — Transport Section Not Visible
**Suspected cause:** `ShipmentOrder` TypeScript type likely missing `booking` field declaration. The section renders conditionally — if `booking` is typed as `undefined`, the condition `order.booking` is always falsy.
**Fix:** Add `booking` to `ShipmentOrder` type in `af-platform/src/lib/types.ts`:
```typescript
booking?: {
  booking_reference?: string;
  carrier_agent?: string;
  vessel_name?: string;
  voyage_number?: string;
} | null;
```
**Test after:** Run BL update on AFCQ-003829, check Overview tab for Transport section.

---

## Next Session — Port Pair Display Standardisation

### Problem
Port pair shown in three places, each with different treatment:

| Location | Current Display | Issues |
|---|---|---|
| Route Node Timeline | Circle badges, POL/POD labels, ETD/ETA | Port code only, no name |
| Shipment Detail Route card | Large bold UN codes, Origin/Dest labels, Incoterm | Raw UN code (MYPKG_N not enriched), no ETD/ETA |
| Task cards (TRACKED tasks) | No port display | Port context missing |

### Goal
Single canonical `PortPair` component used everywhere with consistent:
- Port code (primary) + port name (secondary, if available)
- Country code
- Role label (Origin / Destination / POL / POD depending on context)
- Optional ETD / ETA
- Incoterm (where relevant)

### Design Questions to Resolve
1. Should port name always show, or only when different from code?
2. POL/POD vs Origin/Destination labelling — context-dependent or unified?
3. Should route card in detail header show ETD/ETA inline or keep it in Timeline only?
4. MYPKG_N — is the `_N` suffix a data quality issue on V1 records or intentional?

---

## Test List Status
See `claude/tests/AF-Test-List.md` v1.3
- 11 items confirmed ✅
- BL-16, BL-17, TS-03 through TS-06 still open
- DT series deferred

---

## Files Modified This Session
| File | Change |
|---|---|
| `af-platform/src/app/actions/shipments-write.ts` | `updateShipmentFromBLAction` accepts FormData |
| `af-platform/src/components/shipments/BLUpdateModal.tsx` | Builds FormData in handleUpdate; DateInput for ETD; inline editable cargo/container tables |
| `af-platform/src/components/shipments/ShipmentTasks.tsx` | formatDateTime helper; edit on completed tasks; DateTimeInput for actual times; task visibility amber style |
| `af-platform/src/components/shipments/BLUploadTab.tsx` | DateInput for ETD |
| `af-platform/src/components/shipments/RouteNodeTimeline.tsx` | DateInput for route timing fields |
| `af-platform/src/components/shared/DateInput.tsx` | New — DateInput + DateTimeInput shared components |
| `af-platform/src/app/(platform)/shipments/[id]/page.tsx` | Transport section added; vessel/voyage fallback read logic |
| `af-server/routers/shipments.py` | update_from_bl writes flat vessel_name/voyage_number; file bytes read early |
