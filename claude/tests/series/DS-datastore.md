# DS — Datastore Sweep
**Series:** DS
**Status:** 🔵 Active
**Total:** 4 | **YES:** 3 | **PENDING:** 1 | **DEFERRED:** 0 | **NA:** 0
**Last Updated:** 03 March 2026

---

## Tests

| # | Test | Status | Notes |
|---|---|---|---|
| DS-01 | createShipmentOrder() migrated to af-server POST endpoint | YES | v2.53 |
| DS-02 | deleteShipmentOrder() migrated to af-server DELETE endpoint | YES | v2.53 |
| DS-03 | datastore-query.ts still imported by users module | PENDING | LOW — users not yet on PostgreSQL |
| DS-04 | actions/shipments.ts has zero Datastore reads | YES | Code review confirmed |

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 2.51 | 03 Mar 2026 | Migrated from AF-Test-List.md |
