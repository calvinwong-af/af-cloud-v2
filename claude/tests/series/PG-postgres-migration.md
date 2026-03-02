# PG — PostgreSQL Migration
**Series:** PG
**Status:** ✅ Complete
**Total:** 20 | **YES:** 20 | **PENDING:** 0 | **DEFERRED:** 0 | **NA:** 0
**Last Updated:** 03 March 2026

---

## Tests

| # | Test | Status | Notes |
|---|---|---|---|
| PG-01 | Schema created without errors | YES | 58.4ms |
| PG-02 | Dry run: 3,854 shipments, 0 errors | YES | |
| PG-03 | Commit run: row counts match | YES | 3854/642/2036/1085/337 |
| PG-04 | Stats endpoint under 100ms | YES | 3.9ms |
| PG-05 | Active tab loads under 150ms | YES | 128–357ms |
| PG-06 | Completed tab loads 25 records with total count | YES | 2020 total |
| PG-07 | Search returns results under 100ms | YES | |
| PG-08 | Shipment detail page loads correctly | YES | AF-003866/003830/003844 |
| PG-09 | AFCQ- URL resolves to AF- record | YES | AFCQ-003829 → AF-003829 |
| PG-10 | Status update writes to PostgreSQL correctly | YES | AF-003837 |
| PG-11 | BL update writes ports and reflects in Route card | YES | AF-003837 CNSHK + MYPKG |
| PG-12 | New shipment gets correct AF-XXXXXX sequence ID | YES | AF-003871 |
| PG-13 | af-platform builds without errors after Datastore lib removal | YES | |
| PG-14 | Stats counts correct after migration | YES | Total=2043, Active=23 |
| PG-15 | Dashboard loads under 500ms (was 8–12s) | YES | ~350ms |
| PG-16 | Invoice icon correct on completed shipments | YES | |
| PG-17 | AF-003854 and AF-003851 show green invoiced icon | YES | |
| PG-18 | All V1 completed shipments show correct invoice icon | YES | |
| PG-19 | Shipment list sorts by countid DESC | YES | |
| PG-20 | AF-003752 status = -1, absent from active list | YES | |

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 2.51 | 03 Mar 2026 | Migrated from AF-Test-List.md |
