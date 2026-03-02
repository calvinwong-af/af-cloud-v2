# AF Platform — Test Master
**Version:** 2.51
**Last Updated:** 03 March 2026

> Individual series detail lives in `claude/tests/series/`. Retired series (MI, V2C, OF, SR, IN, SU) are in `AF-Test-Archive.md`.

---

## Series Registry

| Series | Description | Total | YES | PENDING | DEFERRED | NA | Status | File |
|---|---|---|---|---|---|---|---|---|
| DP | Document Parser | 40 | 17 | 19 | 0 | 0 | 🔵 Active | series/DP-document-parse.md |
| DT | DateTime Inputs | 16 | 1 | 15 | 0 | 0 | 🔵 Active | series/DT-datetime.md |
| VD | Vessel Display | 7 | 5 | 2 | 0 | 0 | 🔵 Active | series/VD-vessel-display.md |
| PP | Port Pair Display | 9 | 8 | 1 | 0 | 0 | 🔵 Active | series/PP-port-pair.md |
| DS | Datastore Sweep | 4 | 3 | 1 | 0 | 0 | 🔵 Active | series/DS-datastore.md |
| BUG2 | Bug Fixes | 2 | 1 | 0 | 1 | 0 | 🔵 Active | series/BUG2-bugfixes.md |
| MB | Mobile | 13 | 2 | 0 | 11 | 0 | 🟡 Deferred | series/MB-mobile.md |
| AUTH | Authentication | 5 | 3 | 0 | 0 | 2 | ✅ Complete | series/AUTH-authentication.md |
| PT | Port Terminal | 13 | 13 | 0 | 0 | 0 | ✅ Complete | series/PT-port-terminal.md |
| BL | BL Update | 30 | 30 | 0 | 0 | 0 | ✅ Complete | series/BL-bl-update.md |
| BU | BL Upload (parties) | 7 | 7 | 0 | 0 | 0 | ✅ Complete | series/BU-bl-upload-parties.md |
| TL | Task Timing Labels | 9 | 9 | 0 | 0 | 0 | ✅ Complete | series/TL-task-timing-labels.md |
| TS | Task Timestamps | 7 | 7 | 0 | 0 | 0 | ✅ Complete | series/TS-task-timestamps.md |
| TV | Task Visibility | 4 | 4 | 0 | 0 | 0 | ✅ Complete | series/TV-task-visibility.md |
| GS | General Shipment | 14 | 14 | 0 | 0 | 0 | ✅ Complete | series/GS-general-shipment.md |
| AC | AFC Customer Access | 16 | 16 | 0 | 0 | 0 | ✅ Complete | series/AC-afc-customer-access.md |
| PG | PostgreSQL Migration | 20 | 20 | 0 | 0 | 0 | ✅ Complete | series/PG-postgres-migration.md |
| BUG1 | Invoice/Status Icons | 2 | 2 | 0 | 0 | 0 | ✅ Complete | series/BUG1-invoice-icons.md |
| EP | Edit Parties | 5 | 5 | 0 | 0 | 0 | ✅ Complete | series/EP-edit-parties.md |
| TI | To Invoice | 7 | 7 | 0 | 0 | 0 | ✅ Complete | series/TI-to-invoice.md |
| LV | List Visibility | 6 | 6 | 0 | 0 | 0 | ✅ Complete | series/LV-list-visibility.md |
| MC | Manual Shipment Create | 6 | 6 | 0 | 0 | 0 | ✅ Complete | series/MC-manual-create.md |
| SD | Shipment Delete | 3 | 3 | 0 | 0 | 0 | ✅ Complete | series/SD-shipment-delete.md |
| LO | Loading State UI | 5 | 5 | 0 | 0 | 0 | ✅ Complete | series/LO-loading-state.md |
| **TOTAL** | | **239** | **193** | **38** | **12** | **2** | | |

---

## How to Use

- **Start of session:** Read this file only to get project test status overview
- **Working on a feature:** Read the relevant series file from `series/`
- **Updating tests:** Update the series file + update the counts in this master table
- **Series complete:** Change status to ✅ Complete in this table; series file remains in `series/`
- **Adding a new series:** Add a row here + create a new file in `series/`

---

## Status Key

| Status | Meaning |
|---|---|
| 🔵 Active | Has PENDING tests — work in progress |
| 🟡 Deferred | All tests deferred — parked for a dedicated pass |
| ✅ Complete | All tests YES or NA — series closed |
| 🗄️ Archived | Moved to AF-Test-Archive.md (legacy series) |

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 2.51 | 03 Mar 2026 | Migrated from AF-Test-List.md to modular structure |
