# PT — Port Terminal
**Series:** PT
**Status:** ✅ Complete
**Total:** 13 | **YES:** 13 | **PENDING:** 0 | **DEFERRED:** 0 | **NA:** 0
**Last Updated:** 03 March 2026

---

## Tests

| # | Test | Status | Notes |
|---|---|---|---|
| PT-01 | Audit script runs clean — port code frequency table output | YES | 9,739 records, 283 distinct codes |
| PT-02 | Audit script flags MYPKG_N as TERMINAL SUFFIX | YES | 958 occurrences |
| PT-03 | Audit script infers base code MYPKG from MYPKG_N | YES | |
| PT-04 | MYPKG Port entity has terminals array (Westports + Northport) | YES | 17 ports seeded |
| PT-05 | seed_port_terminals.py is idempotent | YES | |
| PT-06 | migrate_v1_port_codes.py --dry-run shows expected records | YES | 4,345 to update |
| PT-07 | migrate_v1_port_codes.py updates MYPKG_N → port_un_code=MYPKG + terminal_id=MYPKG_N | YES | AFCQ-003794 verified |
| PT-08 | Migration is idempotent — already-migrated records skipped | YES | |
| PT-09 | V1 Northport shipment displays MYPKG with Northport terminal line | YES | AF-003794 |
| PT-10 | V1 Westports shipment displays MYPKG with no terminal line | YES | AF-003837 |
| PT-11 | Port name tooltip: Port Klang (Northport), Malaysia for MYPKG_N | YES | AF-003794 |
| PT-12 | Port name tooltip: Port Klang, Malaysia for MYPKG | YES | AF-003837 |
| PT-13 | Port label lookup works for all other standard codes unchanged | YES | AF-003837 CNSHK confirmed |

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 2.51 | 03 Mar 2026 | Migrated from AF-Test-List.md |
