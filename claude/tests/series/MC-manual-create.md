# MC — Manual Shipment Create
**Series:** MC
**Status:** ✅ Complete
**Total:** 6 | **YES:** 6 | **PENDING:** 0 | **DEFERRED:** 0 | **NA:** 0
**Last Updated:** 03 March 2026

---

## Tests

| # | Test | Status | Notes |
|---|---|---|---|
| MC-01 | POST /api/v2/shipments creates shipment in PostgreSQL | YES | AF-003872 |
| MC-02 | Created shipment navigates to detail page immediately | YES | |
| MC-03 | Created shipment has auto-generated tasks | YES | 7 tasks (EXW IMPORT SEA FCL) |
| MC-04 | createShipmentOrderAction() imports no legacy lib functions | YES | Code review |
| MC-05 | createShipmentOrderAction() returns correct shipment_id | YES | |
| MC-06 | Containers card displays correctly on manual SEA_FCL | YES | AF-003872 — 20GP DRY x 1 |

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 2.51 | 03 Mar 2026 | Migrated from AF-Test-List.md |
