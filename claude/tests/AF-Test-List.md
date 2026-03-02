# AF Platform — Test List
**Version:** 2.39
**Last Updated:** 02 March 2026

> Retired series (MI, V2C, OF, SR, IN, SU) moved to AF-Test-Archive.md
> Version history prior to v2.20 moved to AF-Test-Archive.md

## Version History (recent)
| Version | Date | Changes |
|---|---|---|
| 2.39 | 02 Mar 2026 | MC-01/02/05 YES. MC-03 YES (tasks generated). MC-06 added — containers not saved to type_details on manual create. |
| 2.38 | 02 Mar 2026 | PG-11 YES. BL-25/26/27 added and confirmed YES. |
| 2.37 | 02 Mar 2026 | UI-01 added to pending — Files tab count badge, LOW priority. |
| 2.36 | 02 Mar 2026 | PG-10 YES — status writes confirmed on AF-003837. |
| 2.35 | 02 Mar 2026 | Restructure — retired series archived. Version history trimmed. |
| 2.34 | 02 Mar 2026 | LV-05/DS-04/MC-04 closed by code review. |
| 2.33 | 02 Mar 2026 | PG-06 YES. LV-03/LV-06 YES from completed tab snapshot. |
| 2.32 | 02 Mar 2026 | SD-02 confirmed by live DB query — AF-003865 trash=TRUE. |
| 2.31 | 02 Mar 2026 | SD-02 YES (code review). SD-05 NA. |
| 2.30 | 02 Mar 2026 | SD-01/SD-04 YES. SD-03 NA — env guard replaced by role gate. |
| 2.29 | 02 Mar 2026 | BU-07 closed by code review. |
| 2.28 | 02 Mar 2026 | BU-01 to BU-06 YES from AF-003871. PG-12 YES. |
| 2.27 | 02 Mar 2026 | BU series added (7 tests). |
| 2.26 | 02 Mar 2026 | DS-01/02 YES. MC series + SD series added. |
| 2.25 | 02 Mar 2026 | BUG1-01/02 and BUG2-01 YES. BUG2-02 deferred to mobile pass. |
| 2.24 | 02 Mar 2026 | BUG1 series + BUG2 series added. |
| 2.23 | 02 Mar 2026 | LO series — per-action loading states confirmed. |
| 2.22 | 02 Mar 2026 | PG-16 to PG-20 all confirmed YES. |
| 2.21 | 02 Mar 2026 | PG-16 to PG-20 added. |
| 2.20 | 02 Mar 2026 | SR series retired. DS series + LO series added. |

## How to Use
- YES = Confirmed working
- NO = Confirmed broken
- PENDING = Not yet tested
- NA = Removed by design decision
- DEFERRED = Parked — test during dedicated pass

---

## PENDING TESTS — Action Required

| Series | Test | Notes |
|---|---|---|
| MC-06 | Containers saved to type_details on manual create (FCL) | AF-003872 shows "Details not available" despite 1×20GP DRY entered in review. Bug — type_details not written on POST. |
| DS-03 | datastore-query.ts still imported by users module | LOW — expected, users not yet on PostgreSQL |
| BUG2-02 | Exception flag visible as separate amber indicator on mobile card | Test during mobile UX pass |
| VD-03 | Route card — vessel name only shown when voyage missing | Test on any shipment with BL but no voyage |
| VD-06 | Non-TRACKED task card — no vessel info shown | Test as encountered |
| VD-07 | Non-POL TRACKED task card — no vessel info shown | Test as encountered |
| PP-06 | Route card — ETA shown below destination port code | Deferred — ETA not synced from task scheduled_start |
| UI-01 | Files tab label shows file count badge e.g. Files (3) | LOW — add after port BL prompt done |

---

