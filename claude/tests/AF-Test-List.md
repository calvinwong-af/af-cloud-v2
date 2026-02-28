# AF Platform — Test List
**Version:** 1.9
**Last Updated:** 28 February 2026

## Version History
| Version | Date | Changes |
|---|---|---|
| 1.0 | 28 Feb 2026 | Initial test list — BL update mode, general shipment |
| 1.1 | 28 Feb 2026 | Added DT series (date inputs), TS series (task timestamps) |
| 1.2 | 28 Feb 2026 | Added TV series (task visibility); marked TS-02, DT-10, TV-01–04 confirmed |
| 1.3 | 28 Feb 2026 | Marked TS-01, TS-07 confirmed; DT series deferred |
| 1.4 | 28 Feb 2026 | TS-03–06 confirmed ✅; DT-10 re-opened ❌; ETD/ETA → DateTimeInput (DT-14–16 added) |
| 1.5 | 28 Feb 2026 | BL-16/17 fix deployed; PP series added (PortPair component) |
| 1.6 | 28 Feb 2026 | All Opus tasks confirmed deployed. All items marked ⏳ pending user testing. |
| 1.7 | 28 Feb 2026 | Testing session — VD/TL series confirmed; design changes applied live. TL series revised. VD-05 by design. DT-06/07 updated to DateTimeInput. |
| 1.8 | 28 Feb 2026 | TL-07/08 confirmed ✅. POD Mark Complete writes ATA. ATD hidden from POD. BL-11/13/14/15 confirmed. Parties card deferred on V1. |
| 1.9 | 28 Feb 2026 | BL-01/02/03/05/06/08/09/18–24 confirmed ✅. VD-01/02 confirmed. PP-02/04/07/10 confirmed. GS-02 confirmed. Port name tooltips live. |

## How to Use
- ✅ = Confirmed working
- ❌ = Confirmed broken
- ⏳ = Not yet tested / pending user test
- 🔄 = In progress / partially tested
- N/A = Removed by design decision

---

## BL Update Mode
| # | Test | Status | Notes |
|---|---|---|---|
| BL-01 | BL update visible on SEA_FCL shipment >= status 2001 (AFU) | ✅ | AF-003867 confirmed |
| BL-02 | BL update visible on SEA_LCL shipment >= status 2001 (AFU) | ✅ | AFCQ-003830 confirmed |
| BL-03 | BL update NOT visible on AIR shipment | ✅ | AFCQ-003861 confirmed |
| BL-04 | BL update NOT visible for AFC users | ⏳ | |
| BL-05 | BL parses successfully — fields pre-fill form | ✅ | AFCQ-003829 tested |
| BL-06 | Update Shipment succeeds on V2 (AF-) shipment | ✅ | AF-003867 confirmed |
| BL-07 | Update Shipment succeeds on V1 (AFCQ-) shipment | ✅ | AFCQ-003829 confirmed |
| BL-08 | BL PDF auto-saved to Files tab with tag bl after update | ✅ | |
| BL-09 | Carrier / Agent label shown (not Carrier) | ✅ | |
| BL-10 | LCL: Cargo Summary table shown, Containers table hidden | ✅ | AFCQ-003794 tested |
| BL-11 | FCL: Containers table shown | ✅ | AFCQ-003832 confirmed |
| BL-12 | Cargo items table is inline-editable (qty, weight, CBM, description) | ✅ | |
| BL-13 | Containers table is inline-editable (container no., type, seal) | ✅ | AFCQ-003832 confirmed |
| BL-14 | Add row to cargo items table | ✅ | AFCQ-003832 confirmed |
| BL-15 | Delete row from cargo items table | ✅ | AFCQ-003832 confirmed |
| BL-16 | Vessel and voyage saved and displayed after BL update | ✅ | Fixed in v1-assembly.ts |
| BL-17 | Transport section visible on shipment detail after BL update | ✅ | AFCQ-003829 confirmed |
| BL-18 | Shipper name + address pre-filled from BL parse | ✅ | AF-003867 confirmed |
| BL-19 | Consignee name + address pre-filled from BL parse | ✅ | AF-003867 confirmed |
| BL-20 | Parties card visible on Overview tab after BL update (V2) | ✅ | AF-003867 confirmed — V1 deferred |
| BL-21 | Diff icon shown when bl_document consignee ≠ shipment_order consignee | ✅ | AF-003867 — KG vs KGS |
| BL-22 | Diff tooltip shows truncated BL value on hover | ✅ | AF-003867 confirmed |
| BL-23 | BLPartyDiffModal opens on diff icon click — side-by-side view | ✅ | AF-003867 confirmed |
| BL-24 | "Use BL Values" in diff modal updates shipment order, diff icon disappears | ✅ | AF-003867 confirmed |

