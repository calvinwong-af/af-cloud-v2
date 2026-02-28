# Handover Notes — v2.24
**Date:** 28 February 2026
**Session type:** Testing + Live Fixes + Prompt Execution

---

## Session Summary

Continuation of testing session from v2.23. Seven VS Code prompt batches executed covering vessel display fix, parties edit, BL button threshold, Ctrl+click, notify party, dynamic tab title, port name tooltip, and port name server-side lookup. Extensive BL and route card testing completed on AF-003867. gcloud auth issue resolved at session start.

---

## Issues Resolved This Session

### Auth — gcloud invalid_rapt error
`invalid_grant` / `invalid_rapt` error on Datastore calls. Resolved by running:
```
gcloud auth login
gcloud auth application-default login
```
Standard credential expiry — not a code issue.

---

## Prompts Executed This Session

### Prompt Batch 1 — Vessel Fix (VD-02) + Parties Edit
**Status:** Completed ✅
- VD-02: Fixed vessel extraction for V2 shipments — replaced fragile inline `||` expressions with clean `??`-based helper variables
- Parties Edit: EditPartiesModal added to Overview tab (AFU only, not on Completed/Cancelled), Pencil icon in PartiesCard header, `updatePartiesAction` server action, `PATCH /api/v2/shipments/{id}/parties` endpoint

### Prompt Batch 2 — BL Button Threshold + Ctrl+Click + Notify Party
**Status:** Completed ✅
- BL button threshold: `>= 3001` → `>= 2001` — fixes Path B incoterms (CNF IMPORT) at Confirmed status
- Ctrl+Click / Cmd+Click on shipment table row opens new tab
- Notify Party added to Edit Parties modal — name + address editable, server endpoint extended

### Prompt 3 — Dynamic Browser Tab Title
**Status:** Completed ✅
- `document.title` set to `{shipmentId} | AcceleFreight` when order loads
- Resets to `AcceleFreight` on unmount

### Prompt 4 — Port Name Tooltip Fix (PortPair)
**Status:** Completed ✅
- Tooltip and `cursor-help` suppressed when `port_name === port_un_code`
- Prevents misleading tooltip that just repeats the code already visible

### Prompt 5 — Port Name Server-Side Lookup (V1 Detail)
**Status:** Completed ✅
- `_get_port_label()` helper added to `shipments.py` — looks up Port Kind by `un_code`, returns `"Name, Country"` format
- V1 detail endpoint now enriches origin/destination with real port names
- `shipments.ts` also updated with batch Port Kind lookup, `portLabelMap` passed to `assembleV1ShipmentOrder`

---

## Design Decisions Confirmed This Session

### BL Upload — available from Confirmed (2001) onwards
Path B incoterms (e.g. CNF IMPORT) skip booking nodes and go directly Confirmed → Departed. BL upload must be available at Confirmed status, not just at Booking Confirmed (3001).

### AWB for Air Freight — future work
Air Waybill upload to follow same architecture as BL upload (parse → pre-fill → update). Deferred to AIR shipment build-out. Label changes: AWB number instead of BL/waybill, no containers, chargeable weight instead of container table.

### MYPKG_N — V1 port code suffix
V1 records store port codes with `_N` suffix (e.g. `MYPKG_N`). Logged as a deferred cleanup item — not a new bug, V1 data issue.

### Legacy AIR shipment status path
AFCQ-003861 shows Booking Pending with mismatched advance button label. Confirmed as expected behaviour for legacy V1 AIR shipments — not a bug.

### Notify Party — no diff indicator needed
`bl_document` does not store `notify_party`. Notify Party editable directly in Edit Parties modal; no diff indicator required.

---

## Test Results This Session