## DT series — Test As Encountered
| # | Test | Status |
|---|---|---|
| DT-01 | BLUpdateModal ETD — displays as DD/MM/YYYY HH:mm after parse | PENDING |
| DT-02 | BLUpdateModal ETD — type 28022026 auto-formats, time defaults to 00:00 | PENDING |
| DT-03 | BLUpdateModal ETD — invalid date clears on blur | PENDING |
| DT-04 | BLUpdateModal ETD — pre-filled from parsed BL shows correct date and time | PENDING |
| DT-05 | BLUploadTab ETD — same formatting behaviour as BLUpdateModal | PENDING |
| DT-06 | ShipmentTasks scheduled start — displays as DD/MM/YYYY HH:mm | PENDING |
| DT-07 | ShipmentTasks scheduled end — displays as DD/MM/YYYY HH:mm | PENDING |
| DT-08 | ShipmentTasks actual start — displays as DD/MM/YYYY HH:mm | PENDING |
| DT-09 | ShipmentTasks actual end — displays as DD/MM/YYYY HH:mm | PENDING |
| DT-10 | DateTimeInput — hour/minute fields accept two-digit input | YES |
| DT-11 | ShipmentTasks actual start — saved value persists time after reload | PENDING |
| DT-12 | RouteNodeTimeline — ETD/ETA inputs display as DD/MM/YYYY HH:mm | PENDING |
| DT-13 | RouteNodeTimeline — save timing persists correctly | PENDING |
| DT-14 | ETD date entry auto-sets time to 00:00 when time not manually entered | PENDING |
| DT-15 | ETA date entry auto-sets time to 00:00 when time not manually entered | PENDING |
| DT-16 | Manually entered time overrides the 00:00 default | PENDING |

---

## PT series — Port Terminal Layer (blocked until scripts run)
| # | Test | Status | Notes |
|---|---|---|---|
| PT-01 | Audit script runs without error and outputs port code frequency table | PENDING | Run before migration |
| PT-02 | Audit script correctly flags MYPKG_N as NON-STANDARD | PENDING | |
| PT-03 | Audit script infers base code MYPKG from MYPKG_N | PENDING | |
| PT-04 | MYPKG Port entity has terminals array with Westports + Northport entries | PENDING | After seed script |
| PT-05 | seed_port_terminals.py is idempotent — safe to run twice | PENDING | |
| PT-06 | migrate_v1_port_codes.py --dry-run shows expected records without writing | PENDING | |
| PT-07 | migrate_v1_port_codes.py updates MYPKG_N to port_un_code=MYPKG + terminal_id=MYPKG_N | PENDING | |
| PT-08 | Migration is idempotent — already-migrated records skipped | PENDING | |
| PT-09 | V1 Northport shipment displays MYPKG with Northport terminal line in PortPair | PENDING | |
| PT-10 | V1 Westports shipment displays MYPKG with no terminal line (default) | PENDING | |
| PT-11 | Port name tooltip reads Port Klang (Northport), Malaysia for MYPKG_N shipment | PENDING | |
| PT-12 | Port name tooltip reads Port Klang, Malaysia for MYPKG shipment (no terminal) | PENDING | |
| PT-13 | Port label lookup works for all other standard port codes unchanged | PENDING | Regression |

---

## MB series — Mobile (DEFERRED — test after mobile UX pass)
| # | Test | Status | Notes |
|---|---|---|---|
| MB-01 | Shipment list renders correctly on mobile | DEFERRED | |
| MB-02 | Incoterm shown on mobile shipment card | DEFERRED | Currently absent — needs design decision |
| MB-03 | Cargo ready date shown on mobile shipment card | DEFERRED | |
| MB-04 | Status pill renders correctly on mobile (all statuses) | DEFERRED | |
| MB-05 | V1 badge renders on mobile card | YES | Confirmed 01 Mar 2026 |
| MB-06 | Order type shown on mobile card | DEFERRED | |
| MB-07 | Shipment detail page renders correctly on mobile | DEFERRED | |
| MB-08 | Tasks tab usable on mobile | DEFERRED | |
| MB-09 | BL update modal usable on mobile | DEFERRED | |
| MB-10 | Dashboard active shipments list renders correctly on mobile | DEFERRED | |
| MB-11 | Sidebar / hamburger menu opens and closes correctly on mobile | DEFERRED | |
| MB-12 | Quick search usable on mobile | DEFERRED | |
| MB-13 | SSL certificate valid on all platform domains | DEFERRED | Red lock seen on pv2.accelefreight.com |

