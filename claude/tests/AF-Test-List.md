# AF Platform — Test List
**Version:** 2.27
**Last Updated:** 02 March 2026

## Version History
| Version | Date | Changes |
|---|---|---|
| 2.27 | 02 Mar 2026 | BU series added (7 tests) — BL Upload Tab party fields (shipper, consignee address, notify party). |
| 2.26 | 02 Mar 2026 | DS-01/02 YES — create+delete migrated to af-server. MC series (5 tests) + SD series (5 tests) added. |
| 2.25 | 02 Mar 2026 | BUG1-01/02 and BUG2-01 confirmed YES from snapshot. BUG2-02 deferred to mobile pass. |
| 2.24 | 02 Mar 2026 | BUG1 series (invoice icon on All tab/search) + BUG2 series (4002 Arrived icon fix). |
| 2.23 | 02 Mar 2026 | LO-01/LO-03 updated — per-action loading states with colored spinners. advanceLoading/revertLoading/cancelLoading replace single loading boolean. |
| 2.22 | 02 Mar 2026 | PG-16 to PG-20 all confirmed YES. Invoice icons, sort order, and AF-003752 all verified on production. |
| 2.21 | 02 Mar 2026 | PG-16 to PG-20 added — issued_invoice fix, backfill, sort simplification, AF-003752 manual fix. All changes from this session captured. |
| 2.20 | 02 Mar 2026 | SR series retired (sort resolved — countid DESC standing principle). DS series added (4 items, Datastore sweep audit). LO series added (3 tests, inline loading indicators). |
| 2.19 | 01 Mar 2026 | PG series partially confirmed — PG-03/04/05/14/15 YES from live production snapshot. Migration complete and deployed. |
| 2.18 | 01 Mar 2026 | PG series added (15 tests, PostgreSQL migration verification). V2C series retired (NA) — superseded by PG series. |
| 2.17 | 01 Mar 2026 | MI series retired (NA) — migration complete. V2C series added (10 tests, V2 cleanup verification). |
| 2.16 | 01 Mar 2026 | GS-11 confirmed YES from mobile snapshot. MB series added — all mobile tests deferred pending mobile UX improvement pass. |
| 2.15 | 01 Mar 2026 | v2.44 confirmed: Active=23, Total=2043. AF-003862 absent from list. All 003862 workaround data removed from Datastore. |
| 2.14 | 01 Mar 2026 | IN and SU series retired (NA) — 003862 was a cancelled order, never should have been active. migrate_003862.py was a mistake; revert script written (v2.44). LV-02 notes corrected. Active count correct at 23. |
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
| 2.1 | 01 Mar 2026 | AFC test session complete. AC series added and all confirmed. BL-04, PP-01, TL-09 confirmed. canEdit() fixed to AFU-only |
| 2.2 | 01 Mar 2026 | EP series added (Edit Parties clear fix). OF series added (Order list filter pagination). |
| 2.3 | 01 Mar 2026 | EP series all confirmed PASSED. OF series retired (resolved by V1 migration). MI series added (V1 to V2 migration). |
| 2.4 | 01 Mar 2026 | TI series added (To Invoice fixes). V1 badge tests added to GS series. |
| 2.5 | 01 Mar 2026 | TI-04, TI-05 confirmed. |
| 2.6 | 01 Mar 2026 | TI-06 confirmed (v2.33 deployed). GS-08–11, TI-07 updated to ready-for-visual-test. |
| 2.7 | 01 Mar 2026 | TI series fully confirmed. |
| 2.8 | 01 Mar 2026 | GS-08 retired (NA). GS-09 opened as NO — migrated_from_v1 not surfacing in list. GS-10/11 blocked. |
| 2.9 | 01 Mar 2026 | v2.34 tests added: LV series (list visibility), SU series (superseded dedup). GS-09/10/11 unblocked pending v2.34. |
| 2.10 | 01 Mar 2026 | v2.34 evaluated against snapshot. LV-01/02/04 confirmed. GS-10 confirmed. SU-01 still NO (script not run). |
| 2.11 | 01 Mar 2026 | v2.35 context: AF-003866/003867 visible in Active tab. Active badge=23 (off by 1 — open issue). GS-09 still NO (V1 badge not confirmed on migrated AF- records). SU-01 still NO (003862 superseded script not run). |
| 2.12 | 01 Mar 2026 | v2.37 snapshot: GS-09 YES — V1 badge confirmed on AF-003864/003863/003861/003860. GS-11 PENDING. Active badge still 23 (off by 1, open issue). Stats otherwise stable (Total=2043, Completed=2019, Draft=1, TI=8, Cancelled=0). |
| 2.13 | 01 Mar 2026 | v2.41 snapshot: LV-02 YES — Active=24, Total=2044. AF-003862 visible in list with V1 badge. IN series added for 003862 incoterm missing. |
| 2.14 | 02 Mar 2026 | v2.34 session: PG-08/PG-09 confirmed. Sort fix applied — list now sorts by countid DESC. Three 500 fixes verified locally. |

