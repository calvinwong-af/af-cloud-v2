# Handover Notes — v2.23
**Date:** 28 February 2026
**Session type:** Testing + Live Fixes + Prompt Execution + Design Decisions

---

## Session Summary

Continuation of testing session from v2.22. Three VS Code prompts executed (task labels + vessel display, TRACKED POD completion behaviour, shipper/consignee + parties card + diff UI). Multiple live fixes applied directly by Claude AI during the session. Significant test progress across TL, VD, BL series.

---

## Prompts Executed This Session

### Prompt 1 — Task Card Labels + Vessel Display
**Status:** Completed ✅
- POL/POD TRACKED task timing labels deployed (ETD/ATD, ETA/ATA)
- Vessel + voyage row in RouteCard below port pair
- Vessel + voyage on TRACKED POL/POD task cards

### Prompt 2 — TRACKED POD Task Completion Behaviour
**Status:** Completed ✅
- Mark Complete on TRACKED POD writes `actual_start` (ATA), not `actual_end` (ATD)
- ATD hidden from TRACKED POD card display
- ATD and ETD hidden from TRACKED POD edit modal
- Server-side: TRACKED POD completion sets `actual_start` instead of `actual_end`

### Prompt 3 — Shipper/Consignee + Parties Card + Diff UI
**Status:** Completed ✅ (V2 only — V1 display deferred, see known issues)
- BLUpdateModal: Consignee section added (name + address), pre-filled from parse
- Dual storage: `bl_document` = raw parsed, `shipment_order` = operational (conditional write)
- Parties card on Overview tab with diff indicator (AlertTriangle icon)
- Tooltip on hover: "BL shows: [truncated]"
- BLPartyDiffModal: side-by-side diff with "Use BL Values" / "Keep Current"

---

## Live Fixes Applied This Session (Claude AI direct edits)

### Fix 1 — Vessel row position in RouteCard
Moved vessel row inside `PortPair` component (between port pair and incoterm), removing standalone div from `page.tsx`. Vessel now renders in correct position: ports → ETD/ETA → vessel → incoterm.

**Files:** `PortPair.tsx` (added vesselName/voyageNumber props + vessel row), `page.tsx` (pass props, removed standalone vessel div + Ship import + showVessel var)

### Fix 2 — POD task timing labels standardised
`getTimingLabels()` simplified to single TRACKED branch — ETA/ETD/ATA/ATD unified across POL, POD, and future transhipment ports. No separate POL/POD branches needed.

**File:** `ShipmentTasks.tsx`

### Fix 3 — POD display: ETD hidden, ATA/ATD layout restructured
- ETD column hidden from TRACKED POD card (data stored, not shown)
- ATD hidden from TRACKED POD completed card
- Timing layout changed from single grid row to two separate rows: Estimated (ETA/ETD) and Actual (ATA/ATD)
- Scheduled fields changed to `DateTimeInput` in edit modal (was `DateInput`)

**File:** `ShipmentTasks.tsx`

### Fix 4 — Sticky modal footer (BLUpdateModal + EditTaskModal)
Both modals restructured: fixed header + scrollable content area + locked footer. Cancel/submit buttons no longer scroll away.

**Files:** `BLUpdateModal.tsx`, `ShipmentTasks.tsx`

---

## Design Decisions Confirmed This Session

### Task timing — standardised across all TRACKED port tasks
ETA / ETD / ATA / ATD applies uniformly to POL, POD, and future transhipment ports. This is intentional for consistency and scalability.

| Field | All TRACKED port tasks |
|---|---|
| `scheduled_start` | ETA |
| `scheduled_end` | ETD |
| `actual_start` | ATA |
| `actual_end` | ATD |

### POD display rules
- **ETD:** stored but hidden from card and edit modal
- **ATD:** stored but hidden from card and edit modal
- **Mark Complete → writes ATA** (`actual_start`), not ATD
- Rationale: vessel arrives at discharge port — departure is not a meaningful tracking event

### Vessel display
- Route card: vessel between port pair and incoterm (inside PortPair component)
- Task cards: POL only — POD does not show vessel info