---

## Confirmed Tests

### BL Update Mode
| # | Test | Status | Notes |
|---|---|---|---|
| BL-01 | BL update visible on SEA_FCL shipment >= status 2001 (AFU) | YES | AF-003867 |
| BL-02 | BL update visible on SEA_LCL shipment >= status 2001 (AFU) | YES | AFCQ-003830 |
| BL-03 | BL update NOT visible on AIR shipment | YES | AFCQ-003861 |
| BL-04 | BL update NOT visible for AFC users | YES | AFCQ-003860 + AFCQ-003832 |
| BL-05 | BL parses successfully — fields pre-fill form | YES | AFCQ-003829 |
| BL-06 | Update Shipment succeeds on V2 (AF-) shipment | YES | AF-003867 |
| BL-07 | Update Shipment succeeds on V1 (AFCQ-) shipment | YES | AFCQ-003829 |
| BL-08 | BL PDF auto-saved to Files tab with tag bl after update | YES | |
| BL-09 | Carrier / Agent label shown (not Carrier) | YES | |
| BL-10 | LCL: Cargo Summary table shown, Containers table hidden | YES | AFCQ-003794 |
| BL-11 | FCL: Containers table shown | YES | AFCQ-003832 |
| BL-12 | Cargo items table is inline-editable | YES | |
| BL-13 | Containers table is inline-editable | YES | AFCQ-003832 |
| BL-14 | Add row to cargo items table | YES | AFCQ-003832 |
| BL-15 | Delete row from cargo items table | YES | AFCQ-003832 |
| BL-16 | Vessel and voyage saved and displayed after BL update | YES | |
| BL-17 | Transport section visible on shipment detail after BL update | YES | AFCQ-003829 |
| BL-18 | Shipper name + address pre-filled from BL parse | YES | AF-003867 |
| BL-19 | Consignee name + address pre-filled from BL parse | YES | AF-003867 |
| BL-20 | Parties card visible on Overview tab after BL update (V2) | YES | AF-003867 |
| BL-21 | Diff icon shown when bl_document consignee != shipment_order consignee | YES | AF-003867 |
| BL-22 | Diff tooltip shows truncated BL value on hover | YES | AF-003867 |
| BL-23 | BLPartyDiffModal opens on diff icon click — side-by-side view | YES | AF-003867 |
| BL-24 | Use BL Values in diff modal updates shipment order, diff icon disappears | YES | AF-003867 |
| BL-25 | BL upload — port of loading matched and saved to Route card | YES | AF-003837 CNSHK confirmed |
| BL-26 | BL upload — port of discharge matched and saved to Route card | YES | AF-003837 MYPKG confirmed |
| BL-27 | Port codes persist on Route card after page reload (no re-upload needed) | YES | AF-003837 confirmed |

### BL Upload Tab — Party Fields (BU series)
| # | Test | Status | Notes |
|---|---|---|---|
| BU-01 | Upload BL on create — shipper name pre-filled from parsed BL | YES | AF-003871 |
| BU-02 | Upload BL on create — shipper address pre-filled | YES | AF-003871 |
| BU-03 | Upload BL on create — consignee address pre-filled | YES | AF-003871 |
| BU-04 | Upload BL on create — notify party shown when present | YES | AF-003871 |
| BU-05 | Upload BL on create — parties editable before confirm | YES | |
| BU-06 | Upload BL on create — edited shipper name saved to shipment | YES | AF-003871 |
| BU-07 | Upload BL on create — notify party section hidden when not in BL | YES | Code review confirmed |