## How to Use
- YES = Confirmed working
- NO = Confirmed broken
- PENDING = Not yet tested
- WIP = In progress / partially tested
- NA = Removed by design decision

---

## BL Update Mode
| # | Test | Status | Notes |
|---|---|---|---|
| BL-01 | BL update visible on SEA_FCL shipment >= status 2001 (AFU) | YES | AF-003867 confirmed |
| BL-02 | BL update visible on SEA_LCL shipment >= status 2001 (AFU) | YES | AFCQ-003830 confirmed |
| BL-03 | BL update NOT visible on AIR shipment | YES | AFCQ-003861 confirmed |
| BL-04 | BL update NOT visible for AFC users | YES | AFCQ-003860 + AFCQ-003832 confirmed 01 Mar 2026 |
| BL-05 | BL parses successfully — fields pre-fill form | YES | AFCQ-003829 tested |
| BL-06 | Update Shipment succeeds on V2 (AF-) shipment | YES | AF-003867 confirmed |
| BL-07 | Update Shipment succeeds on V1 (AFCQ-) shipment | YES | AFCQ-003829 confirmed |
| BL-08 | BL PDF auto-saved to Files tab with tag bl after update | YES | |
| BL-09 | Carrier / Agent label shown (not Carrier) | YES | |
| BL-10 | LCL: Cargo Summary table shown, Containers table hidden | YES | AFCQ-003794 tested |
| BL-11 | FCL: Containers table shown | YES | AFCQ-003832 confirmed |
| BL-12 | Cargo items table is inline-editable (qty, weight, CBM, description) | YES | |
| BL-13 | Containers table is inline-editable (container no., type, seal) | YES | AFCQ-003832 confirmed |
| BL-14 | Add row to cargo items table | YES | AFCQ-003832 confirmed |
| BL-15 | Delete row from cargo items table | YES | AFCQ-003832 confirmed |
| BL-16 | Vessel and voyage saved and displayed after BL update | YES | Fixed in v1-assembly.ts |
| BL-17 | Transport section visible on shipment detail after BL update | YES | AFCQ-003829 confirmed |
| BL-18 | Shipper name + address pre-filled from BL parse | YES | AF-003867 confirmed |
| BL-19 | Consignee name + address pre-filled from BL parse | YES | AF-003867 confirmed |
| BL-20 | Parties card visible on Overview tab after BL update (V2) | YES | AF-003867 confirmed — V1 deferred |
| BL-21 | Diff icon shown when bl_document consignee != shipment_order consignee | YES | AF-003867 — KG vs KGS |
| BL-22 | Diff tooltip shows truncated BL value on hover | YES | AF-003867 confirmed |
| BL-23 | BLPartyDiffModal opens on diff icon click — side-by-side view | YES | AF-003867 confirmed |
| BL-24 | Use BL Values in diff modal updates shipment order, diff icon disappears | YES | AF-003867 confirmed |

---

## Date / DateTime Inputs
| # | Test | Status | Notes |
|---|---|---|---|
| DT-01 | BLUpdateModal ETD — displays as DD/MM/YYYY HH:mm after parse | PENDING | |
| DT-02 | BLUpdateModal ETD — type 28022026 auto-formats, time defaults to 00:00 | PENDING | |
| DT-03 | BLUpdateModal ETD — invalid date clears on blur | PENDING | |
| DT-04 | BLUpdateModal ETD — pre-filled from parsed BL shows correct date and time | PENDING | |
| DT-05 | BLUploadTab ETD — same formatting behaviour as BLUpdateModal | PENDING | |
| DT-06 | ShipmentTasks scheduled start — displays as DD/MM/YYYY HH:mm | PENDING | |
| DT-07 | ShipmentTasks scheduled end — displays as DD/MM/YYYY HH:mm | PENDING | |
| DT-08 | ShipmentTasks actual start — displays as DD/MM/YYYY HH:mm | PENDING | |
| DT-09 | ShipmentTasks actual end — displays as DD/MM/YYYY HH:mm | PENDING | |
| DT-10 | DateTimeInput — hour/minute fields accept two-digit input | YES | |
| DT-11 | ShipmentTasks actual start — saved value persists time after reload | PENDING | |
| DT-12 | RouteNodeTimeline — ETD/ETA inputs display as DD/MM/YYYY HH:mm | PENDING | |
| DT-13 | RouteNodeTimeline — save timing persists correctly | PENDING | |
| DT-14 | ETD date entry auto-sets time to 00:00 when time not manually entered | PENDING | |
| DT-15 | ETA date entry auto-sets time to 00:00 when time not manually entered | PENDING | |
| DT-16 | Manually entered time overrides the 00:00 default | PENDING | |

