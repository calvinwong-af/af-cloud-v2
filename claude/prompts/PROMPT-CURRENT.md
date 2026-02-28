# VS Code Prompt — Port Pair Display Standardisation
**Date:** 28 February 2026
**Prepared by:** Claude AI
**For:** Opus 4.6 via VS Code

---

## Context

AcceleFreight platform (Next.js + TypeScript + Tailwind). We are in the strangler-fig migration from a Vue TMS to the new platform. All work must be backward-compatible with V1 (AFCQ-) Datastore records.

Port pairs currently appear in three places with inconsistent treatment:

| Location | Current | Problems |
|---|---|---|
| `RouteCard` in `shipments/[id]/page.tsx` | Large bold UN code, "Origin / Destination" labels, optional name below | Port codes displayed as-is (MYPKG_N decision pending), no ETD/ETA |
| `RouteNodeTimeline.tsx` | Circle badges with POL/POD labels, ETD/ETA shown | Port code only, no name even on hover |
| Task cards (TRACKED tasks) | No port display | Out of scope for this session |

---

## Design Decisions (confirmed)

| Decision | Answer |
|---|---|
| Port name display | **Tooltip / hover only** — never show port name as persistent text |
| Label convention | **Context-dependent** — staff (AFC) sees POL/POD, customer (AFU) sees Origin/Destination |
| ETD / ETA location | **Both** — route card header AND timeline |
| MYPKG_N suffix | **Deferred** — display as-is for now, decision pending separate discussion |

---

## Task 1 — DateTimeInput Bug Fix (DT-10) + ETD/ETA Field Changes

### Bug: Two-digit hour/minute input broken
The `DateTimeInput` component in `af-platform/src/components/shared/DateInput.tsx` — the hour and minute numeric fields do not accept two-digit values. Typing `11`, `12`, `24`, `25` etc. fails; only single digits work.

Investigate the input handler logic. The likely cause is the field value being clamped or replaced after the first digit, preventing a second digit from being appended. Fix so that:
- The field accepts up to 2 digits
- Hour clamps to 0–23
- Minute clamps to 0–59
- Arrow key increment/decrement continues to work
- Single digit values (e.g. `9`) are accepted and displayed as `09` on blur

### Change: ETD/ETA fields → DateTimeInput everywhere
The following fields currently use `DateInput` (date only). Change all of them to `DateTimeInput` (date + time):

| File | Field |
|---|---|
| `af-platform/src/components/shipments/BLUpdateModal.tsx` | ETD |
| `af-platform/src/components/shipments/BLUploadTab.tsx` | ETD |
| `af-platform/src/components/shipments/RouteNodeTimeline.tsx` | scheduled_etd, actual_etd, scheduled_eta, actual_eta |

### Default time behaviour
When a user enters a date but leaves the time blank, the time must default to `00:00`. Specifically:
- On blur of the date portion, if time fields are empty, auto-populate HH as `00` and mm as `00`
- If the user manually enters a time, that value is used as-is
- Stored value format remains ISO datetime string (e.g. `2026-02-28T00:00:00`)

---

## Task 2 — BL-16 / BL-17 Quick Fix

### Problem
After a BL update on AFCQ-003829, the Transport section (vessel/voyage) does not appear on the Overview tab.

### Root Cause Suspected
`af-server/routers/shipments.py` — the `update_from_bl` handler writes `vessel_name` and `voyage_number` as flat fields on the Datastore entity AND inside the `booking` dict. The assembly layer function that builds the `ShipmentOrder` response (for the detail page fetch) may not be passing through flat `vessel_name`/`voyage_number` fields to the client.

### What to Check
1. Find the assembly function in `af-server` that converts raw Datastore entity → `ShipmentOrder` dict for the API response.
2. Confirm whether `vessel_name` and `voyage_number` are included in the response dict.
3. If missing, add them. The detail page (`page.tsx`) already reads with this pattern:
   ```typescript
   const vesselName = (order as Record<string, unknown>).vessel_name as string
     || bk.vessel_name as string || null;
   ```
   So if the server sends either flat field or inside `booking{}`, the UI will render it.

### Files Likely Involved
- `af-server/routers/shipments.py` — `update_from_bl` handler and assembly function

---

## Task 3 — Create `PortPair` Shared Component

### File to Create
`af-platform/src/components/shared/PortPair.tsx`

### Props Interface
```typescript
interface PortPairProps {
  // Port data
  origin: {
    port_un_code: string | null;
    port_name?: string | null;    // For tooltip
    country_code?: string | null;
  };
  destination: {
    port_un_code: string | null;
    port_name?: string | null;    // For tooltip
    country_code?: string | null;
  };

  // Context determines labelling
  viewContext: 'staff' | 'customer';

  // Optional scheduling data
  etd?: string | null;           // ISO date string — shown on origin side
  eta?: string | null;           // ISO date string — shown on destination side

  // Optional
  incoterm?: string | null;
  orderType?: string;            // 'SEA_FCL' | 'SEA_LCL' | 'AIR' etc. — for icon
  size?: 'lg' | 'sm';           // lg = route card header, sm = timeline node
}
```

### Labelling Logic
```typescript
// Staff (AFC) sees freight operations terminology
// Customer (AFU) sees plain language
const originLabel = viewContext === 'staff' ? 'POL' : 'Origin';
const destLabel   = viewContext === 'staff' ? 'POD' : 'Destination';
```