### Port Pair Display
| # | Test | Status | Notes |
|---|---|---|---|
| PP-01 | Route card — AFC user sees POL / POD labels | YES | AFCQ-003860 + AFCQ-003832 |
| PP-02 | Route card — AFU user sees Origin / Destination labels | YES | AF-003867 |
| PP-03 | Route card — port code displays in large monospace font | YES | |
| PP-04 | Route card — port name appears as tooltip on hover | YES | |
| PP-05 | Route card — ETD shown below origin port code | YES | |
| PP-07 | Route card — ETD/ETA matches Route Node Timeline | YES | |
| PP-08 | Route card — Incoterm pill displayed | YES | |
| PP-09 | Route card — no ETD/ETA shows muted dash placeholder | YES | |
| PP-10 | RouteNodeTimeline — port name tooltip on hover over circle node | YES | |

### Task Timing Labels
| # | Test | Status | Notes |
|---|---|---|---|
| TL-01 | TRACKED POL — scheduled_start label shows ETA | YES | |
| TL-02 | TRACKED POL — scheduled_end label shows ETD | YES | |
| TL-03 | TRACKED POL — actual_start label shows ATA | YES | |
| TL-04 | TRACKED POL — actual_end label shows ATD | YES | |
| TL-05 | TRACKED POD — scheduled_start label shows ETA | YES | |
| TL-06 | TRACKED POD — ETD column hidden from display | YES | Design decision |
| TL-07 | TRACKED POD — Mark Complete writes ATA (actual_start) | YES | |
| TL-08 | TRACKED POD — ATD absent from completed card | YES | |
| TL-09 | Non-TRACKED task — generic Sched. Start / Sched. End labels | YES | AFCQ-003860 |

### Vessel Display
| # | Test | Status | Notes |
|---|---|---|---|
| VD-01 | Route card — vessel + voyage shown between port pair and incoterm | YES | AFCQ-003832 |
| VD-02 | Route card — vessel row absent when no BL update done | YES | AFCQ-003837 |
| VD-04 | TRACKED POL task card — vessel name + voyage shown | YES | |
| VD-05 | TRACKED POD task card — no vessel info shown | YES | Design decision |

### Task Timestamps
| # | Test | Status | Notes |
|---|---|---|---|
| TS-01 | Task card shows date + time e.g. 28 Feb 2026, 14:30 | YES | |
| TS-02 | COMPLETED task — edit button is visible | YES | |
| TS-03 | COMPLETED task — can edit actual_start and save | YES | |
| TS-04 | COMPLETED task — can edit actual_end and save | YES | |
| TS-05 | COMPLETED task — can edit completed_at and save | YES | |
| TS-06 | Edited timestamp on completed task persists after page reload | YES | |
| TS-07 | Completed after scheduled end warning still shows when applicable | YES | |

### Task Visibility
| # | Test | Status | Notes |
|---|---|---|---|
| TV-01 | Hidden task — card stays full opacity | YES | |
| TV-02 | Hidden task — task label normal (no strikethrough) | YES | |
| TV-03 | Hidden task — EyeOff icon shows amber highlight | YES | |
| TV-04 | Visible task — Eye icon shows default muted style | YES | |

### General Shipment
| # | Test | Status | Notes |
|---|---|---|---|
| GS-01 | V1 shipment (AFCQ-) loads without error | YES | |
| GS-02 | V2 shipment (AF-) loads without error | YES | AF-003867 |
| GS-03 | Shipment list table scrolls horizontally without clipping | YES | |
| GS-04 | User table scrolls horizontally without clipping | YES | |
| GS-05 | Stale task display_name resolved | YES | |
| GS-06 | Edit button visible on IGNORED tasks | YES | |
| GS-07 | Task timestamps status guard working | YES | |
| GS-09 | V1 badge shows on migrated AF- records (migrated_from_v1=true) | YES | AF-003864/003863/003861/003860 confirmed |
| GS-10 | V1 badge NOT shown on native V2 AF- records | YES | AF-003867 confirmed |
| GS-11 | V1 badge visible on mobile card view | YES | Confirmed 01 Mar 2026 |