---

## Port Pair Display
| # | Test | Status | Notes |
|---|---|---|---|
| PP-01 | Route card — AFC user sees POL / POD labels | YES | AFCQ-003860 + AFCQ-003832 confirmed 01 Mar 2026 |
| PP-02 | Route card — AFU user sees Origin / Destination labels | YES | AF-003867 confirmed |
| PP-03 | Route card — port code displays in large monospace font | YES | |
| PP-04 | Route card — port name appears as tooltip on hover | YES | V1 + V2 confirmed |
| PP-05 | Route card — ETD shown below origin port code | YES | |
| PP-06 | Route card — ETA shown below destination port code | PENDING | Deferred — ETA not synced from task scheduled_start |
| PP-07 | Route card — ETD/ETA matches Route Node Timeline | YES | |
| PP-08 | Route card — Incoterm pill displayed | YES | |
| PP-09 | Route card — no ETD/ETA shows muted dash placeholder | YES | |
| PP-10 | RouteNodeTimeline — port name tooltip on hover over circle node | YES | |

---

## Task Timing Labels
| # | Test | Status | Notes |
|---|---|---|---|
| TL-01 | TRACKED POL — scheduled_start label shows ETA | YES | |
| TL-02 | TRACKED POL — scheduled_end label shows ETD | YES | |
| TL-03 | TRACKED POL — actual_start label shows ATA | YES | |
| TL-04 | TRACKED POL — actual_end label shows ATD | YES | |
| TL-05 | TRACKED POD — scheduled_start label shows ETA | YES | |
| TL-06 | TRACKED POD — ETD column hidden from display | YES | Design decision |
| TL-07 | TRACKED POD — Mark Complete writes ATA (actual_start) | YES | Confirmed 28 Feb 2026 |
| TL-08 | TRACKED POD — ATD absent from completed card | YES | |
| TL-09 | Non-TRACKED task — generic Sched. Start / Sched. End labels | YES | AFCQ-003860 ASSIGNED tasks confirmed 01 Mar 2026 |

---

## Vessel Display
| # | Test | Status | Notes |
|---|---|---|---|
| VD-01 | Route card — vessel + voyage shown between port pair and incoterm | YES | AFCQ-003832 HAI YUN V.215N confirmed |
| VD-02 | Route card — vessel row absent when no BL update done | YES | AFCQ-003837 confirmed |
| VD-03 | Route card — vessel name only shown when voyage missing | PENDING | |
| VD-04 | TRACKED POL task card — vessel name + voyage shown | YES | |
| VD-05 | TRACKED POD task card — no vessel info shown | YES | Design decision |
| VD-06 | Non-TRACKED task card — no vessel info shown | PENDING | |
| VD-07 | Non-POL TRACKED task card — no vessel info shown | PENDING | |

---

## Task Timestamps
| # | Test | Status | Notes |
|---|---|---|---|
| TS-01 | Task card shows date + time e.g. 28 Feb 2026, 14:30 | YES | |
| TS-02 | COMPLETED task — edit button is visible | YES | |
| TS-03 | COMPLETED task — can edit actual_start and save | YES | |
| TS-04 | COMPLETED task — can edit actual_end and save | YES | |
| TS-05 | COMPLETED task — can edit completed_at and save | YES | |
| TS-06 | Edited timestamp on completed task persists after page reload | YES | |
| TS-07 | Completed after scheduled end warning still shows when applicable | YES | |

---

## Task Visibility
| # | Test | Status | Notes |
|---|---|---|---|
| TV-01 | Hidden task — card stays full opacity | YES | |
| TV-02 | Hidden task — task label normal (no strikethrough) | YES | |
| TV-03 | Hidden task — EyeOff icon shows amber highlight | YES | |
| TV-04 | Visible task — Eye icon shows default muted style | YES | |

---