### Port Name Tooltip
- Port name (if provided) shown **only** as a `title` attribute tooltip on hover — no persistent text.
- If `port_un_code` is null/empty, show `—`.
- Apply `cursor-help` class when port name tooltip is available.

### ETD / ETA Display
- Below the port code, show ETD on the origin side and ETA on the destination side.
- Format using the existing `formatDate()` util from `@/lib/utils`.
- If no date: show a muted `—` placeholder.
- Label as `ETD` / `ETA` in small muted text above the formatted date.

### Sizing
- `lg` (default): `text-2xl font-bold font-mono` for port code — matches current RouteCard style.
- `sm`: `text-xs font-bold font-mono` — suitable for timeline nodes.

### Visual Layout (lg size)
```
[Origin label]          [arrow/icon]          [Destination label]
[PORT CODE]          ←  Ship/Plane  →          [PORT CODE]
[ETD: 15 Feb 2026]                             [ETA: 28 Feb 2026]
[Incoterm pill — full width below]
```

---

## Task 4 — Update `RouteCard` in `page.tsx`

### Current Location
`RouteCard` function component — approximately line 95–155 in `af-platform/src/app/(platform)/shipments/[id]/page.tsx`.

### Changes Required

**4a. Add ETD/ETA to RouteCard**
The detail page already fetches route nodes via `RouteNodeTimeline`. To avoid a second fetch, update the main page load (`loadOrder`) to also call `getRouteNodesAction` and extract:
- `etd` from the ORIGIN node's `scheduled_etd` (or `actual_etd` if present)
- `eta` from the DESTINATION node's `scheduled_eta` (or `actual_eta` if present)

Store these in component state. Pass them as props into `RouteCard`.

Update `RouteCard` props interface:
```typescript
interface RouteCardProps {
  order: ShipmentOrder;
  accountType: string | null;  // For viewContext
  etd?: string | null;
  eta?: string | null;
}
```

**4b. Replace port display with `PortPair` component**
Replace the current manual origin/destination JSX block inside `RouteCard` with the new `<PortPair>` component:
```typescript
<PortPair
  origin={{
    port_un_code: order.origin?.port_un_code ?? null,
    port_name: order.origin?.label ?? null,
    country_code: order.origin?.country_code ?? null,
  }}
  destination={{
    port_un_code: order.destination?.port_un_code ?? null,
    port_name: order.destination?.label ?? null,
    country_code: order.destination?.country_code ?? null,
  }}
  viewContext={accountType === 'AFU' ? 'customer' : 'staff'}
  etd={etd}
  eta={eta}
  incoterm={order.incoterm_code}
  orderType={order.order_type}
  size="lg"
/>
```
Remove the `incoterm` pill from `RouteCard` — it is now handled inside `PortPair`.

---

## Task 5 — Update `RouteNodeTimeline.tsx`

The timeline circles currently show port code only with no hover state for port name.

### Changes Required
1. The `RouteNode` type (in `shipments-route` action) — confirm whether `port_name` field exists. If not, add it as optional: `port_name?: string | null`.
2. On each circle node, add `title={node.port_name ?? undefined}` and `cursor-help` class if `port_name` is present.
3. The `ROLE_LABELS` mapping already maps to POL/T-S/POD. This is correct for staff view. If the timeline is ever shown to customers (AFU), revisit.
4. ETD/ETA display in the timeline is already correct — no change needed to the timing display logic.

---

## Files Expected to be Modified

| File | Change |
|---|---|
| `af-platform/src/components/shared/DateInput.tsx` | Fix two-digit hour/minute input; add 00:00 default on date entry |
| `af-platform/src/components/shipments/BLUpdateModal.tsx` | ETD → DateTimeInput |
| `af-platform/src/components/shipments/BLUploadTab.tsx` | ETD → DateTimeInput |
| `af-platform/src/components/shipments/RouteNodeTimeline.tsx` | ETD/ETA fields → DateTimeInput; add port name tooltip |
| `af-platform/src/components/shared/PortPair.tsx` | **CREATE** — new shared component |
| `af-platform/src/app/(platform)/shipments/[id]/page.tsx` | Update `RouteCard`, load ETD/ETA from route nodes |
| `af-server/routers/shipments.py` | BL-16/17 fix — confirm vessel_name in assembly response |

---

## Tests to Run After

From `AF-Test-List.md`:
- **DT-10** — DateTimeInput hour/minute fields accept two-digit input (11, 12, 24, 25)
- **DT-14** — ETD date entry auto-sets time to 00:00
- **DT-15** — ETA date entry auto-sets time to 00:00
- **DT-16** — Manually entered time overrides 00:00 default
- **DT-01 to DT-05** — BLUpdateModal / BLUploadTab ETD as DateTimeInput
- **DT-12, DT-13** — RouteNodeTimeline ETD/ETA as DateTimeInput, saves correctly
- **BL-16** — Vessel and voyage saved and displayed after BL update (test on AFCQ-003829)
- **BL-17** — Transport section visible on shipment detail Overview tab after BL update
- **New** — Route card shows POL/POD for AFC user, Origin/Destination for AFU user
- **New** — Port name tooltip appears on hover over port code (if port_name data available)
- **New** — ETD shown on origin side of route card, ETA on destination side
- **New** — ETD/ETA in route card matches values in timeline below

---

## Do Not Change

- `AFCQ-XXXXXX` key format or generation logic
- `booking` field on `ShipmentOrder` — V1 compat only, leave as `Record<string, unknown> | null`
- Existing timing edit functionality in `RouteNodeTimeline`
- The `DateInput` component