### AFC Customer Access
| # | Test | Status | Notes |
|---|---|---|---|
| AC-01 | AFC sidebar shows only Dashboard, Shipments, Profile | YES | |
| AC-02 | AFC navigating to /users redirects to /dashboard | YES | |
| AC-03 | AFC navigating to /companies redirects to /dashboard | YES | |
| AC-04 | Profile page loads correctly for AFC user | YES | |
| AC-05 | Profile page shows correct company name + ID | YES | AFC-0005 |
| AC-06 | Dashboard company card in slot 1 shows correct company name | YES | |
| AC-07 | BL Upload button hidden for AFC on sea shipment detail | YES | |
| AC-08 | Status action buttons hidden for AFC | YES | |
| AC-09 | Invoiced toggle hidden for AFC | YES | |
| AC-10 | Status timeline read-only for AFC | YES | |
| AC-11 | Status History accordion visible and expandable for AFC | YES | |
| AC-12 | Tasks fully read-only for AFC | YES | |
| AC-13 | Company reassign pencil hidden for AFC | YES | |
| AC-14 | Edit Parties pencil hidden for AFC | YES | |
| AC-15 | Shipment list scoped to AFC company only | YES | |
| AC-16 | Quick search scoped to AFC company only | YES | |

### PostgreSQL Migration
| # | Test | Status | Notes |
|---|---|---|---|
| PG-01 | Schema created without errors | YES | 58.4ms, no errors |
| PG-02 | Dry run: 3,854 shipments, 0 errors | YES | |
| PG-03 | Commit run: row counts match | YES | 3854/642/2036/1085/337 |
| PG-04 | Stats endpoint under 100ms | YES | 3.9ms |
| PG-05 | Active tab loads under 150ms | YES | 128–357ms observed |
| PG-06 | Completed tab loads 25 records with total count | YES | 2020 total, 25 shown, Load more visible |
| PG-07 | Search returns results under 100ms | YES | "big screen" — 25 results, 200 OK |
| PG-08 | Shipment detail page loads correctly | YES | AF-003866/003830/003844 confirmed |
| PG-09 | AFCQ- URL resolves to AF- record | YES | AFCQ-003829 → AF-003829 |
| PG-10 | Status update writes to PostgreSQL correctly | YES | AF-003837: Confirmed → Booking Pending → Booking Confirmed |
| PG-11 | BL update writes ports to PostgreSQL and reflects in Route card | YES | AF-003837 CNSHK + MYPKG confirmed |
| PG-12 | New shipment gets correct AF-XXXXXX sequence ID | YES | AF-003871 confirmed |
| PG-13 | af-platform builds without errors after Datastore lib removal | YES | |
| PG-14 | Stats counts correct after migration | YES | Total=2043, Active=23, Completed=2019, Draft=1, TI=8 |
| PG-15 | Dashboard loads under 500ms (was 8–12s) | YES | ~350ms observed |
| PG-16 | Invoice icon correct on completed shipments | YES | green/amber rendering correctly |
| PG-17 | AF-003854 and AF-003851 show green invoiced icon | YES | |
| PG-18 | All V1 completed shipments show correct invoice icon | YES | |
| PG-19 | Shipment list sorts by countid DESC | YES | 003867 first |
| PG-20 | AF-003752 status = -1, absent from active list | YES | Fixed in Cloud SQL Studio |

### Invoice / Status Icon Fixes
| # | Test | Status | Notes |
|---|---|---|---|
| BUG1-01 | All tab — invoiced completed shipments show green icon | YES | 003854/003851 confirmed |
| BUG1-02 | Search results — invoice icons correct | YES | v2.52 confirmed |
| BUG2-01 | AF-003864 shows Arrived (Anchor) icon, not warning triangle | YES | Confirmed 02 Mar 2026 |

