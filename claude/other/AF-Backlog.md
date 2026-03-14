# AF Platform — Backlog

Items identified during development/testing that are not urgent but should be addressed in future sessions.

---

## ACTIVE TODOS

| # | Item | Context | Notes |
|---|---|---|---|
| UI-17 | Per-user default country preference | Session 47 | Pricing module currently hardcodes MY as default country. Should default based on the logged-in user's country. Requires a `country_code` field on the user record (schema migration + users router + profile action). Low priority — MY hardcode is acceptable for now. |
| UI-18 | Cross-module UI consistency audit (haulage pattern → FCL/LCL/Air) | Session 135 | After haulage UI is finalised, audit FCL/LCL/Air panels for: (1) icon buttons matching haulage/local-charges pattern, (2) delete options on card + rate rows, (3) area-first display where applicable, (4) "Add rate" label replacing "Update", (5) removal of "Set end date" in favour of edit modal. |
| UI-19 | Change trade direction (IMPORT ↔ EXPORT) on existing shipment | Session 138 | Only available on Draft shipments. Triggers: (1) workflow task reset — delete existing tasks, regenerate from new incoterm + direction via `get_applicable_processes`, (2) status path re-evaluation — may need reset to Draft, (3) scope snapshot invalidation on open quotations, (4) quotation flagged as stale with recalculation prompt. Show confirmation modal listing what will be reset before proceeding. Block entirely for Confirmed+ shipments. |
| PR-01 | Surcharge model clarification — list price vs. supplier side | Session 64 | Current data model allows `surcharges` JSONB on both list price records (`supplier_id IS NULL`) and supplier/cost records. Design decision required before building the quotation module: (1) Surcharges on supplier records = cost burden, absorbed or partially passed through. (2) Surcharges on list price records = ambiguous — could mean pass-through charges to customer, or data entry error. Resolution: define whether list price surcharges represent customer-facing pass-through charges (distinct from cost-side surcharges), and enforce the distinction in the UI and backend validation. Customer quote back-calculation model: quoted total (list price) − supplier surcharges = net freight shown to customer, with surcharges itemised separately. Review when starting the Quotation module. |

---

## TECHNICAL DEBT

| # | Item | Context | Notes |
|---|---|---|---|
| TD-01 | Refactor `_helpers.py` into domain-specific modules | Session 27 | CLOSED — v-TD-01: split into 4 modules, all import sites updated across 7 routers. |
| TD-02 | CLOSED — migration 034 confirmed run Session 102. Columns already absent; DO block passed clean.

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
| PR-02 | Orphan open-ended supplier rows | CLOSED — cascading effective_from node model correct by design. Cards 109/110 patched v5.74. |
| PR-03 | `expiring_soon` dashboard query overcounts | CLOSED — resolved v5.86 (CTE refactor). |
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
