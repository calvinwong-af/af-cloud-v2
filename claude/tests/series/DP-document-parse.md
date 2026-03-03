# DP — Document Parser
**Series:** DP
**Status:** 🔵 Active
**Total:** 52 | **YES:** 36 | **PENDING:** 12 | **DEFERRED:** 0 | **NA:** 0
**Last Updated:** 03 March 2026

---

## Tests

| # | Test | Status | Notes |
|---|---|---|---|
| DP-01 | seed_airports.py runs clean — airports upserted to PostgreSQL | YES | 97 airports upserted |
| DP-02 | KUL resolves to label in PortPair/RouteCard | YES | AF-003866 — Kuala Lumpur International Airport confirmed |
| DP-03 | MUC resolves to label in PortPair/RouteCard | YES | AF-003866 — Munich Airport, Germany confirmed |
| DP-04 | POST /api/v2/ai/parse-document — BL PDF returns doc_type=BL | YES | AF-003874 confirmed |
| DP-05 | POST /api/v2/ai/parse-document — AWB PDF returns doc_type=AWB | YES | PAMAE2603001 confirmed |
| DP-06 | POST /api/v2/ai/parse-document — BC PDF returns doc_type=BOOKING_CONFIRMATION | PENDING | Use AYN1317670 |
| DP-07 | AWB parse — hawb_number populated for HOUSE AWB | YES | PAMAE2603001 confirmed |
| DP-08 | AWB parse — mawb_number populated for HOUSE AWB | YES | 738-0562 1335 confirmed |
| DP-09 | BC parse — booking_reference populated | PENDING | Use AYN1317670 |
| DP-10 | BC parse — vessel_name populated | PENDING | Expected: CMA CGM A. LINCOLN |
| DP-11 | BC parse — etd populated as YYYY-MM-DD | PENDING | Expected: 2026-02-19 |
| DP-12 | DocumentParseModal opens via Upload Document button | YES | AF-003861 confirmed |
| DP-13 | DocumentParseModal — doc type badge shows after parse | YES | "Air Waybill / HOUSE / HIGH" confirmed |
| DP-14 | Upload Document button visible on AIR shipments | YES | AF-003861 confirmed |
| DP-15 | apply-booking-confirmation — booking_reference saved to shipment | PENDING | |
| DP-16 | apply-booking-confirmation — Route card updates with pol/pod after apply | PENDING | |
| DP-17 | apply-awb — hawb_number + mawb_number saved to shipment | YES | v2.89 confirmed — MAWB 160-08178262, HAWB 623X39081150 both showing on Transport card |
| DP-18 | apply-awb — origin/dest airport codes update Route card | YES | AF-003876 confirmed — PEK origin, KUL destination showing correctly |
| DP-19 | New Shipment modal — Upload tab label updated to "Upload Document" | YES | Confirmed |
| DP-20 | New Shipment modal — drop zone accepts BL/AWB/BC | YES | Confirmed |
| DP-21 | BC parse on new shipment — initial status Booking Confirmed (3002) | YES | AYN1317670 confirmed |
| DP-22 | New Shipment modal — order_type/transaction_type/incoterm editable | YES | Confirmed |
| DP-23 | BC parse — transaction_type defaults to EXPORT | YES | Confirmed |
| DP-24 | BC parse — containers populated (type, number, weight) | YES | AF-003874 — 2× 40'HQ with container numbers and seal numbers confirmed |
| DP-25 | AWB parse — friendly error shown on API overload | PENDING | Mock or trigger overload |
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
| DP-36 | AWB file saved to Files tab after create flow | PENDING | Assumed fail — same root cause as DP-39 — fix in v2.90 |
| DP-37 | apply-booking-confirmation — BC document saved to Files tab (tag: bc) | PENDING | Requires v2.73 |
| DP-38 | apply-booking-confirmation — ETD/ETA updates on route card | PENDING | Requires v2.73 |
| DP-39 | AWB file saved to Files tab after apply flow | PENDING | Confirmed broken — tested Session 10, Files tab empty after apply even after refresh — fix in v2.90 |
| DP-40 | Files tab badge updates without page reload after AWB apply | PENDING | Confirmed broken — tested Session 10 — fix in v2.90 |
| DP-41 | AWB apply — amber diff badge shown when parsed shipper differs from current | YES | Confirmed on AF-003861 — shown in parser dialog |
| DP-42 | AWB apply — no diff badge when parsed shipper matches current | PENDING | |
| DP-43 | DocumentParseModal — "Applying..." spinner shown on Use This Data click | YES | Confirmed |
| DP-44 | DocumentParseModal — modal non-dismissible during apply (X + Cancel disabled) | YES | Confirmed |
| DP-45 | DocumentParseModal — success state shown briefly before close | YES | Confirmed |
| DP-46 | Files tab badge updates immediately after AWB apply (no page reload) | YES | Confirmed |
| DP-47 | Files tab badge updates immediately after BC apply (no page reload) | PENDING | |
| DP-48 | AWB diff badge — shown in parser dialog but NOT on shipment details page | PENDING | TODO-AWB-01: dialog shows correctly; details page missing — fix alongside v2.78 (Opus) |
| DP-49 | Packages card shows pieces + weight after AWB create | YES | Session 10 — 1× PACKAGE row with gross weight shown correctly |
| DP-50 | Chargeable weight shown on AIR shipment after AWB create | YES | Session 10 — Pieces + Chargeable shown in totals footer |
| DP-51 | Port edit modal shows only airports for AIR shipments | YES | Session 10 — sea ports excluded, airports only confirmed |
| DP-52 | Port edit modal shows only sea ports for SEA shipments | YES | Session 10 — airports excluded, sea ports only confirmed |

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 2.55 | 03 Mar 2026 | Session 10 — DP-49, 50, 51, 52 added as YES; DP-36, 39, 40 updated with confirmed broken status; total updated to 52 |
| 2.54 | 03 Mar 2026 | DP-17, DP-18, DP-35 marked YES — AWB apply fields confirmed via v2.89 |
| 2.51 | 03 Mar 2026 | Migrated from AF-Test-List.md |
