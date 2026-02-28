# AF Platform — Test List
**Version:** 1.4
**Last Updated:** 28 February 2026

## Version History
| Version | Date | Changes |
|---|---|---|
| 1.0 | 28 Feb 2026 | Initial test list — BL update mode, general shipment |
| 1.1 | 28 Feb 2026 | Added DT series (date inputs), TS series (task timestamps) |
| 1.2 | 28 Feb 2026 | Added TV series (task visibility); marked TS-02, DT-10, TV-01–04 confirmed |
| 1.3 | 28 Feb 2026 | Marked TS-01, TS-07 confirmed; DT series deferred |
| 1.4 | 28 Feb 2026 | TS-03–06 confirmed ✅; DT-10 re-opened ❌ (two-digit input broken); ETD/ETA fields changed to DateTimeInput (new DT-14–16); DT series un-deferred |

## How to Use
- ✅ = Confirmed working
- ❌ = Confirmed broken
- ⏳ = Not yet tested
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
| BL-16 | Vessel and voyage saved and displayed after BL update | ⏳ | Fix in current VS Code prompt — pending |
| BL-17 | Transport section visible on shipment detail after BL update | ⏳ | Fix in current VS Code prompt — pending |

---

## Date / DateTime Inputs (DateInput + DateTimeInput components)
| # | Test | Status | Notes |
|---|---|---|---|
| DT-01 | BLUpdateModal ETD — displays as DD/MM/YYYY HH:mm after parse | ⏳ | Changed to DateTimeInput |
| DT-02 | BLUpdateModal ETD — type 28022026 auto-formats to 28/02/2026, time defaults to 00:00 | ⏳ | Changed to DateTimeInput |
| DT-03 | BLUpdateModal ETD — type invalid date 31/02/2026 clears on blur | ⏳ | |
| DT-04 | BLUpdateModal ETD — pre-filled from parsed BL shows correct date and time | ⏳ | Changed to DateTimeInput |
| DT-05 | BLUploadTab ETD — same formatting behaviour as BLUpdateModal | ⏳ | Changed to DateTimeInput |
| DT-06 | ShipmentTasks scheduled start — displays as DD/MM/YYYY | ⏳ | |
| DT-07 | ShipmentTasks scheduled end — displays as DD/MM/YYYY | ⏳ | |
| DT-08 | ShipmentTasks actual start — displays as DD/MM/YYYY HH:mm | ⏳ | |
| DT-09 | ShipmentTasks actual end — displays as DD/MM/YYYY HH:mm | ⏳ | |
| DT-10 | DateTimeInput — hour/minute fields accept two-digit input (11, 12, 24, 25) | ❌ | Broken — single digit only currently |
| DT-11 | ShipmentTasks actual start — saved value persists time after reload | ⏳ | |
| DT-12 | RouteNodeTimeline — ETD/ETA inputs display as DD/MM/YYYY HH:mm | ⏳ | Changed to DateTimeInput |
| DT-13 | RouteNodeTimeline — save timing persists correctly | ⏳ | |
| DT-14 | ETD date entry auto-sets time to 00:00 when time not manually entered | ⏳ | New requirement |
| DT-15 | ETA date entry auto-sets time to 00:00 when time not manually entered | ⏳ | New requirement |
| DT-16 | Manually entered time overrides the 00:00 default | ⏳ | New requirement |

---

## Task Timestamps
| # | Test | Status | Notes |
|---|---|---|---|
| TS-01 | Task card shows date + time e.g. 28 Feb 2026 14:30 not just date | ✅ | |
| TS-02 | COMPLETED task — edit button is visible | ✅ | Confirmed working |
| TS-03 | COMPLETED task — can edit actual_start and save | ✅ | Confirmed working |
| TS-04 | COMPLETED task — can edit actual_end and save | ✅ | Confirmed working |
| TS-05 | COMPLETED task — can edit completed_at and save | ✅ | Confirmed working |
| TS-06 | Edited timestamp on completed task persists after page reload | ✅ | Confirmed working |
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
