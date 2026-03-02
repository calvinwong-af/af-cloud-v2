# SD — Shipment Delete
**Series:** SD
**Status:** ✅ Complete
**Total:** 3 | **YES:** 3 | **PENDING:** 0 | **DEFERRED:** 0 | **NA:** 0
**Last Updated:** 03 March 2026

---

## Tests

| # | Test | Status | Notes |
|---|---|---|---|
| SD-01 | Soft delete — shipment disappears from all tabs | YES | AF-003865 |
| SD-02 | Soft delete — row still in DB with trash=true | YES | DB query confirmed |
| SD-04 | Hard delete — removes all rows from DB | YES | |

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 2.51 | 03 Mar 2026 | Migrated from AF-Test-List.md |