---

## Date / DateTime Inputs (DateInput + DateTimeInput components)
| # | Test | Status | Notes |
|---|---|---|---|
| DT-01 | BLUpdateModal ETD — displays as DD/MM/YYYY HH:mm after parse | ⏳ | |
| DT-02 | BLUpdateModal ETD — type 28022026 auto-formats to 28/02/2026, time defaults to 00:00 | ⏳ | |
| DT-03 | BLUpdateModal ETD — type invalid date 31/02/2026 clears on blur | ⏳ | |
| DT-04 | BLUpdateModal ETD — pre-filled from parsed BL shows correct date and time | ⏳ | |
| DT-05 | BLUploadTab ETD — same formatting behaviour as BLUpdateModal | ⏳ | |
| DT-06 | ShipmentTasks scheduled start — displays as DD/MM/YYYY HH:mm | ⏳ | Updated to DateTimeInput this session |
| DT-07 | ShipmentTasks scheduled end — displays as DD/MM/YYYY HH:mm | ⏳ | Updated to DateTimeInput this session |
| DT-08 | ShipmentTasks actual start — displays as DD/MM/YYYY HH:mm | ⏳ | |
| DT-09 | ShipmentTasks actual end — displays as DD/MM/YYYY HH:mm | ⏳ | |
| DT-10 | DateTimeInput — hour/minute fields accept two-digit input (11, 12, 24, 25) | ✅ | |
| DT-11 | ShipmentTasks actual start — saved value persists time after reload | ⏳ | |
| DT-12 | RouteNodeTimeline — ETD/ETA inputs display as DD/MM/YYYY HH:mm | ⏳ | |
| DT-13 | RouteNodeTimeline — save timing persists correctly | ⏳ | |
| DT-14 | ETD date entry auto-sets time to 00:00 when time not manually entered | ⏳ | |
| DT-15 | ETA date entry auto-sets time to 00:00 when time not manually entered | ⏳ | |
| DT-16 | Manually entered time overrides the 00:00 default | ⏳ | |

---

## Port Pair Display (PortPair component)
| # | Test | Status | Notes |
|---|---|---|---|
| PP-01 | Route card — AFC user sees POL / POD labels | ⏳ | |
| PP-02 | Route card — AFU user sees Origin / Destination labels | ✅ | AF-003867 confirmed |
| PP-03 | Route card — port code displays in large monospace font | ✅ | |
| PP-04 | Route card — port name appears as tooltip on hover | ✅ | V1 + V2 confirmed |
| PP-05 | Route card — ETD shown below origin port code | ✅ | |
| PP-06 | Route card — ETA shown below destination port code | ⏳ | Deferred — ETA not synced from task scheduled_start |
| PP-07 | Route card — ETD/ETA matches Route Node Timeline | ✅ | |
| PP-08 | Route card — Incoterm pill displayed | ✅ | |
| PP-09 | Route card — no ETD/ETA shows muted dash placeholder | ✅ | |
| PP-10 | RouteNodeTimeline — port name tooltip on hover over circle node | ✅ | |

---

