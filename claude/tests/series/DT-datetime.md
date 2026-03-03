# DT — DateTime Inputs
**Series:** DT
**Status:** 🔵 Active
**Total:** 14 | **YES:** 10 | **PENDING:** 0 | **DEFERRED:** 0 | **NA:** 5
**Status:** ✅ Complete
**Last Updated:** 03 March 2026

---

## Tests

| # | Test | Status | Notes |
|---|---|---|---|
| DT-01 | BLUpdateModal ETD — displays as DD/MM/YYYY HH:mm after parse | NA | BLUpdateModal deleted v3.15 |
| DT-02 | BLUpdateModal ETD — type 28022026 auto-formats, time defaults to 00:00 | NA | BLUpdateModal deleted v3.15 |
| DT-03 | BLUpdateModal ETD — invalid date clears on blur | NA | BLUpdateModal deleted v3.15 |
| DT-04 | BLUpdateModal ETD — pre-filled from parsed BL shows correct date and time | NA | BLUpdateModal deleted v3.15 |
| DT-05 | BLUploadTab ETD — same formatting behaviour as BLUpdateModal | NA | BLUpdateModal deleted v3.15 |
| DT-06 | ShipmentTasks scheduled start — displays as DD/MM/YYYY HH:mm | YES | |
| DT-07 | ShipmentTasks scheduled end — displays as DD/MM/YYYY HH:mm | YES | |
| DT-08 | ShipmentTasks actual start — displays as DD/MM/YYYY HH:mm | YES | |
| DT-09 | ShipmentTasks actual end — displays as DD/MM/YYYY HH:mm | YES | |
| DT-10 | DateTimeInput — hour/minute fields accept two-digit input | YES | |
| DT-11 | ShipmentTasks actual start — saved value persists time after reload | YES | |
| DT-14 | ETD date entry auto-sets time to 00:00 when time not manually entered | YES | |
| DT-15 | ETA date entry auto-sets time to 00:00 when time not manually entered | YES | |
| DT-16 | Manually entered time overrides the 00:00 default | YES | |

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 2.51 | 03 Mar 2026 | Migrated from AF-Test-List.md |
