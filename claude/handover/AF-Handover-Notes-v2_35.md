# Handover Notes — v2.35
**Date:** 02 March 2026
**Session type:** BL Container Display Fix + MC-06 Verification

---

## Session Summary

Two focused bug fixes completed and verified via live screenshots. The BL update flow now correctly merges parsed container/seal data into existing type_details rather than replacing it. The TypeDetailsCard component was updated to render both creation-schema and BL-enriched container objects. All MC series and BL-28/29/30 tests confirmed YES.

---

## Problems Fixed This Session

### 1. MC-06 — TypeDetailsCard "Details not available" on manual SEA_FCL shipments
**Symptom:** AF-003872 (manually created SEA_FCL, 1 × 20GP DRY) showed "Details not available for this order type" instead of the Containers card.

**Root cause:** `TypeDetailsCard` used `td.type` to determine which branch to render. The `type` field was never written to `type_details` JSONB on manual creation — so `td.type` was always `undefined` and fell through to the fallback.

**Fix — Frontend (`af-platform/src/app/(platform)/shipments/[id]/page.tsx`):**
- Changed `TypeDetailsCard` signature to accept `orderType: string` prop
- Replaced all `td.type === 'SEA_FCL'` checks with `orderType === 'SEA_FCL'`
- Updated call site: `<TypeDetailsCard order={order} orderType={order.order_type} />`

**Fix — Backend (`af-server/routers/shipments.py`):**
- Added `"type": order_type` to the `type_details` JSONB written in `create_shipment_manual`

**Verified:** AF-003872 shows "CONTAINERS — 20GP DRY × 1" correctly.

---

### 2. BL-28 — Container/seal numbers not displayed after BL update
**Symptom:** After BL update on AF-003837, Containers card showed only "— 40HQ ×" — blank size badge, no quantity, no container/seal numbers.

**Root cause:** Two incompatible schemas existed for `type_details.containers`:
- **Creation schema:** `{ container_size, container_type, quantity, container_numbers[], seal_numbers[] }`
- **BL-parsed schema:** `{ container_number, container_type, seal_number }` (singular, flat)

The `PATCH /bl` endpoint was **replacing** `type_details.containers` entirely with the BL-parsed objects, discarding `container_size` and `quantity`. `TypeDetailsCard` read `c.container_size` (now absent) → blank badge, and `c.quantity` (absent) → blank count.

**Fix — Backend (`af-server/routers/shipments.py`):**
Changed `update_from_bl()` containers block from a replace to a **merge**:
- Iterate BL-parsed containers by index
- Find matching existing row (by position), copy it
- Apply BL fields (`container_number`, `seal_number`, `container_type`) onto existing row
- Preserve `container_size`, `quantity` from creation schema
- Append extra BL rows beyond existing count as new entries

**Fix — Frontend (`af-platform/src/app/(platform)/shipments/[id]/page.tsx`):**
Updated `TypeDetailsCard` SEA_FCL branch container row:
- Renders `container_size` badge only when present (conditional)
- Renders `quantity` only when present (conditional)
- Added sub-rows for `container_number` (BL field) and `seal_number` (BL field) when present
- Also renders legacy `container_numbers[]` and `seal_numbers[]` arrays for backward compat
- Hint text "Container and seal numbers assigned at booking" is now conditional — hidden once any `container_number` is present

**Fix — Types (`af-platform/src/lib/types.ts`):**
Extended `ContainerDetail` with two optional BL-enriched fields:
```typescript
container_number?: string | null;
seal_number?: string | null;
```

**Verified:** AF-003837 Containers card shows `40HQ`, `Container No. SEGU6868838`, `Seal No. YMAV438141` after BL update.

---

## Files Modified This Session

| File | Change |
|---|---|
| `af-platform/src/app/(platform)/shipments/[id]/page.tsx` | TypeDetailsCard: orderType prop, merged container rendering, conditional hint |
| `af-platform/src/lib/types.ts` | ContainerDetail: added container_number + seal_number optional fields |
| `af-server/routers/shipments.py` | create_shipment_manual: write type field to type_details. update_from_bl: merge containers instead of replace |
| `claude/tests/AF-Test-List.md` | Updated to v2.40 |
| `claude/prompts/PROMPT-CURRENT.md` | BL-28 prompt written |

---

## Tests Confirmed This Session

| Test | Result | Evidence |
|---|---|---|
| MC-06 | YES | AF-003872 — 20GP DRY × 1 displayed correctly |
| BL-28 | YES | AF-003837 — container number SEGU6868838 shown |
| BL-29 | YES | AF-003837 — seal number YMAV438141 shown |
| BL-30 | YES | AF-003837 — hint text absent after BL update |

Test list now at **v2.40**.

---

## Current System State

### Dashboard Stats (Last Confirmed — 02 Mar 2026)
| Stat | Value |
|---|---|
| Total | 2,044 |
| Active | 24 (includes AF-003872) |
| Completed | 2,019 |
| To Invoice | 8 |

### Active V2 Native Records
| ID | Status | Notes |
|---|---|---|
| AF-003872 | Confirmed | Manually created EXW IMPORT SEA FCL. 20GP DRY × 1. No BL yet. |
| AF-003837 | Booking Confirmed | V1 Legacy. BL uploaded. CNSHK → MYPKG. YM INAUGURATION 328S. |

---

## Pending Tests (Action Required)

| Series | Test | Notes |
|---|---|---|
| DS-03 | datastore-query.ts still imported by users module | LOW — users not yet on PostgreSQL |
| BUG2-02 | Exception flag on mobile card | Test during mobile UX pass |
| VD-03 | Vessel name only when voyage missing | Test as encountered |
| VD-06/07 | Non-TRACKED / non-POL vessel info | Test as encountered |
| PP-06 | ETA below destination port | Deferred — ETA sync not yet built |
| UI-01 | Files tab count badge | LOW priority |

DT, PT, MB series all deferred to their respective dedicated passes.

---

## Known Minor Issues (Not Blocking)

1. **Create modal says "Draft"** — review step says shipment will be created as "Draft" but actual initial status is `1002` (Pending Review / Confirmed). Cosmetic mismatch in `CreateShipmentModal.tsx` step 5 label. Low priority.

2. **AF-003837 container_size absent** — this is a V1 migrated record that never had `container_size` set in `type_details`. The BL-28 fix handles this gracefully (size badge hidden when null). Not a regression.

---

## Next Session — Recommended Starting Point

1. Confirm no further issues on BL update flow (run on a second FCL shipment if available)
2. Address next feature priority — options:
   - **Port Terminal Layer** (PT series) — replace MYPKG_N suffix approach
   - **Files tab count badge** (UI-01) — quick win
   - **Mobile UX pass** (MB series) — foundational before customer demo
   - **Incoterm task engine** — auto-generate task checklists
3. Read this handover + AF-Test-List.md v2.40 + PROMPT-LOG at session start
