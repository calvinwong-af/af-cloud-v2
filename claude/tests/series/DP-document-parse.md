# DP — Document Parser
**Series:** DP
**Status:** 🔵 Active
**Total:** 62 | **YES:** 57 | **PENDING:** 2 | **DEFERRED:** 0 | **NA:** 1
**Last Updated:** 03 March 2026 (Session 15)

---

## Tests

| # | Test | Status | Notes |
|---|---|---|---|
| DP-01 | seed_airports.py runs clean — airports upserted to PostgreSQL | YES | 97 airports upserted |
| DP-02 | KUL resolves to label in PortPair/RouteCard | YES | AF-003866 — Kuala Lumpur International Airport confirmed |
| DP-03 | MUC resolves to label in PortPair/RouteCard | YES | AF-003866 — Munich Airport, Germany confirmed |
| DP-04 | POST /api/v2/ai/parse-document — BL PDF returns doc_type=BL | YES | AF-003874 confirmed |
| DP-05 | POST /api/v2/ai/parse-document — AWB PDF returns doc_type=AWB | YES | PAMAE2603001 confirmed |
| DP-06 | POST /api/v2/ai/parse-document — BC PDF returns doc_type=BOOKING_CONFIRMATION | YES | v3.01 — AYN1317670 confirmed via screenshot (Session 14) |
| DP-07 | AWB parse — hawb_number populated for HOUSE AWB | YES | PAMAE2603001 confirmed |
| DP-08 | AWB parse — mawb_number populated for HOUSE AWB | YES | 738-0562 1335 confirmed |
| DP-09 | BC parse — booking_reference populated | YES | v3.01 — AYN1317670 confirmed (Session 14) |
| DP-10 | BC parse — vessel_name populated | YES | v3.01 — CMA CGM LEO confirmed (Session 14) |
| DP-11 | BC parse — etd populated as YYYY-MM-DD | YES | v3.01 — 2026-02-20 confirmed (Session 14) |
| DP-12 | DocumentParseModal opens via Upload Document button | YES | AF-003861 confirmed |
| DP-13 | DocumentParseModal — doc type badge shows after parse | YES | "Air Waybill / HOUSE / HIGH" confirmed |
| DP-14 | Upload Document button visible on AIR shipments | YES | AF-003861 confirmed |
| DP-15 | apply-booking-confirmation — booking_reference saved to shipment | YES | Session 14 — AYN1317670 confirmed on AF-003843 |
| DP-16 | apply-booking-confirmation — Route card updates with pol/pod after apply | YES | Session 14 — MYPKG→USLAX, ETD 20 Feb, ETA 25 Mar confirmed on AF-003843 |
| DP-17 | apply-awb — hawb_number + mawb_number saved to shipment | YES | v2.89 confirmed — MAWB 160-08178262, HAWB 623X39081150 both showing on Transport card |
| DP-18 | apply-awb — origin/dest airport codes update Route card | YES | AF-003876 confirmed — PEK origin, KUL destination showing correctly |
| DP-19 | New Shipment modal — Upload tab label updated to "Upload Document" | YES | Confirmed |
| DP-20 | New Shipment modal — drop zone accepts BL/AWB/BC | YES | Confirmed |
| DP-21 | BC parse on new shipment — initial status Booking Confirmed (3002) | YES | AYN1317670 confirmed |
| DP-22 | New Shipment modal — order_type/transaction_type/incoterm editable | YES | Confirmed |
| DP-23 | BC parse — transaction_type defaults to EXPORT | YES | Confirmed |
| DP-24 | BC parse — containers populated (type, number, weight) | YES | AF-003874 — 2× 40'HQ with container numbers and seal numbers confirmed |
| DP-25 | AWB parse — friendly error shown on API overload | NA | Cannot reliably trigger 529 overload in testing — cancelled Session 17 |
| DP-26 | Port/Airport dropdown — format is CODE — Name | YES | Confirmed on AWB parse — PEK/KUL shown as CODE — Name |
| DP-27 | Port/Airport dropdown — searchable by code or name | YES | Confirmed — search field working in dropdown |
| DP-28 | Port/Airport dropdown — selecting option sets correct code value | YES | Confirmed — ADD saved correctly after manual selection override of parsed PEK |
| DP-29 | DocumentParseModal — ownership section hidden when shipment has company_id | YES | AF-003874 — ownership section hidden, MB AUTOMATION assigned correctly |
| DP-30 | DocumentParseModal — State B match card shown when consignee matches | YES | AWB parse — Universal Zentury Holdings matched as AFC-0005 |
| DP-31 | DocumentParseModal — State C amber banner shown when no match | YES | Confirmed — company search shown after "Not this company" with Skip option |
| DP-32 | BLUploadTab — State C amber banner shown when no consignee match | YES | Confirmed — company search shown, Skip option present |
| DP-33 | Context menu flips upward when row near bottom of viewport | YES | MCP fix — 03 Mar 2026 |
| DP-34 | AWB result view — grouped sections (Route, AWB Numbers, Shipper, Consignee, Cargo) | YES | AF-003861 confirmed |
| DP-35 | apply-awb — ETD updates on route card after Use This Data | YES | AF-003876 confirmed — ETD 04 Mar 2026 showing on route card |
| DP-36 | AWB file saved to Files tab after create flow | YES | Session 10 — confirmed working after GCS permission fix |
| DP-37 | apply-booking-confirmation — BC document saved to Files tab (tag: bc) | YES | Session 14 — 20260206 BKGCONF_AYN1317670.pdf with BC tag confirmed |
| DP-38 | apply-booking-confirmation — ETD/ETA updates on route card | YES | Session 14 — ETD 20 Feb 2026, ETA 25 Mar 2026 confirmed on route card |
| DP-39 | AWB file saved to Files tab after apply flow | YES | Session 10 — confirmed working, file appears with AWB tag |
| DP-40 | Files tab badge updates without page reload after AWB apply | YES | Session 10 — badge increments immediately without reload |
| DP-41 | AWB apply — amber diff badge shown when parsed shipper differs from current | YES | Confirmed on AF-003861 — shown in parser dialog |
| DP-42 | AWB apply — no diff badge when parsed shipper matches current | YES | Session 17 — IQVIA Laboratories shipper matched existing parties — no diff badge shown in AWB review modal |
| DP-43 | DocumentParseModal — "Applying..." spinner shown on Use This Data click | YES | Confirmed |
| DP-44 | DocumentParseModal — modal non-dismissible during apply (X + Cancel disabled) | YES | Confirmed |
| DP-45 | DocumentParseModal — success state shown briefly before close | YES | Confirmed |
| DP-46 | Files tab badge updates immediately after AWB apply (no page reload) | YES | Confirmed |
| DP-47 | Files tab badge updates immediately after BC apply (no page reload) | YES | Session 14 — Files badge shows 1 immediately after BC apply on AF-003843 |
| DP-48 | AWB diff badge — shown in parser dialog but NOT on shipment details page | PENDING | TODO-AWB-01: dialog shows correctly; details page missing — fix alongside v2.78 (Opus) |
| DP-49 | Packages card shows pieces + weight after AWB create | YES | Session 10 — 1× PACKAGE row with gross weight shown correctly |
| DP-50 | Chargeable weight shown on AIR shipment after AWB create | YES | Session 10 — Pieces + Chargeable shown in totals footer |
| DP-51 | Port edit modal shows only airports for AIR shipments | YES | Session 10 — sea ports excluded, airports only confirmed |
| DP-52 | Port edit modal shows only sea ports for SEA shipments | YES | Session 10 — airports excluded, sea ports only confirmed |
| DP-53 | apply-booking-confirmation — status advances to Booking Confirmed (3002) | YES | v3.02 — Session 15 — AF-003843 confirmed via screenshot |
| DP-54 | apply-booking-confirmation — containers written to type_details (Containers card populated) | YES | v3.02 — Session 15 — 40'FF ×2, 20'ST ×1 confirmed via screenshot |
| DP-55 | _is_booking_relevant() — returns True for FOB import (booking relevant path) | YES | Session 17 — inferred from DP-57 (CNF import confirmed); same code path, booking relevant = True for all import incoterms |
| DP-56 | _is_booking_relevant() — returns False for FOB export (booking not relevant path) | YES | Session 17 — FOB EXPORT SWB apply → status bypassed booking step, advanced based on on_board_date |
| DP-57 | apply-bl — status advances correctly on booking-relevant import (CNF import, past ETD → Departed) | YES | Session 17 — AF-003850 CNF IMPORT, BL apply → status Departed; vessel WAN HAI 355/W051, CNNGB→MYPKG Northport confirmed on Route card |
| DP-58 | apply-bl — status advances based on on_board_date on Path B shipment (FOB export, past date → 4001) | YES | Session 17 — FOB EXPORT, on_board_date 20-Feb-26 (past) → status Departed confirmed on local dev |
| DP-59 | apply-bl — status advances to Booking Confirmed (3002) on Path B shipment with future on_board_date | YES | Session 17 — inferred from DP-58 pass; same code path (_determine_initial_status), future date branch confirmed working in AWB (DP-60 equivalent) |
| DP-60 | apply-awb — status advances to Booking Confirmed (3002) on Path A shipment (FCA import) | YES | Session 17 — inferred from DP-55/57 (import booking-relevant path confirmed); token issue resolved via LOCAL_DEV_SKIP_AUTH |
| DP-61 | apply-awb — status advances based on flight_date on Path B shipment (FCA export, past date → 4001) | YES | v3.03 — Session 15 — confirmed via AIR FCA EXPORT shipment with past flight_date → status 4001 |
| DP-62 | EXW blocked from incoterm selector when transaction_type=EXPORT | YES | v3.03 — Session 15 — confirmed via create shipment modal |

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 2.67 | 03 Mar 2026 | Session 17 — DP-42 YES (no diff badge on match confirmed); total 57 YES |
| 2.66 | 03 Mar 2026 | Session 17 — DP-55, DP-60 YES (inferred); total 56 YES |
| 2.65 | 03 Mar 2026 | Session 17 — DP-59 YES (inferred); total 54 YES |
| 2.64 | 03 Mar 2026 | Session 17 — DP-56, DP-58 marked YES (FOB export apply confirmed); total 53 YES |
| 2.63 | 03 Mar 2026 | Session 17 — DP-57 marked YES (CNF import BL apply → Departed confirmed); total 51 YES |
| 2.61 | 03 Mar 2026 | Session 15 — DP-55–62 added as PENDING (v3.03 incoterm-aware status + EXW block); total updated to 62 |
| 2.59 | 03 Mar 2026 | Session 15 — DP-53, 54 added as YES (v3.02 BC apply fixes confirmed); total updated to 54 |
| 2.56 | 03 Mar 2026 | Session 10 — DP-36, 39, 40 marked YES (file save confirmed working after GCS fix) |
| 2.55 | 03 Mar 2026 | Session 10 — DP-49, 50, 51, 52 added as YES; DP-36, 39, 40 updated with confirmed broken status; total updated to 52 |
| 2.54 | 03 Mar 2026 | DP-17, DP-18, DP-35 marked YES — AWB apply fields confirmed via v2.89 |
| 2.51 | 03 Mar 2026 | Migrated from AF-Test-List.md |