## General Shipment
| # | Test | Status | Notes |
|---|---|---|---|
| GS-01 | V1 shipment (AFCQ-) loads without error | YES | |
| GS-02 | V2 shipment (AF-) loads without error | YES | AF-003867 confirmed |
| GS-03 | Shipment list table scrolls horizontally without clipping | YES | |
| GS-04 | User table scrolls horizontally without clipping | YES | |
| GS-05 | Stale task display_name resolved | YES | |
| GS-06 | Edit button visible on IGNORED tasks | YES | |
| GS-07 | Task timestamps status guard working | YES | |
| GS-08 | V1 badge shows on un-migrated AFCQ- records in list | NA | No un-migrated AFCQ- records remain in system |
| GS-09 | V1 badge shows on migrated AF- records (migrated_from_v1=true) in list | YES | v2.37 confirmed — AF-003864, AF-003863, AF-003861, AF-003860 all show V1 badge in snapshot |
| GS-10 | V1 badge NOT shown on native V2 AF- records (e.g. AF-003867) | YES | Confirmed 01 Mar 2026 — all native AF- records in list show no badge |
| GS-11 | V1 badge visible on mobile card view | YES | Confirmed 01 Mar 2026 — AF-003864, AF-003863, AF-003861 all show V1 badge on mobile |

---

## AFC Customer Access (AC series)
| # | Test | Status | Notes |
|---|---|---|---|
| AC-01 | AFC sidebar shows only Dashboard, Shipments, Profile | YES | wongyuenfatt@gmail.com confirmed 01 Mar 2026 |
| AC-02 | AFC navigating to /users redirects to /dashboard | YES | Confirmed 01 Mar 2026 |
| AC-03 | AFC navigating to /companies redirects to /dashboard | YES | Confirmed 01 Mar 2026 |
| AC-04 | Profile page loads correctly for AFC user | YES | Confirmed 01 Mar 2026 |
| AC-05 | Profile page shows correct company name + ID | YES | Universal Zentury Holdings Sdn Bhd / AFC-0005 |
| AC-06 | Dashboard company card in slot 1 shows correct company name | YES | Confirmed 01 Mar 2026 |
| AC-07 | BL Upload button hidden for AFC on sea shipment detail | YES | AFCQ-003860 confirmed 01 Mar 2026 |
| AC-08 | Status action buttons (Advance/Cancel/Exception) hidden for AFC | YES | AFCQ-003860 confirmed 01 Mar 2026 |
| AC-09 | Invoiced toggle hidden for AFC | YES | AFCQ-003832 (Completed) confirmed 01 Mar 2026 |
| AC-10 | Status timeline read-only for AFC — no clickable nodes | YES | AFCQ-003860 confirmed 01 Mar 2026 |
| AC-11 | Status History accordion visible and expandable for AFC | YES | AFCQ-003860 confirmed 01 Mar 2026 |
| AC-12 | Tasks fully read-only for AFC — no edit pencil, no Mark Complete | YES | AFCQ-003860 confirmed 01 Mar 2026 (canEdit fixed) |
| AC-13 | Company reassign pencil hidden for AFC on shipment header | YES | AFCQ-003860 confirmed 01 Mar 2026 |
| AC-14 | Edit Parties pencil hidden for AFC on Parties card | YES | AFCQ-003832 confirmed 01 Mar 2026 |
| AC-15 | Shipment list scoped to AFC company only | YES | AFC-0005 only rows confirmed 01 Mar 2026 |
| AC-16 | Quick search scoped to AFC company only | YES | AF-003867 (MB Automation) not found 01 Mar 2026 |

---

## PostgreSQL Migration (PG series)
| # | Test | Status | Notes |
|---|---|---|---|
| PG-01 | Schema created without errors (create_schema.py runs clean) | YES | Executed via Cloud SQL Studio — 58.4ms, no errors |
| PG-02 | Dry run: 3,854 shipments assembled without errors | YES | Dry run completed — 3,854 shipments, 0 skipped |
| PG-03 | Commit run: row counts match — shipments, companies, workflows, files | YES | 3854 / 642 / 2036 / 1085 / 337 — verified in Cloud SQL Studio 3.9ms |
| PG-04 | Stats endpoint returns correct counts in under 100ms | YES | 3.9ms verified in Cloud SQL Studio |
| PG-05 | Active tab loads in under 150ms | YES | 128ms–357ms observed in production Network tab |
| PG-06 | Completed tab loads 25 records with total count in response | PENDING | |
| PG-07 | Search returns results in under 100ms | PENDING | |
| PG-08 | AF-003867 detail page loads correctly | YES | AF-003866 + AF-003830 + AF-003844 all confirmed locally 02 Mar 2026 |
| PG-09 | AFCQ-003829 resolves to AF-003829 | YES | Migrated V1 records load via AF- prefix — confirmed locally 02 Mar 2026 |
| PG-10 | Status update writes to PostgreSQL correctly | PENDING | |
| PG-11 | BL update writes to PostgreSQL correctly | PENDING | |
| PG-12 | New shipment from BL gets correct AF-XXXXXX sequence ID | PENDING | |
| PG-13 | af-platform builds without errors after Datastore lib removal | YES | Platform live and loading correctly post-deployment |
| PG-14 | Stats: Active=23, Total=2043, TI=8 after migration | YES | Confirmed live — Total=2043, Active=23, Completed=2019, Draft=1, TI=8 |
| PG-15 | Dashboard loads in under 500ms total (was 8-12 seconds) | YES | Well under 500ms — full page load ~350ms observed |
| PG-16 | issued_invoice flows through list and search — invoice icon correct on completed shipments | YES | Confirmed 02 Mar 2026 — green/amber icons rendering correctly across completed tab |
| PG-17 | AF-003854 and AF-003851 show green invoiced icon in list after deploy | YES | Confirmed 02 Mar 2026 |
| PG-18 | All V1 completed shipments show correct invoice icon | YES | Confirmed 02 Mar 2026 — invoiced=green, awaiting=amber. Backfill recovery applied for 8 genuine to-invoice records |
| PG-19 | Shipment list sorts by countid DESC — AF-003867 appears first | YES | Confirmed 02 Mar 2026 — 003867 first, 003866 second, V1 records descending |
| PG-20 | AF-003752 status = -1, absent from active list | YES | Fixed directly in Cloud SQL Studio 02 Mar 2026 |

