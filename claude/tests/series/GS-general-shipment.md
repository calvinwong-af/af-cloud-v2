# GS — General Shipment
**Series:** GS
**Status:** ✅ Complete
**Total:** 14 | **YES:** 14 | **PENDING:** 0 | **DEFERRED:** 0 | **NA:** 0
**Last Updated:** 03 March 2026

---

## Tests

| # | Test | Status | Notes |
|---|---|---|---|
| GS-01 | V1 shipment (AFCQ-) loads without error | YES | |
| GS-02 | V2 shipment (AF-) loads without error | YES | |
| GS-03 | Shipment list scrolls horizontally without clipping | YES | |
| GS-04 | User table scrolls horizontally without clipping | YES | |
| GS-05 | Stale task display_name resolved | YES | |
| GS-06 | Edit button visible on IGNORED tasks | YES | |
| GS-07 | Task timestamps status guard working | YES | |
| GS-09 | V1 badge shows on migrated AF- records (migrated_from_v1=true) | YES | AF-003864/003863/003861/003860 |
| GS-10 | V1 badge NOT shown on native V2 AF- records | YES | AF-003867 |
| GS-11 | V1 badge visible on mobile card view | YES | |
| GS-12 | Shipment list context menu flips upward near viewport bottom | YES | MCP fix 03 Mar 2026 |
| GS-13 | V1 Confirmed (2001) shipments in Active tab, not Completed | YES | MCP fix to db_queries.py |
| GS-14 | apply_awb + apply_booking_confirmation — no TypeError on JSONB | YES | v2.72 _parse_jsonb() |

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 2.51 | 03 Mar 2026 | Migrated from AF-Test-List.md |
