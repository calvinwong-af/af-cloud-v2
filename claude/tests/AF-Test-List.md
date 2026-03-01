# AF Platform — Test List
**Version:** 2.12
**Last Updated:** 01 March 2026

## Version History
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
| GS-11 | V1 badge visible on mobile card view | PENDING | GS-09 resolved — needs mobile visual confirmation |

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

## V1 to V2 Migration (MI series)
| # | Test | Status | Notes |
|---|---|---|---|
| MI-01 | --only AFCQ-003829 dry run — correct V2 record assembled, no errors | PENDING | First validation step |
| MI-02 | Full dry run — 3,851 records, 0 assembly errors reported | PENDING | |
| MI-03 | Live run — spot-check 3 migrated records readable in platform (active, completed, cancelled) | PENDING | |
| MI-04 | Status writes on migrated AF- records use data_version check not ID prefix | PENDING | |
| MI-05 | Stale AFCQ- URL in browser resolves to correct AF- record | PENDING | |
| MI-06 | All 3,851 AFCQ- records appear as AF- in shipments list post-migration | PENDING | |
| MI-07 | ShipmentWorkFlow re-keyed — tasks still visible on migrated shipments | PENDING | |
| MI-08 | Files re-keyed — uploaded files still visible on migrated shipments | PENDING | |
| MI-09 | ShipmentOrderV2CountId registered — new shipment creation does not reuse migrated numbers | PENDING | |
| MI-10 | Migration script is idempotent — re-run dry run reports all records as already migrated | PENDING | |

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
| LV-02 | Active tab count matches stats badge | NO | v2.37: badge still 23, 003866+003867 both active in list. Off by 1 — open issue persists |
| LV-03 | Explicitly trashed records (trash=true) still excluded from list | PENDING | Functional regression — test as encountered |
| LV-04 | Stats counts unchanged after fix (Active=22, To Invoice=8) | YES | Confirmed 01 Mar 2026 — Active=22, TI=8, Completed=2021 |
| LV-05 | Migrated AF- records appear in list with migrated_from_v1=true | PENDING | AF- records visible — V1 badge on migrated ones not yet confirmed |
| LV-06 | All list tabs (active, completed, to_invoice, draft, cancelled) load without error | PENDING | Active confirmed OK — others not yet tested |

---

## AFCQ Superseded Dedup (SU series)
| # | Test | Status | Notes |
|---|---|---|---|
| SU-01 | AFCQ-003862 does NOT appear in shipment list | PENDING | Script reported already-superseded on run. Needs list verification. |
| SU-02 | AF-003862 DOES appear in shipment list | PENDING | Cannot confirm until SU-01 resolved |
| SU-03 | AF-003862 shows V1 badge | PENDING | v2.34 — migrated_from_v1=true |
| SU-04 | Navigating to /shipments/AFCQ-003862 redirects to AF-003862 detail | PENDING | Existing server redirect logic |
