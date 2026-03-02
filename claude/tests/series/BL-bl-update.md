# BL — BL Update
**Series:** BL
**Status:** ✅ Complete
**Total:** 30 | **YES:** 30 | **PENDING:** 0 | **DEFERRED:** 0 | **NA:** 0
**Last Updated:** 03 March 2026

---

## Tests

| # | Test | Status | Notes |
|---|---|---|---|
| BL-01 | BL update visible on SEA_FCL >= status 2001 (AFU) | YES | AF-003867 |
| BL-02 | BL update visible on SEA_LCL >= status 2001 (AFU) | YES | AFCQ-003830 |
| BL-03 | BL update NOT visible on AIR shipment | YES | |
| BL-04 | BL update NOT visible for AFC users | YES | |
| BL-05 | BL parses successfully — fields pre-fill form | YES | AFCQ-003829 |
| BL-06 | Update Shipment succeeds on V2 (AF-) | YES | AF-003867 |
| BL-07 | Update Shipment succeeds on V1 (AFCQ-) | YES | AFCQ-003829 |
| BL-08 | BL PDF auto-saved to Files tab with tag bl | YES | |
| BL-09 | Carrier / Agent label shown | YES | |
| BL-10 | LCL: Cargo Summary shown, Containers hidden | YES | AFCQ-003794 |
| BL-11 | FCL: Containers table shown | YES | AFCQ-003832 |
| BL-12 | Cargo items table is inline-editable | YES | |
| BL-13 | Containers table is inline-editable | YES | |
| BL-14 | Add row to cargo items table | YES | |
| BL-15 | Delete row from cargo items table | YES | |
| BL-16 | Vessel and voyage saved and displayed after BL update | YES | |
| BL-17 | Transport section visible on shipment detail after BL update | YES | |
| BL-18 | Shipper name + address pre-filled from BL parse | YES | AF-003867 |
| BL-19 | Consignee name + address pre-filled from BL parse | YES | AF-003867 |
| BL-20 | Parties card visible on Overview tab after BL update (V2) | YES | AF-003867 |
| BL-21 | Diff icon shown when bl consignee != shipment consignee | YES | AF-003867 |
| BL-22 | Diff tooltip shows truncated BL value on hover | YES | |
| BL-23 | BLPartyDiffModal opens — side-by-side view | YES | |
| BL-24 | Use BL Values updates shipment order, diff icon disappears | YES | |
| BL-25 | BL upload — port of loading saved to Route card | YES | AF-003837 CNSHK |
| BL-26 | BL upload — port of discharge saved to Route card | YES | AF-003837 MYPKG |
| BL-27 | Port codes persist on Route card after page reload | YES | |
| BL-28 | BL update — container number saved and displayed | YES | AF-003837 SEGU6868838 |
| BL-29 | BL update — seal number saved and displayed | YES | AF-003837 YMAV438141 |
| BL-30 | Containers card hint text hidden once container numbers present | YES | |

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 2.51 | 03 Mar 2026 | Migrated from AF-Test-List.md |
