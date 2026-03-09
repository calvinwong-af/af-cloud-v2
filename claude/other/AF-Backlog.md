# AF Platform — Backlog

Items identified during development/testing that are not urgent but should be addressed in future sessions.

---

## ACTIVE TODOS

| # | Item | Context | Notes |
|---|---|---|---|
| UI-17 | Per-user default country preference | Session 47 | Pricing module currently hardcodes MY as default country. Should default based on the logged-in user's country. Requires a `country_code` field on the user record (schema migration + users router + profile action). Low priority — MY hardcode is acceptable for now. |
| PR-01 | Surcharge model clarification — list price vs. supplier side | Session 64 | Current data model allows `surcharges` JSONB on both list price records (`supplier_id IS NULL`) and supplier/cost records. Design decision required before building the quotation module: (1) Surcharges on supplier records = cost burden, absorbed or partially passed through. (2) Surcharges on list price records = ambiguous — could mean pass-through charges to customer, or data entry error. Resolution: define whether list price surcharges represent customer-facing pass-through charges (distinct from cost-side surcharges), and enforce the distinction in the UI and backend validation. Customer quote back-calculation model: quoted total (list price) − supplier surcharges = net freight shown to customer, with surcharges itemised separately. Review when starting the Quotation module. |
| PR-02 | Orphan open-ended supplier rows — migration data cleanup | Session 77 | Cards 109/110 patched manually in v5.74. A broader cleanup script for all FCL/LCL migrated rows with overlapping open-ended date ranges is deferred. The `close_previous` feature (v5.68) only applies to new rate creation. System handles them correctly now but a migration script should be written to close all superseded open-ended rows across all cards. Low priority. |
| PR-03 | `expiring_soon` dashboard query overcounts | Session 77 | Currently flags all open-ended cards as expiring soon. Deferred — do not touch until explicitly scoped. |

---

## TECHNICAL DEBT

| # | Item | Context | Notes |
|---|---|---|---|
| TD-01 | Refactor `_helpers.py` into domain-specific modules | Session 27 | CLOSED — v-TD-01: split into 4 modules, all import sites updated across 7 routers. |
| TD-02 | Drop deprecated flat surcharge columns from fcl_rates / lcl_rates | Session 58 | Columns `lss`, `baf`, `ecrs`, `psc` deprecated in v5.38 — superseded by `surcharges` JSONB. Legacy data migrated to JSONB in migration 018. Drop columns once v5.38 is confirmed stable in prod. Migration: `ALTER TABLE fcl_rates DROP COLUMN lss, DROP COLUMN baf, DROP COLUMN ecrs, DROP COLUMN psc;` — same for `lcl_rates`. |

---

## DEFERRED (by design)

| # | Item | Context | Notes |
|---|---|---|---|
| D-01 | Token auto-refresh on 401 | Session 9 | Firebase onIdTokenChanged handles normal refresh. Belt-and-suspenders: catch 401 from af-server, force refresh token, retry once. Not urgent — only manifests after long idle sessions. |
| D-02 | customer_reference field — schema migration + restore in INSERT | Session 9 | Field was removed as ghost column (not in create_schema.py). Legitimate operational field that users enter in BL upload form. Needs ALTER TABLE + restore in create_schema.py INSERT. |
| D-03 | Route card port names showing dashes on all V1 migrated records | Session 9 | origin and destination labels set to port_un_code only in toShipmentOrder(). Port name lookup not happening at list level — only on detail page. Affects all 2,020 completed records in list. |

---

## CLOSED

| # | Item | Resolution |
|---|---|---|
| UI-06 | Back button removed; detail page opens in new tab | Closed Session 9 |
| UI-05 | No ability to edit order details on shipment detail page | CLOSED — Incoterm editable via IncotermEditModal; order_type/transaction_type read-only by design. |
| TODO-UI-01 | Incoterm edit control with pencil icon | CLOSED — IncotermEditModal implemented on RouteCard. |
| TODO-UI-02 | Incoterm badge styling consistency | CLOSED — resolved with incoterm edit implementation. |
| UI-07 | BL apply — packages not updated for LCL | CLOSED — confirmed fixed Session 20. |
| UI-08 | BL apply — cargo description not updated | CLOSED — confirmed fixed Session 20. |
| UI-09 | "Read File" re-opens legacy dialog | CLOSED — BLUpdateModal deleted v3.15. |
| UI-10 | Parties card — no diff indicator after document apply | CLOSED — fixed v3.09. |
| UI-11 | LCL BL apply — container + seal stored separately | CLOSED — fixed v3.16. |
| UI-12 | BL apply — packaging details not parsed/written | CLOSED — confirmed fixed Session 20. |
| UI-13 | Port combobox — switching from terminal port breaks | CLOSED — fixed v3.12 + v3.15. |
| UI-14 | BLUpdateModal legacy port fields | CLOSED — BLUpdateModal deleted v3.15. |
| UI-16 | Dead state cleanup after v3.15 | CLOSED — handled as part of v3.15. |
| UI-01 | Keyboard arrow navigation on combobox/dropdowns | CLOSED — confirmed fixed Session 47. |
| UI-02 | Port list filtered by freight type in PortEditModal | CLOSED — confirmed fixed Session 47. |
| UI-03 | Port edit pencil icon position on RouteCard | CLOSED — confirmed fixed Session 47. |
| UI-04 | Port edit modal — no freight type filtering | CLOSED — confirmed fixed Session 47. |
| BL-01 | Search results pagination | CLOSED — v4.23. |
| BL-02 | Search debounce | CLOSED — infrastructure issue, no code change. |
| BL-03 | Inline edit transport card fields | CLOSED — v4.22. |
| BL-04 | Company name not showing in DocumentParseModal | CLOSED. |
| BL-05 | Transport card missing air shipment fields | CLOSED. |