### Shipper/Consignee storage pattern
- `bl_document.shipper/consignee` = raw parsed values from BL (never overwritten)
- `shipment_order.shipper/consignee` = operational values (only written if empty; force_update flag for overwrite)
- Diff indicator shown when the two diverge
- Pattern generalises to vessel/ETD diffs in future

### Route card — keeping for now
Route card retained on shipment detail. User has plans to extend it. ETA sync from task `scheduled_start` to route node deferred.

---

## Known Issues / Deferred

| Issue | Notes |
|---|---|
| PP-06 — ETA not updating on route card | Route card reads from `route_nodes`, task update writes to `ShipmentWorkflow`. Not linked. Deferred to V2 focus. |
| Parties card blank on V1 shipments | `v1-assembly.ts` not mapping new `shipper`/`consignee` fields from Firestore to response. V1 issue — deferred. |
| TL-09 — non-TRACKED generic labels | Tested on IGNORED task (no timing shown) — effectively confirmed. Formal test on ASSIGNED task still pending. |

---

## Test Status at End of Session

### Confirmed ✅ This Session (new)
TL-01, TL-02, TL-03, TL-04, TL-05, TL-06, TL-07, TL-08,
VD-01, VD-04, VD-05,
BL-11, BL-13, BL-14, BL-15,
PP-03, PP-05, PP-08, PP-09,
DT-10

### All Confirmed ✅ To Date
TS-01–07, TV-01–04,
BL-05, BL-07–10, BL-12, BL-16, BL-17,
BL-11, BL-13, BL-14, BL-15,
TL-01–08,
VD-01, VD-04, VD-05,
PP-03, PP-05, PP-08, PP-09,
GS-01, GS-03–07, DT-10

### Still Pending ⏳
- **BL:** BL-01–04, BL-06 (V2 BL update)
- **VD:** VD-02, VD-03, VD-06, VD-07
- **PP:** PP-01, PP-02, PP-04, PP-06 (deferred), PP-07, PP-10
- **TL:** TL-09
- **DT:** DT-01–09, DT-11–16
- **GS:** GS-02 (V2 shipment loads)

---

## Files Modified This Session

| File | Change |
|---|---|
| `af-platform/src/components/shared/PortPair.tsx` | Added vesselName/voyageNumber props; vessel row between port pair and incoterm |
| `af-platform/src/app/(platform)/shipments/[id]/page.tsx` | Pass vessel props to PortPair; remove standalone vessel div, Ship import, showVessel var; Parties card with diff indicators; BLPartyDiffModal rendering |
| `af-platform/src/components/shipments/ShipmentTasks.tsx` | getTimingLabels() unified; ETD/ATD hidden on POD card; two-row timing layout; DateTimeInput for scheduled fields; sticky modal footer; POD Mark Complete writes actual_start |
| `af-platform/src/components/shipments/BLUpdateModal.tsx` | Consignee fields; bl_ raw value passthrough; sticky modal footer |
| `af-platform/src/components/shipments/BLPartyDiffModal.tsx` | New file — side-by-side diff modal |
| `af-platform/src/lib/types.ts` | bl_document field on ShipmentOrder |
| `af-platform/src/lib/shipments.ts` | bl_document in V2 reader |
| `af-platform/src/lib/v1-assembly.ts` | bl_document passthrough |
| `af-platform/src/app/actions/shipments-write.ts` | BL update payload extended with shipper/consignee/bl_ variants |
| `af-platform/src/app/actions/shipments.ts` | bl_document included in fetch response |
| `af-server/routers/shipments.py` | TRACKED POD completion writes actual_start; bl_document storage; conditional parties write; force_update flag |
| `af-cloud-v2/claude/tests/AF-Test-List.md` | Updated to v1.8 |
| `af-cloud-v2/claude/prompts/PROMPT-CURRENT.md` | Cleared — no active prompt |

---

## Next Session — Recommended Starting Point

1. Read `PROMPT-LOG.md` to confirm all three prompts executed cleanly
2. Test Parties card on a V2 shipment (BL upload → check Overview tab)
3. Test BLPartyDiffModal (manually edit consignee name after BL upload → check diff icon + modal)
4. Continue pending tests: VD-02/03, PP-01/02, GS-02, DT series
5. V1 Parties card fix when ready to start V1 cleanup pass