## Task Timing Labels (TRACKED tasks — standardised across all port tasks)
| # | Test | Status | Notes |
|---|---|---|---|
| TL-01 | TRACKED POL — scheduled_start label shows ETA | ✅ | |
| TL-02 | TRACKED POL — scheduled_end label shows ETD | ✅ | |
| TL-03 | TRACKED POL — actual_start label shows ATA | ✅ | |
| TL-04 | TRACKED POL — actual_end label shows ATD | ✅ | |
| TL-05 | TRACKED POD — scheduled_start label shows ETA | ✅ | |
| TL-06 | TRACKED POD — ETD column hidden from display | ✅ | Design decision |
| TL-07 | TRACKED POD — Mark Complete writes ATA (actual_start) | ✅ | Confirmed 28 Feb 2026, 19:37 |
| TL-08 | TRACKED POD — ATD absent from completed card | ✅ | |
| TL-09 | Non-TRACKED task — generic labels unchanged | ⏳ | Tested on IGNORED (no timing shown) — ASSIGNED task pending |

---

## Vessel Display
| # | Test | Status | Notes |
|---|---|---|---|
| VD-01 | Route card — vessel + voyage shown between port pair and incoterm | ✅ | Now inside PortPair component |
| VD-02 | Route card — vessel row absent when no BL update done | ✅ | AFCQ-003837 confirmed |
| VD-03 | Route card — vessel name only shown when voyage missing | ⏳ | |
| VD-04 | TRACKED POL task card — vessel name + voyage shown | ✅ | |
| VD-05 | TRACKED POD task card — no vessel info shown | ✅ | Design decision — POL only |
| VD-06 | Non-TRACKED task card — no vessel info shown | ⏳ | |
| VD-07 | Non-POL TRACKED task card — no vessel info shown | ⏳ | |

---

## Task Timestamps
| # | Test | Status | Notes |
|---|---|---|---|
| TS-01 | Task card shows date + time e.g. 28 Feb 2026, 14:30 | ✅ | |
| TS-02 | COMPLETED task — edit button is visible | ✅ | |
| TS-03 | COMPLETED task — can edit actual_start and save | ✅ | |
| TS-04 | COMPLETED task — can edit actual_end and save | ✅ | |
| TS-05 | COMPLETED task — can edit completed_at and save | ✅ | |
| TS-06 | Edited timestamp on completed task persists after page reload | ✅ | |
| TS-07 | Completed after scheduled end warning still shows when applicable | ✅ | |

---

## Task Visibility (Customer View)
| # | Test | Status | Notes |
|---|---|---|---|
| TV-01 | Hidden task — card stays full opacity | ✅ | |
| TV-02 | Hidden task — task label normal (no strikethrough) | ✅ | |
| TV-03 | Hidden task — EyeOff icon shows amber highlight | ✅ | |
| TV-04 | Visible task — Eye icon shows default muted style | ✅ | |

---

## General Shipment
| # | Test | Status | Notes |
|---|---|---|---|
| GS-01 | V1 shipment (AFCQ-) loads without error | ✅ | |
| GS-02 | V2 shipment (AF-) loads without error | ✅ | AF-003867 confirmed |
| GS-03 | Shipment list table scrolls horizontally without clipping | ✅ | |
| GS-04 | User table scrolls horizontally without clipping | ✅ | |
| GS-05 | Stale task display_name resolved | ✅ | |
| GS-06 | Edit button visible on IGNORED tasks | ✅ | |
| GS-07 | Task timestamps status guard working | ✅ | |

---

## Deferred Items
| Item | Reason |
|---|---|
| PP-06 — ETA sync from task scheduled_start to route node | Requires server-side co-write on task update. Deferred until V2 focus. |
| Parties card on V1 shipments | v1-assembly.ts not mapping new shipper/consignee fields. V1 cleanup pass. |
| DT series (most) | Testing as encountered during normal use |
| MYPKG_N port code suffix | V1 records store port codes with _N suffix — data issue, deferred cleanup |
| AWB upload for AIR shipments | Same architecture as BL. Deferred to AIR build-out. |
