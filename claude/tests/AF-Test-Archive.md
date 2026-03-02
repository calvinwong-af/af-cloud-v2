# AF Platform — Test Archive
**Created:** 02 March 2026
**Purpose:** Retired and superseded test series. Kept for audit trail only. Do not add new tests here.

---

## Version History (pre v2.20)
| Version | Date | Changes |
|---|---|---|
| 1.0 | 28 Feb 2026 | Initial test list |
| 1.1 | 28 Feb 2026 | Added DT series, TS series |
| 1.2 | 28 Feb 2026 | Added TV series; TS-02, DT-10, TV-01-04 confirmed |
| 1.3 | 28 Feb 2026 | TS-01, TS-07 confirmed; DT series deferred |
| 1.4 | 28 Feb 2026 | TS-03-06 confirmed; DT-10 re-opened; DT-14-16 added |
| 1.5 | 28 Feb 2026 | BL-16/17 fix deployed; PP series added |
| 1.6 | 28 Feb 2026 | All Opus tasks confirmed deployed |
| 1.7 | 28 Feb 2026 | Testing session — VD/TL series confirmed |
| 1.8 | 28 Feb 2026 | TL-07/08 confirmed. BL-11/13/14/15 confirmed |
| 1.9 | 28 Feb 2026 | BL-01-03/05-06/08-09/18-24 confirmed. VD-01/02. PP-02/04/07/10. GS-02 |
| 2.0 | 28 Feb 2026 | PT series added. MYPKG_N scoped |
| 2.1 | 01 Mar 2026 | AFC test session. AC series confirmed. BL-04, PP-01, TL-09 confirmed. canEdit() fixed |
| 2.2 | 01 Mar 2026 | EP series added. OF series added |
| 2.3 | 01 Mar 2026 | EP series confirmed. OF series retired. MI series added |
| 2.4 | 01 Mar 2026 | TI series added. V1 badge tests added to GS series |
| 2.5 | 01 Mar 2026 | TI-04, TI-05 confirmed |
| 2.6 | 01 Mar 2026 | TI-06 confirmed. GS-08–11, TI-07 updated |
| 2.7 | 01 Mar 2026 | TI series fully confirmed |
| 2.8 | 01 Mar 2026 | GS-08 retired. GS-09 opened as NO |
| 2.9 | 01 Mar 2026 | LV series + SU series added |
| 2.10 | 01 Mar 2026 | LV-01/02/04 confirmed. GS-10 confirmed |
| 2.11 | 01 Mar 2026 | AF-003866/003867 visible. Active badge off by 1 noted |
| 2.12 | 01 Mar 2026 | GS-09 YES — V1 badge confirmed on migrated AF- records |
| 2.13 | 01 Mar 2026 | LV-02 YES — Active=24, Total=2044. IN series added |
| 2.14 | 01 Mar 2026 | IN + SU series retired. LV-02 notes corrected |
| 2.15 | 01 Mar 2026 | v2.44 confirmed: Active=23, Total=2043. AF-003862 absent |
| 2.16 | 01 Mar 2026 | GS-11 confirmed YES. MB series added (all deferred) |
| 2.17 | 01 Mar 2026 | MI series retired. V2C series added |
| 2.18 | 01 Mar 2026 | PG series added. V2C series retired |
| 2.19 | 01 Mar 2026 | PG-03/04/05/14/15 confirmed from live snapshot |

---

## V1 to V2 Migration (MI series) — RETIRED
> Migration complete. 3,854 AF- records confirmed. V1 dual-path removed in v2.45.

| # | Test | Status |
|---|---|---|
| MI-01 | --only AFCQ-003829 dry run — correct V2 record assembled | NA |
| MI-02 | Full dry run — 3,851 records, 0 assembly errors | NA |
| MI-03 | Live run — spot-check 3 migrated records readable | NA |
| MI-04 | Status writes use data_version check not ID prefix | NA |
| MI-05 | Stale AFCQ- URL resolves to correct AF- record | NA |
| MI-06 | All 3,851 AFCQ- records appear as AF- post-migration | NA |
| MI-07 | ShipmentWorkFlow re-keyed — tasks still visible | NA |
| MI-08 | Files re-keyed — uploaded files still visible | NA |
| MI-09 | ShipmentOrderV2CountId registered — no ID reuse | NA |
| MI-10 | Migration script is idempotent | NA |

---

## V2 Cleanup Verification (V2C series) — RETIRED
> Superseded by PG series (PostgreSQL migration).

| # | Test | Status |
|---|---|---|
| V2C-01 | Shipment list loads after V1 path removal | NA |
| V2C-02 | Completed tab loads historical records | NA |
| V2C-03 | To Invoice tab shows 8 records | NA |
| V2C-04 | Stats unchanged — Active=23, Total=2044, TI=8 | NA |
| V2C-05 | AFCQ-003829 URL resolves to AF-003829 | NA |
| V2C-06 | AF-003829 detail page loads all fields | NA |
| V2C-07 | Status update on migrated AF- record saves correctly | NA |
| V2C-08 | BL update on migrated AF- record saves correctly | NA |
| V2C-09 | Search returns migrated AF- records by AFCQ- ID | NA |
| V2C-10 | Server starts without import errors | NA |

---

## Order List Filter — Pagination (OF series) — RETIRED
> Resolved by V1 to V2 migration — single PostgreSQL query, no in-memory filtering.

| # | Test | Status |
|---|---|---|
| OF-01 | Active tab — all active shipments shown, no filter pagination bug | NA |
| OF-02 | Active tab Load More — advances correctly, no skipped records | NA |
| OF-03 | Completed tab — all completed shipments shown | NA |

---

## Sort Order (SR series) — RETIRED
> Standing principle established: countid DESC, no multi-tier sorting.

| # | Test | Status |
|---|---|---|
| SR-01 | Shipment list sorted by countid DESC | NA |
| SR-02 | Search results sorted by countid DESC | NA |

---

## 003862 Incoterm Fix (IN series) — RETIRED
> AF-003862 entity removed by revert script (v2.44). Non-issue.

| # | Test | Status |
|---|---|---|
| IN-01 | AF-003862 incoterm column shows correct value | NA |
| IN-02 | AF-003862 detail page loads correctly | NA |

---

## AFCQ Superseded Dedup (SU series) — RETIRED
> 003862 was a cancelled order — revert applied, entity removed.

| # | Test | Status |
|---|---|---|
| SU-01 | AFCQ-003862 does NOT appear in shipment list | NA |
| SU-02 | AF-003862 DOES appear in shipment list | NA |
| SU-03 | AF-003862 shows V1 badge | NA |
| SU-04 | Navigating to /shipments/AFCQ-003862 redirects to AF-003862 | NA |