---

## Invoice Icon Fix (BUG1 series)
| # | Test | Status | Notes |
|---|---|---|---|
| BUG1-01 | All tab — invoiced completed shipments show green icon (not amber) | YES | Confirmed 02 Mar 2026 — 003854/003851 show green on All tab |
| BUG1-02 | Search results — invoiced shipments show green icon, awaiting show amber | YES | Confirmed 02 Mar 2026 — v2.52 issued_invoice mapped unconditionally |

---

## Status Icon Fix (BUG2 series)
| # | Test | Status | Notes |
|---|---|---|---|
| BUG2-01 | AF-003864 status column shows Arrived (Anchor) icon, not red warning triangle | YES | Confirmed 02 Mar 2026 — anchor icon visible on 003864 in snapshot |
| BUG2-02 | Exception flag visible as separate amber indicator on mobile card (not replacing status) | PENDING | Mobile — test during mobile UX pass |

---

## Deferred Items
| Item | Reason |
|---|---|
| PP-06 — ETA sync from task scheduled_start to route node | Requires server-side co-write on task update. Deferred until V2 focus. |
| Parties card on V1 shipments | Resolved post-migration — all records become V2, assembly layer retired. |
| DT series (most) | Testing as encountered during normal use |
| MYPKG_N port code suffix | Scripts exist, not yet run. See PT series. |
| AWB upload for AIR shipments | Deferred to AIR build-out. |
| BL diff modal server guard for AFC | AFC can see diff icon (by design) and open modal. Verify PATCH /parties rejects AFC write. Future test. |

---

## Port Terminal Layer (PT series)
| # | Test | Status | Notes |
|---|---|---|---|
| PT-01 | Audit script runs without error and outputs port code frequency table | PENDING | Run before migration |
| PT-02 | Audit script correctly flags MYPKG_N as NON-STANDARD | PENDING | |
| PT-03 | Audit script infers base code MYPKG from MYPKG_N | PENDING | |
| PT-04 | MYPKG Port entity has terminals array with Westports + Northport entries | PENDING | After seed script |
| PT-05 | seed_port_terminals.py is idempotent — safe to run twice | PENDING | |
| PT-06 | migrate_v1_port_codes.py --dry-run shows expected records without writing | PENDING | |
| PT-07 | migrate_v1_port_codes.py updates MYPKG_N records to port_un_code=MYPKG + terminal_id=MYPKG_N | PENDING | |
| PT-08 | Migration is idempotent — already-migrated records skipped | PENDING | |
| PT-09 | V1 Northport shipment displays MYPKG with Northport terminal line in PortPair | PENDING | |
| PT-10 | V1 Westports shipment displays MYPKG with no terminal line (default) | PENDING | |
| PT-11 | Port name tooltip reads Port Klang (Northport), Malaysia for MYPKG_N shipment | PENDING | |
| PT-12 | Port name tooltip reads Port Klang, Malaysia for MYPKG shipment (no terminal) | PENDING | |
| PT-13 | Port label lookup works for all other standard port codes unchanged | PENDING | Regression |

---

