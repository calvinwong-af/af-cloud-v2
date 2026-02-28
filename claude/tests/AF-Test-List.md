# AF Platform — Test List
**Version:** 1.6
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
| 1.6 | 28 Feb 2026 | All Opus tasks confirmed deployed — DT-10 fix, 00:00 default, ETD/ETA → DateTimeInput, BL-16/17 server fix (V1 SO write + merge), PortPair/RouteCard/Timeline already in place. All items marked ⏳ pending user testing. |

## How to Use
- ✅ = Confirmed working
- ❌ = Confirmed broken
- ⏳ = Not yet tested / pending user test
- 🔄 = In progress / partially tested

---

## BL Update Mode
| # | Test | Status | Notes |
|---|---|---|---|
| BL-01 | BL update visible on SEA_FCL shipment >= status 3001 (AFU) | ⏳ | |
| BL-02 | BL update visible on SEA_LCL shipment >= status 3001 (AFU) | ⏳ | |
| BL-03 | BL update NOT visible on AIR shipment | ⏳ | |
| BL-04 | BL update NOT visible for AFC users | ⏳ | |
| BL-05 | BL parses successfully — fields pre-fill form | ✅ | AFCQ-003829 tested |
| BL-06 | Update Shipment succeeds on V2 (AF-) shipment | ⏳ | |
| BL-07 | Update Shipment succeeds on V1 (AFCQ-) shipment | ✅ | AFCQ-003829 confirmed working |
| BL-08 | BL PDF auto-saved to Files tab with tag bl after update | ✅ | Confirmed working |
| BL-09 | Carrier / Agent label shown (not Carrier) | ✅ | |
| BL-10 | LCL: Cargo Summary table shown, Containers table hidden | ✅ | AFCQ-003794 tested |
| BL-11 | FCL: Containers table shown | ⏳ | |
| BL-12 | Cargo items table is inline-editable (qty, weight, CBM, description) | ✅ | Confirmed working |
| BL-13 | Containers table is inline-editable (container no., type, seal) | ⏳ | |
| BL-14 | Add row to cargo items table | ⏳ | |
| BL-15 | Delete row from cargo items table | ⏳ | |
| BL-16 | Vessel and voyage saved and displayed after BL update | ✅ | Root cause: so.booking had null fields (not null object), so ?? fallback to q.booking never triggered. Fixed in v1-assembly.ts with explicit falsy check |
| BL-17 | Transport section visible on shipment detail after BL update | ✅ | Confirmed AFCQ-003829 — Vessel, Voyage, Booking Ref, Carrier/Agent all showing |

---

## Date / DateTime Inputs (DateInput + DateTimeInput components)
| # | Test | Status | Notes |
|---|---|---|---|
| DT-01 | BLUpdateModal ETD — displays as DD/MM/YYYY HH:mm after parse | ⏳ | ETD now DateTimeInput |
| DT-02 | BLUpdateModal ETD — type 28022026 auto-formats to 28/02/2026, time defaults to 00:00 | ⏳ | 00:00 default deployed |
| DT-03 | BLUpdateModal ETD — type invalid date 31/02/2026 clears on blur | ⏳ | |
| DT-04 | BLUpdateModal ETD — pre-filled from parsed BL shows correct date and time | ⏳ | |
| DT-05 | BLUploadTab ETD — same formatting behaviour as BLUpdateModal | ⏳ | ETD now DateTimeInput |
| DT-06 | ShipmentTasks scheduled start — displays as DD/MM/YYYY | ⏳ | |
| DT-07 | ShipmentTasks scheduled end — displays as DD/MM/YYYY | ⏳ | |
| DT-08 | ShipmentTasks actual start — displays as DD/MM/YYYY HH:mm | ⏳ | |
| DT-09 | ShipmentTasks actual end — displays as DD/MM/YYYY HH:mm | ⏳ | |
| DT-10 | DateTimeInput — hour/minute fields accept two-digit input (11, 12, 24, 25) | ⏳ | Fix deployed — TimeField rewrote to draft/local state; was ❌ |
| DT-11 | ShipmentTasks actual start — saved value persists time after reload | ⏳ | |
| DT-12 | RouteNodeTimeline — ETD/ETA inputs display as DD/MM/YYYY HH:mm | ⏳ | All 4 timing fields now DateTimeInput |
| DT-13 | RouteNodeTimeline — save timing persists correctly | ⏳ | |
| DT-14 | ETD date entry auto-sets time to 00:00 when time not manually entered | ⏳ | Deployed |
| DT-15 | ETA date entry auto-sets time to 00:00 when time not manually entered | ⏳ | Deployed |
| DT-16 | Manually entered time overrides the 00:00 default | ⏳ | Deployed |

