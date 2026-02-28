# VS Code Prompt — Task Card Labels + Vessel Display
**Date:** 28 February 2026
**Prepared by:** Claude AI
**For:** Opus 4.6 via VS Code

---

## Context

AcceleFreight platform (Next.js + TypeScript + Tailwind). Strangler-fig migration from Vue TMS. All work must be backward-compatible with V1 (AFCQ-) Datastore records.

Shipment tasks are rendered in `ShipmentTasks.tsx`. Each task has a `mode` field — tasks with `mode === "TRACKED"` represent physical port events (Port of Loading, Port of Discharge). These tasks currently show generic timing labels that don't match freight terminology.

Vessel and voyage data lives on `order.booking` (assembled by `assembleV1ShipmentOrder` in `v1-assembly.ts` for V1 records, or read directly for V2). The shipment detail page (`page.tsx`) holds the full `order` object in state but does not currently pass vessel data down to task cards.

---

## Task 1 — POL/POD Task Card Timing Labels

### Problem
TRACKED tasks at POL and POD show generic labels:
- `Sched. End`, `Started`, `Completed`

These should reflect freight terminology based on the task's port role.

### Required Label Changes

| Field | POL task (role: POL) | POD task (role: POD) | Non-TRACKED task |
|---|---|---|---|
| `scheduled_start` | ETD | ETA | Sched. Start |
| `scheduled_end` | ETD | ETA | Sched. End |
| `actual_start` | ATD | ATA | Started |
| `actual_end` | ATD | ATA | Completed |
| `completed_at` | ATD | ATA | Completed |

### Logic
- Only apply freight labels when `task.mode === "TRACKED"`
- Determine POL vs POD from `task.task_type`:
  - `task_type === "POL"` → use ETD / ATD
  - `task_type === "POD"` → use ETA / ATA
- All other tasks (mode !== TRACKED, or task_type not POL/POD) → keep existing generic labels
- This is a display-only change — field names (`scheduled_start`, `actual_end` etc.) do not change

### File
`af-platform/src/components/shipments/ShipmentTasks.tsx`

Find where timing field labels are rendered (look for "Sched. End", "Started", "Completed" strings) and apply the conditional label logic above.

---

## Task 2 — Vessel + Voyage in Route Card Header

### Problem
The route card shows port pair + ETD/ETA but no vessel information. Vessel and voyage are key identifiers for a sea freight shipment and should be visible at a glance without needing to open the Overview tab.

### Design
Add vessel name and voyage number as a subtitle row below the port pair inside the existing `RouteCard` component, centered between the two ports:

```
[POL]  ——[Ship icon]——  [POD]
ETD: 15 Feb 2026          ETA: 28 Feb 2026

        MTT LUMUT  ·  V.26LM073E
```

- Only render the vessel row if at least one of `vessel_name` or `voyage_number` is present
- Muted small text — this is supplementary info, not primary
- Ship icon (lucide `Ship`) before vessel name
- Dot separator between vessel name and voyage number
- If only one field present, show just that field without the separator

### Data Source
The detail page (`page.tsx`) already loads `order` which contains `order.booking`. The booking object (after the v1-assembly fix applied today) contains:
```typescript
{
  vessel_name: string | null,
  voyage_number: string | null,
  booking_reference: string | null,
  carrier_agent: string | null,
}
```

### Changes Required

**In `page.tsx`:**
- Extract `vessel_name` and `voyage_number` from `order.booking` and pass as props to `RouteCard`

**Update `RouteCard` props:**
```typescript
function RouteCard({ order, accountType, etd, eta, vesselName, voyageNumber }: {
  order: ShipmentOrder;
  accountType: string | null;
  etd?: string | null;
  eta?: string | null;
  vesselName?: string | null;
  voyageNumber?: string | null;
})
```

**Inside `RouteCard`:** Add vessel row below the `<PortPair>` component, above the card bottom edge.

---

## Task 3 — Vessel + Voyage on TRACKED Task Cards

### Problem
TRACKED task cards (POL/POD) have no vessel information displayed. Since these tasks directly represent vessel departure/arrival events, the vessel name and voyage should be visible on the card.

### Design
Add a small vessel info row at the bottom of TRACKED task cards (POL and POD only):

```
[Ship icon]  MTT LUMUT  ·  V.26LM073E
```

- Small muted text, same style as other supplementary info on task cards
- Only render if at least one of vessel_name / voyage_number is present
- Only on tasks where `mode === "TRACKED"` and `task_type` is `"POL"` or `"POD"`

### Data Source Challenge
`ShipmentTasks.tsx` currently receives `shipmentId`, `orderType`, `accountType`, `userRole` as props — it does NOT receive the full shipment order or booking data. Vessel info needs to be passed in.

**Investigate the prop chain:**
1. `page.tsx` holds `order.booking` with vessel data
2. `ShipmentTasks` is rendered in `page.tsx` — add `vesselName` and `voyageNumber` as optional props
3. Pass them down from `page.tsx` into `ShipmentTasks`
4. Inside `ShipmentTasks`, pass to individual task card render where `mode === "TRACKED"` and `task_type` is POL or POD

### Files
- `af-platform/src/app/(platform)/shipments/[id]/page.tsx` — extract vessel from order.booking, pass to ShipmentTasks
- `af-platform/src/components/shipments/ShipmentTasks.tsx` — accept vesselName/voyageNumber props, render on TRACKED POL/POD cards

---

## Files Expected to be Modified

| File | Change |
|---|---|
| `af-platform/src/components/shipments/ShipmentTasks.tsx` | Task 1 (label changes) + Task 3 (vessel on task cards) |
| `af-platform/src/app/(platform)/shipments/[id]/page.tsx` | Task 2 (pass vessel to RouteCard) + Task 3 (pass vessel to ShipmentTasks) |
| `af-platform/src/components/shared/PortPair.tsx` | Task 2 — vessel row added inside RouteCard (may be inside PortPair or RouteCard depending on Opus assessment) |

---

## Do Not Change
- Field names on task objects (`scheduled_start`, `actual_end` etc.)
- `ShipmentTasks` fetch logic or task update handlers
- `PortPair` component props interface (unless Opus determines vessel row belongs inside it)
- `assembleV1ShipmentOrder` in `v1-assembly.ts` — fixed today, do not touch
- `booking` field structure on `ShipmentOrder`

---

## Tests to Run After

- TRACKED POL task card shows `ETD` / `ATD` labels instead of `Sched. End` / `Started`
- TRACKED POD task card shows `ETA` / `ATA` labels instead of `Sched. End` / `Completed`
- Non-TRACKED tasks retain generic labels unchanged
- Route card shows vessel name + voyage below port pair (test on AFCQ-003829 — MTT LUMUT · V.26LM073E)
- Route card vessel row absent on shipment with no BL update (no vessel data)
- TRACKED POL/POD task cards show vessel name + voyage inline
- Non-TRACKED and non-POL/POD task cards do not show vessel info