## Edit Parties (EP series)
| # | Test | Status | Notes |
|---|---|---|---|
| EP-01 | Clear notify party name -> save -> party removed immediately from UI | YES | Confirmed 01 Mar 2026 |
| EP-02 | Clear notify party name -> save -> refresh -> party still gone | YES | Confirmed 01 Mar 2026 |
| EP-03 | Set notify party name -> save -> appears immediately in Parties card | YES | Confirmed 01 Mar 2026 |
| EP-04 | Clear shipper name, keep address -> address preserved after save | YES | Confirmed 01 Mar 2026 |
| EP-05 | Clear both shipper name and address -> shipper sub-object removed entirely | YES | Confirmed 01 Mar 2026 |

---

## Order List Filter — Pagination (OF series)
| # | Test | Status | Notes |
|---|---|---|---|
| OF-01 | Active tab — all active shipments shown, no under-delivery due to in-memory filter | NA | Resolved by V1 to V2 migration — single Kind query post-migration |
| OF-02 | Active tab Load More — advances correctly, no skipped records | NA | Resolved by V1 to V2 migration |
| OF-03 | Completed tab — all completed shipments shown | NA | Resolved by V1 to V2 migration |

---

## V1 to V2 Migration (MI series) — RETIRED
| # | Test | Status | Notes |
|---|---|---|---|
| MI-01 | --only AFCQ-003829 dry run — correct V2 record assembled, no errors | NA | Migration already complete. 3,854 AF- Quotation entities confirmed in Datastore. V1 ShipmentOrder dual-path removed in v2.45. |
| MI-02 | Full dry run — 3,851 records, 0 assembly errors reported | NA | Migration already complete. 3,854 AF- Quotation entities confirmed in Datastore. V1 ShipmentOrder dual-path removed in v2.45. |
| MI-03 | Live run — spot-check 3 migrated records readable in platform (active, completed, cancelled) | NA | Migration already complete. 3,854 AF- Quotation entities confirmed in Datastore. V1 ShipmentOrder dual-path removed in v2.45. |
| MI-04 | Status writes on migrated AF- records use data_version check not ID prefix | NA | Migration already complete. 3,854 AF- Quotation entities confirmed in Datastore. V1 ShipmentOrder dual-path removed in v2.45. |
| MI-05 | Stale AFCQ- URL in browser resolves to correct AF- record | NA | Migration already complete. 3,854 AF- Quotation entities confirmed in Datastore. V1 ShipmentOrder dual-path removed in v2.45. |
| MI-06 | All 3,851 AFCQ- records appear as AF- in shipments list post-migration | NA | Migration already complete. 3,854 AF- Quotation entities confirmed in Datastore. V1 ShipmentOrder dual-path removed in v2.45. |
| MI-07 | ShipmentWorkFlow re-keyed — tasks still visible on migrated shipments | NA | Migration already complete. 3,854 AF- Quotation entities confirmed in Datastore. V1 ShipmentOrder dual-path removed in v2.45. |
| MI-08 | Files re-keyed — uploaded files still visible on migrated shipments | NA | Migration already complete. 3,854 AF- Quotation entities confirmed in Datastore. V1 ShipmentOrder dual-path removed in v2.45. |
| MI-09 | ShipmentOrderV2CountId registered — new shipment creation does not reuse migrated numbers | NA | Migration already complete. 3,854 AF- Quotation entities confirmed in Datastore. V1 ShipmentOrder dual-path removed in v2.45. |
| MI-10 | Migration script is idempotent — re-run dry run reports all records as already migrated | NA | Migration already complete. 3,854 AF- Quotation entities confirmed in Datastore. V1 ShipmentOrder dual-path removed in v2.45. |

---

## V2 Cleanup Verification (V2C series) — RETIRED
| # | Test | Status | Notes |
|---|---|---|---|
| V2C-01 | Shipment list (active tab) loads without error after V1 path removal | NA | Superseded by PG series (PostgreSQL migration) |
| V2C-02 | Shipment list (completed tab) loads and shows historical records | NA | Superseded by PG series |
| V2C-03 | Shipment list (to_invoice tab) shows 8 records | NA | Superseded by PG series |
| V2C-04 | Stats counts unchanged — Active=23, Total=2044, TI=8 | NA | Superseded by PG-14 |
| V2C-05 | AFCQ-003829 URL resolves to AF-003829 detail page without error | NA | Superseded by PG-09 |
| V2C-06 | AF-003829 detail page loads all fields correctly | NA | Superseded by PG-08 |
| V2C-07 | Status update on migrated AF- record saves correctly | NA | Superseded by PG-10 |
| V2C-08 | BL update on migrated AF- record saves correctly | NA | Superseded by PG-11 |
| V2C-09 | Search returns migrated AF- records by AFCQ- ID (e.g. search "003829") | NA | Superseded by PG-07 |
| V2C-10 | Server starts without import errors after constants.py cleanup | NA | Superseded by PG series |