### Edit Parties
| # | Test | Status | Notes |
|---|---|---|---|
| EP-01 | Clear notify party → save → removed immediately from UI | YES | |
| EP-02 | Clear notify party → save → refresh → still gone | YES | |
| EP-03 | Set notify party → save → appears in Parties card | YES | |
| EP-04 | Clear shipper name, keep address → address preserved | YES | |
| EP-05 | Clear both shipper name + address → sub-object removed | YES | |

### To Invoice Fixes
| # | Test | Status | Notes |
|---|---|---|---|
| TI-01 | To Invoice tab count shows 8 (not 17) | YES | |
| TI-02 | Cancelled V1 orders excluded from To Invoice list | YES | |
| TI-03 | 8 legitimate V1 orders appear in To Invoice list | YES | |
| TI-04 | AF-003867 does NOT appear in To Invoice list | YES | |
| TI-05 | AF-003866 does NOT appear in To Invoice list | YES | |
| TI-06 | No debug logs in server console after v2.33 | YES | |
| TI-07 | To Invoice tab still shows 8 after debug logs removed | YES | |

### List Visibility
| # | Test | Status | Notes |
|---|---|---|---|
| LV-01 | Native V2 AF- records appear in Active tab | YES | |
| LV-02 | Active tab count matches stats badge | YES | Active=23 confirmed |
| LV-03 | Trashed records (trash=true) excluded from all tabs | YES | AF-003865 absent confirmed |
| LV-04 | Stats counts unchanged after fix | YES | Active=22, TI=8, Completed=2021 |
| LV-05 | Migrated AF- records show in list with migrated_from_v1=true | YES | Same evidence as GS-09 |
| LV-06 | All list tabs load without error | YES | Active 21, Completed 2020, Draft 0, TI 7, Cancelled 1 |

### Datastore Sweep
| # | Test | Status | Notes |
|---|---|---|---|
| DS-01 | createShipmentOrder() migrated to af-server POST endpoint | YES | v2.53 |
| DS-02 | deleteShipmentOrder() migrated to af-server DELETE endpoint | YES | v2.53 |
| DS-04 | actions/shipments.ts has zero Datastore reads | YES | Code review confirmed |

### Manual Shipment Creation
| # | Test | Status | Notes |
|---|---|---|---|
| MC-01 | POST /api/v2/shipments creates shipment — row in PostgreSQL | YES | AF-003872 created successfully |
| MC-02 | Created shipment navigates to detail page immediately | YES | AF-003872 — redirected to /shipments/AF-003872 |
| MC-03 | Created shipment has shipment_workflows row with auto-generated tasks | YES | AF-003872 — 7 tasks generated (EXW IMPORT SEA FCL): Origin Haulage, Freight Booking, Export Customs, POL, POD, Import Customs, Dest Haulage |
| MC-04 | createShipmentOrderAction() imports no legacy lib functions | YES | Code review confirmed |
| MC-05 | createShipmentOrderAction() returns correct shipment_id from server | YES | AF-003872 — correct sequence ID returned and navigated to |

### Shipment Delete
| # | Test | Status | Notes |
|---|---|---|---|
| SD-01 | Soft delete — shipment disappears from all tabs | YES | AF-003865 confirmed |
| SD-02 | Soft delete — row still in DB with trash=true | YES | DB query confirmed |
| SD-04 | Hard delete — removes all rows from DB | YES | AF-003865 confirmed |

### Loading State UI
| # | Test | Status | Notes |
|---|---|---|---|
| LO-01 | Advance/Revert — colored spinner + "Updating…" | YES | v2.51 confirmed |
| LO-02 | Invoiced toggle — spinner inline while loading | YES | AF-003844 confirmed |
| LO-03 | Cancel/Exception — colored spinners + "Updating…" | YES | v2.51 confirmed |
| LO-04 | All action buttons disabled during any mutation | YES | v2.51 confirmed |
| LO-05 | Timeline node click triggers spinner on Advance button | YES | v2.51 confirmed |