### Newly Confirmed ✅
| # | Test |
|---|---|
| BL-01 | Upload BL button visible — SEA_FCL >= Confirmed (AFU) |
| BL-02 | Upload BL button visible — SEA_LCL |
| BL-03 | Upload BL button NOT visible — AIR |
| BL-05 | BL fields pre-fill after parse |
| BL-06 | Update Shipment succeeds on V2 (AF-) |
| BL-08 | BL PDF saved to Files tab with tag `bl` |
| BL-09 | Carrier / Agent label shown |
| BL-18 | Shipper name + address pre-filled from BL parse |
| BL-19 | Consignee name + address pre-filled from BL parse |
| BL-20 | Parties card visible on Overview tab (V2) |
| BL-21 | Diff icon shown when bl_document ≠ shipment_order parties |
| BL-22 | Diff tooltip on hover shows BL value |
| BL-23 | BLPartyDiffModal opens with side-by-side view |
| BL-24 | "Use BL Values" updates shipment, diff icon disappears |
| VD-01 | Vessel + voyage on route card (ONE TRADITION · 028E) |
| VD-02 | Vessel row absent when no BL uploaded |
| PP-02 | AFU user sees Origin / Destination labels |
| PP-04 | Port name tooltip on hover (real name, not code) |
| PP-07 | ETD/ETA matches Route Node Timeline |
| PP-10 | Port name tooltip on Route Node Timeline |
| GS-02 | V2 shipment (AF-) loads without error |

### All Confirmed ✅ To Date
TS-01–07, TV-01–04,
BL-01–03, BL-05–15, BL-16–24,
TL-01–08,
VD-01, VD-02, VD-04, VD-05,
PP-02–05, PP-07–10,
GS-01–07, DT-10

### Still Pending ⏳
| # | Reason |
|---|---|
| BL-04 | Needs AFC login |
| PP-01 | Needs AFC login |
| PP-06 | Deferred — ETA sync from task to route node requires server co-write |
| TL-09 | Needs ASSIGNED task |
| VD-03/06/07 | Edge cases — test as encountered |
| DT-01–09, DT-11–16 | Testing as encountered in normal use |

---

## Known Issues / Deferred

| Issue | Notes |
|---|---|
| MYPKG_N port code suffix on V1 records | V1 data issue — `_N` suffix leaking from raw port code. Deferred cleanup. |
| Parties card blank on V1 shipments | `v1-assembly.ts` not mapping new shipper/consignee fields. V1 cleanup pass. |
| PP-06 — ETA not updating on route card | Task update does not co-write to route node. Deferred to V2 focus. |
| AWB upload for AIR shipments | Same architecture as BL upload. Deferred to AIR build-out. |
| TL-09 — ASSIGNED task timing labels | Pending a shipment with ASSIGNED tasks to test against. |

---

## Files Modified This Session

| File | Change |
|---|---|
| `af-platform/src/app/(platform)/shipments/[id]/page.tsx` | Vessel helper variables; EditPartiesModal (Shipper/Consignee/NotifyParty); PartiesCard pencil button; BL button threshold `>= 2001`; `document.title` useEffect |
| `af-platform/src/components/shipments/ShipmentOrderTable.tsx` | `href` prop replaces `onRowClick`; Ctrl/Cmd+click → new tab; removed `useRouter` from parent |
| `af-platform/src/components/shared/PortPair.tsx` | Tooltip + cursor-help suppressed when port_name equals port_un_code |
| `af-platform/src/app/actions/shipments-write.ts` | `updatePartiesAction` with shipper/consignee/notify_party fields |
| `af-server/routers/shipments.py` | `PATCH /{id}/parties` endpoint; `_get_port_label()` helper; V1 detail port name enrichment; `UpdatePartiesRequest` with notify_party fields |
| `af-platform/src/lib/shipments.ts` | Batch Port Kind lookup; `portLabelMap` passed to `assembleV1ShipmentOrder` |
| `af-cloud-v2/claude/tests/AF-Test-List.md` | Updated — multiple items confirmed, new items added |
| `af-cloud-v2/claude/prompts/PROMPT-CURRENT.md` | Cleared — no active prompt |

---

## Next Session — Recommended Starting Point

1. Read `PROMPT-LOG.md` to confirm all prompt batches from this session are logged
2. Test Edit Parties modal — Notify Party fields editable and saving correctly
3. Test port name tooltips on additional V1 shipments to confirm lookup working broadly
4. Continue with BL-04 and PP-01 when AFC login is available
5. Begin planning next feature area — candidates: AIR/AWB build-out, V1 cleanup pass (MYPKG_N, Parties card on V1), or new shipment creation flow