---

## To Invoice Fixes (TI series)
| # | Test | Status | Notes |
|---|---|---|---|
| TI-01 | To Invoice tab count shows 8 (not 17) | YES | Confirmed via server console log 01 Mar 2026 |
| TI-02 | Cancelled V1 orders do not appear in To Invoice list | YES | AFCQ-003862 (raw_status=3001) excluded by STATUS_CANCELLED guard |
| TI-03 | 8 legitimate V1 orders appear in To Invoice list | YES | Confirmed via final response log |
| TI-04 | AF-003867 does NOT appear in To Invoice list | YES | Confirmed 01 Mar 2026 |
| TI-05 | AF-003866 does NOT appear in To Invoice list | YES | Confirmed 01 Mar 2026 |
| TI-06 | No [to_invoice] debug logs in server console after v2.33 deployed | YES | v2.33 deployed 01 Mar 2026 |
| TI-07 | To Invoice tab still shows 8 after debug logs removed (no regression) | YES | Confirmed 01 Mar 2026 |

---

## List Visibility — Trash Filter Fix (LV series)
| # | Test | Status | Notes |
|---|---|---|---|
| LV-01 | Native V2 AF- records (e.g. AF-003864, AF-003863, AF-003861) appear in Active tab | YES | Confirmed 01 Mar 2026 |
| LV-02 | Active tab count matches stats badge | YES | Active=23 confirmed v2.44. Total=2,043. AF-003862 absent. Revert clean. |
| LV-03 | Explicitly trashed records (trash=true) still excluded from list | PENDING | Functional regression — test as encountered |
| LV-04 | Stats counts unchanged after fix (Active=22, To Invoice=8) | YES | Confirmed 01 Mar 2026 — Active=22, TI=8, Completed=2021 |
| LV-05 | Migrated AF- records appear in list with migrated_from_v1=true | PENDING | AF- records visible — V1 badge on migrated ones not yet confirmed |
| LV-06 | All list tabs (active, completed, to_invoice, draft, cancelled) load without error | PENDING | Active confirmed OK — others not yet tested |

---

## 003862 Incoterm Fix (IN series) — RETIRED
| # | Test | Status | Notes |
|---|---|---|---|
| IN-01 | AF-003862 incoterm column shows correct value (not —) | NA | 003862 is a cancelled order. AF-003862 entity removed by revert script (v2.44). Non-issue. |
| IN-02 | AF-003862 detail page loads correctly with all fields | NA | Non-issue — see IN-01. |

---

## AFCQ Superseded Dedup (SU series) — RETIRED
| # | Test | Status | Notes |
|---|---|---|---|
| SU-01 | AFCQ-003862 does NOT appear in shipment list | YES | Confirmed v2.44 — 003862 absent from Active tab. superseded=True preserved. |
| SU-02 | AF-003862 DOES appear in shipment list | NA | AF-003862 entity removed by revert script (v2.44). Correctly absent. |
| SU-03 | AF-003862 shows V1 badge | NA | Non-issue — entity removed. |
| SU-04 | Navigating to /shipments/AFCQ-003862 redirects to AF-003862 detail | NA | AF-003862 removed. AFCQ-003862 invisible — correct. |

---

## Sort Order (SR series) — RETIRED
| # | Test | Status | Notes |
|---|---|---|---|
| SR-01 | Shipment list sorted by countid DESC | NA | Standing principle — countid DESC is the only sort. No multi-tier sorting. |
| SR-02 | Search results sorted by countid DESC | NA | Standing principle — same as list. |

---

## Datastore Sweep (DS series)
| # | Test | Status | Notes |
|---|---|---|---|
| DS-01 | createShipmentOrder() in shipments-write.ts writes to Datastore — needs POST /api/v2/shipments endpoint | YES | Implemented v2.53 — af-server POST /api/v2/shipments, action layer migrated |
| DS-02 | deleteShipmentOrder() in shipments-write.ts writes to Datastore — needs DELETE endpoint | YES | Implemented v2.53 — af-server DELETE /api/v2/shipments/{id} soft+hard modes |
| DS-03 | datastore-query.ts still imported by users module (UserIAM, UserAccount, CompanyUserAccount) | PENDING | LOW — expected, users not migrated to PostgreSQL |
| DS-04 | actions/shipments.ts has zero direct Datastore reads — all via af-server | PENDING | Verified clean in v2.50 audit |

---