---

## Port Pair Display (PortPair component)
| # | Test | Status | Notes |
|---|---|---|---|
| PP-01 | Route card — AFC user sees POL / POD labels | ⏳ | |
| PP-02 | Route card — AFU user sees Origin / Destination labels | ⏳ | |
| PP-03 | Route card — port code displays in large monospace font | ⏳ | |
| PP-04 | Route card — port name appears as tooltip on hover (not persistent text) | ⏳ | Enrichment from Port Kind via route nodes — tooltip only populated if port_name resolved |
| PP-05 | Route card — ETD shown below origin port code | ⏳ | Loaded from ORIGIN route node scheduled_etd |
| PP-06 | Route card — ETA shown below destination port code | ⏳ | Loaded from DESTINATION route node scheduled_eta |
| PP-07 | Route card — ETD/ETA matches values in Route Node Timeline below | ⏳ | |
| PP-08 | Route card — Incoterm pill displayed | ⏳ | |
| PP-09 | Route card — no ETD/ETA shows muted dash placeholder | ⏳ | |
| PP-10 | RouteNodeTimeline — port name tooltip appears on hover over circle node | ⏳ | Uses _enrich_route_nodes() from Port Kind |

---

## Task Timing Labels (TRACKED POL/POD)
| # | Test | Status | Notes |
|---|---|---|---|
| TL-01 | TRACKED POL task — scheduled_end label shows ETD (not Sched. End) | ⏳ | |
| TL-02 | TRACKED POL task — actual_start label shows ATD (not Started) | ⏳ | |
| TL-03 | TRACKED POL task — actual_end label shows ATD (not Completed) | ⏳ | |
| TL-04 | TRACKED POD task — scheduled_end label shows ETA (not Sched. End) | ⏳ | |
| TL-05 | TRACKED POD task — actual_start label shows ATA (not Started) | ⏳ | |
| TL-06 | TRACKED POD task — actual_end label shows ATA (not Completed) | ⏳ | |
| TL-07 | Non-TRACKED task — generic labels unchanged (Sched. End, Started, Completed) | ⏳ | |

---

## Vessel Display
| # | Test | Status | Notes |
|---|---|---|---|
| VD-01 | Route card — vessel name + voyage shown below port pair (test on AFCQ-003829 — MTT LUMUT · V.26LM073E) | ⏳ | |
| VD-02 | Route card — vessel row absent when no BL update done (no vessel data) | ⏳ | |
| VD-03 | Route card — only vessel name shown (no separator) when voyage missing | ⏳ | |
| VD-04 | TRACKED POL task card — vessel name + voyage shown inline | ⏳ | |
| VD-05 | TRACKED POD task card — vessel name + voyage shown inline | ⏳ | |
| VD-06 | Non-TRACKED task card — no vessel info shown | ⏳ | |
| VD-07 | Non-POL/POD TRACKED task card — no vessel info shown | ⏳ | |

---

## Task Timestamps
| # | Test | Status | Notes |
|---|---|---|---|
| TS-01 | Task card shows date + time e.g. 28 Feb 2026 14:30 not just date | ✅ | |
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
| TV-01 | Hidden task — card stays full opacity (no greying out) | ✅ | |
| TV-02 | Hidden task — task label normal (no strikethrough) | ✅ | |
| TV-03 | Hidden task — EyeOff icon shows amber highlight | ✅ | |
| TV-04 | Visible task — Eye icon shows default muted style | ✅ | |

---

## General Shipment
| # | Test | Status | Notes |
|---|---|---|---|
| GS-01 | V1 shipment (AFCQ-) loads without error | ✅ | |
| GS-02 | V2 shipment (AF-) loads without error | ⏳ | |
| GS-03 | Shipment list table scrolls horizontally without clipping | ✅ | |
| GS-04 | User table scrolls horizontally without clipping | ✅ | |
| GS-05 | Stale task display_name resolved | ✅ | |
| GS-06 | Edit button visible on IGNORED tasks | ✅ | |
| GS-07 | Task timestamps status guard working | ✅ | |