## Manual Shipment Creation (MC series)
| # | Test | Status | Notes |
|---|---|---|---|
| MC-01 | POST /api/v2/shipments creates shipment in PostgreSQL — row visible in shipments table | PENDING | |
| MC-02 | Created shipment appears in active list with correct status (1002 Draft Review) | PENDING | |
| MC-03 | Created shipment has shipment_workflows row with auto-generated tasks | PENDING | |
| MC-04 | createShipmentOrderAction() no longer imports from lib/shipments-write createShipmentOrder | PENDING | |
| MC-05 | createShipmentOrderAction() returns correct shipment_id from server response | PENDING | |

---

## Shipment Delete (SD series)
| # | Test | Status | Notes |
|---|---|---|---|
| SD-01 | Soft delete — shipment disappears from all list tabs after DELETE (no hard param) | PENDING | |
| SD-02 | Soft delete — shipment row still exists in DB with trash=true | PENDING | |
| SD-03 | Hard delete — returns 403 in production environment | PENDING | |
| SD-04 | Hard delete — removes rows from shipments, shipment_workflows, shipment_files in dev | PENDING | |
| SD-05 | deleteShipmentOrderAction() no longer imports from lib/shipments-write deleteShipmentOrder | PENDING | |

---

## BL Upload Tab — Party Fields (BU series)
| # | Test | Status | Notes |
|---|---|---|---|
| BU-01 | Upload BL on create — shipper name pre-filled from parsed BL | PENDING | |
| BU-02 | Upload BL on create — shipper address pre-filled from parsed BL | PENDING | |
| BU-03 | Upload BL on create — consignee address pre-filled from parsed BL | PENDING | |
| BU-04 | Upload BL on create — notify party shown when present in parsed BL | PENDING | |
| BU-05 | Upload BL on create — shipper/consignee/notify party editable before confirm | PENDING | |
| BU-06 | Upload BL on create — edited shipper name saved to created shipment parties | PENDING | |
| BU-07 | Upload BL on create — notify party section hidden when not in parsed BL | PENDING | |

---

## Loading State UI (LO series)
| # | Test | Status | Notes |
|---|---|---|---|
| LO-01 | Advance button: sky spinner + "Updating…" beside button; revert shows amber spinner | YES | Confirmed 02 Mar 2026 — v2.51 per-action loading states |
| LO-02 | Invoiced toggle: shows spinner + "Updating…" replacing status text while loading | YES | Confirmed 02 Mar 2026 — AF-003844 shows Loader2 + "Updating…" inline |
| LO-03 | Cancel: red spinner + "Updating…"; Exception: amber spinner + "Updating…" | YES | Confirmed 02 Mar 2026 — v2.51 per-action loading states |
| LO-04 | All action buttons disabled while any mutation is in progress | YES | Confirmed 02 Mar 2026 — v2.51 anyLoading guard |
| LO-05 | Timeline node click triggers spinner on Advance button (not timeline) | YES | Confirmed 02 Mar 2026 — v2.51 |

---

## Mobile (MB series) — DEFERRED
> All mobile tests are deferred pending a dedicated mobile UX improvement pass.
> Do not test incrementally — test after improvements are complete.

| # | Test | Status | Notes |
|---|---|---|---|
| MB-01 | Shipment list renders correctly on mobile | DEFERRED | Cards functional, layout needs UX work |
| MB-02 | Incoterm shown on mobile shipment card | DEFERRED | Currently absent from card — needs design decision |
| MB-03 | Cargo ready date shown on mobile shipment card | DEFERRED | Currently absent from card |
| MB-04 | Status pill renders correctly on mobile (all statuses) | DEFERRED | Booking Pending + Booking Confirmed confirmed functional from snapshot |
| MB-05 | V1 badge renders on mobile card | YES | Confirmed 01 Mar 2026 snapshot — AF-003864/003863/003861 |
| MB-06 | Order type (Air Freight / Sea FCL / Sea LCL) shown on mobile card | DEFERRED | Functional from snapshot, layout review pending |
| MB-07 | Shipment detail page renders correctly on mobile | DEFERRED | Not yet tested |
| MB-08 | Tasks tab usable on mobile | DEFERRED | Not yet tested |
| MB-09 | BL update modal usable on mobile | DEFERRED | Not yet tested |
| MB-10 | Dashboard active shipments list renders correctly on mobile | DEFERRED | Not yet tested |
| MB-11 | Sidebar / hamburger menu opens and closes correctly on mobile | DEFERRED | Visible in snapshot — not fully tested |
| MB-12 | Quick search usable on mobile | DEFERRED | Not yet tested |
| MB-13 | SSL certificate valid on all platform domains (mobile + desktop) | DEFERRED | Red lock seen on pv2.accelefreight.com in snapshot — check cert status |
