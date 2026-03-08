# AF Platform — Backlog

Items identified during development/testing that are not urgent but should be addressed in future sessions.

---

## ACTIVE TODOS

| # | Item | Context | Notes |
|---|---|---|---|
| UI-17 | Per-user default country preference | Session 47 | Pricing module currently hardcodes MY as default country. Should default based on the logged-in user's country. Requires a `country_code` field on the user record (schema migration + users router + profile action). Low priority — MY hardcode is acceptable for now. |
| PR-01 | Surcharge model clarification — list price vs. supplier side | Session 64 | Current data model allows `surcharges` JSONB on both list price records (`supplier_id IS NULL`) and supplier/cost records. Design decision required before building the quotation module: (1) Surcharges on supplier records = cost burden, absorbed or partially passed through. (2) Surcharges on list price records = ambiguous — could mean pass-through charges to customer, or data entry error. Resolution: define whether list price surcharges represent customer-facing pass-through charges (distinct from cost-side surcharges), and enforce the distinction in the UI and backend validation. Customer quote back-calculation model: quoted total (list price) − supplier surcharges = net freight shown to customer, with surcharges itemised separately. Review when starting the Quotation module. |

## CLOSED

| # | Item | Context | Notes |
|---|---|---|---|
| UI-05 | No ability to edit order details on shipment detail page | Session 9 | CLOSED — Incoterm is editable via pencil icon on RouteCard (IncotermEditModal). order_type and transaction_type scoped as read-only by design decision Session 19. |
| TODO-UI-01 | Incoterm edit control with pencil icon | Session 31 | CLOSED — IncotermEditModal with pencil icon implemented on RouteCard. |
| TODO-UI-02 | Incoterm badge styling consistency | Session 31 | CLOSED — resolved as part of incoterm edit implementation. |
| UI-07 | BL apply — packages not updated for LCL shipments | Session 17 | CLOSED — confirmed via screenshot Session 20: packages writing correctly (1x PALLET, 197kg, 0.73 CBM). |
| UI-08 | BL apply — cargo description not updated | Session 17 | CLOSED — confirmed via screenshot Session 20: cargo description (EPOGARDE SF 100 I-13992) writing correctly. |
| UI-09 | "Read File" re-opens old legacy dialog instead of new parser | Session 17 | CLOSED — ShipmentFilesTab always routed through DocumentParseModal (v3.11). BLUpdateModal deleted in v3.15 removes the last legacy path. No further action needed. |
| UI-10 | Parties card — no diff indicator after document apply | Session 17 | After applying a document that changes parties (shipper/consignee), the Parties card on the detail page shows no visual indicator of what changed. Diff badge works inside DocumentParseModal during review but does not persist post-apply. Tracked as DP-48. CLOSED — fixed in v3.09. |
| UI-11 | LCL BL apply — container + seal stored separately | Session 17 | CLOSED — v3.16 fixed AI extraction prompt to correctly route consolidation container/seal to lcl_container_number/lcl_seal_number for LCL shipments. |
| UI-12 | BL apply — packaging details not parsed/written | Session 17 | CLOSED — confirmed via screenshot Session 20: qty, gross weight, volume all writing correctly to Packages card. |
| UI-13 | Port combobox — switching from terminal port breaks | Session 17 | DP-69: if a port with terminals is currently selected, changing to a different port fails. Terminal state not being cleared on port change. Affects BLReview and BCReview. CLOSED — fixed v3.12 (BLReview) + v3.15 (BCReview). |
| UI-14 | BLUpdateModal (legacy) — port fields not resolving | Session 17 | Old BLUpdateModal port fields show empty / not matched. CLOSED — BLUpdateModal deleted in v3.15. |
| UI-16 | Dead state cleanup after v3.15 | Session 19 | After BLUpdateModal removal, verify no orphaned state/imports remain in page.tsx, _doc-handler.ts, or elsewhere. Run tsc --noEmit to confirm clean build. CLOSED — handled as part of v3.15. |
| UI-01 | Keyboard arrow navigation on all combobox/dropdown selects | Session 9 | CLOSED — confirmed fixed Session 47. |
| UI-02 | Port list filtered by freight type in PortEditModal | Session 9 | CLOSED — confirmed fixed Session 47. |
| UI-03 | Port edit pencil icon position on RouteCard | Session 9 | CLOSED — confirmed fixed Session 47. |
| UI-04 | Port edit modal — no freight type filtering | Session 9 | CLOSED — confirmed fixed Session 47. |

---

## TECHNICAL DEBT

| # | Item | Context | Notes |
|---|---|---|---|
| TD-01 | Refactor `_helpers.py` into domain-specific modules | Session 27 | CLOSED — v-TD-01: split into 4 modules, all import sites updated across 7 routers. |
| TD-02 | Drop deprecated flat surcharge columns from fcl_rates / lcl_rates | Session 58 | Columns `lss`, `baf`, `ecrs`, `psc` deprecated in v5.38 — superseded by `surcharges` JSONB. Legacy data migrated to JSONB in migration 018. Drop columns once v5.38 is confirmed stable in prod. Migration: `ALTER TABLE fcl_rates DROP COLUMN lss, DROP COLUMN baf, DROP COLUMN ecrs, DROP COLUMN psc;` — same for `lcl_rates`. |

---

## LOW PRIORITY

| # | Item | Context | Notes |
|---|---|---|---|
| BL-01 | Search results pagination — Load more on search | Session 9 | CLOSED — v4.23: offset/cursor added to search endpoint, Load more button added in search mode, QuickSearch call site updated. |
| BL-02 | Search debounce — excessive repeated API calls | Session 9 | CLOSED — Root cause is an API/infrastructure setup issue, not a debounce problem. No code change required. |
| BL-03 | Inline edit of document reference fields on shipment detail page | Session 9 | CLOSED — v4.22: TransportCard + TransportEditModal implemented with sea/air modes, PATCH /booking endpoint added. |
| BL-04 | Company name not showing in DocumentParseModal confirmed company card (manual search) | Session 9 | CLOSED — Resolved. |
| BL-05 | Transport card missing air shipment fields on detail page | Session 9 | CLOSED — Resolved. |

---

## PLANNED PROMPTS

| Prompt | Item | Scope | Notes |
|---|---|---|---|
| v2.77 | shipments.py modularisation | af-server | ✅ Complete — 10-file package verified, shipments.py deleted, smoke tests passed |
| v2.78 | page.tsx split | af-platform | ✅ Complete — page.tsx shell + _components.tsx + _doc-handler.ts |
| v2.79 | DocumentParseModal split — doc type plugin pattern | af-platform | ✅ Complete — 4-file plugin pattern verified, lint clean |
| v2.80 | BLUploadTab + BLUpdateModal + CreateShipmentModal split | af-platform | Modal/form group split. BLUpdateModal (34KB) and ShipmentTasks (31KB) also candidates. |
| v2.81 | User migration — Datastore to PostgreSQL | af-server + core | ✅ Complete — users migrated to PostgreSQL, core/auth.py rewritten |
| v2.82 | Bug fixes — Files tab + AWB diff + company search | af-platform | (1) File size showing NaN KB in Files tab. (2) Files tab badge not pre-populated on page load. (3) DP-48: AWB diff not shown on Parties card after apply. (4) Company/Shipment Owner section rendering twice in DocumentParseModal. |
| v2.83 | API Contract Document | af-server + af-platform | ✅ Complete — AF-API-Contract.md at v1.2, covering all 8 routers |

---

## DEFERRED (by design)

| # | Item | Context | Notes |
|---|---|---|---|
| D-01 | Token auto-refresh on 401 | Session 9 | Firebase onIdTokenChanged handles normal refresh. Belt-and-suspenders: catch 401 from af-server, force refresh token, retry once. Not urgent — only manifests after long idle sessions. |
| D-02 | customer_reference field — schema migration + restore in INSERT | Session 9 | Field was removed as ghost column (not in create_schema.py). Legitimate operational field that users enter in BL upload form. Needs ALTER TABLE + restore in create_from_bl INSERT. |
| D-03 | Route card port names showing dashes on all V1 migrated records | Session 9 | origin and destination labels set to port_un_code only in toShipmentOrder(). Port name lookup not happening at list level — only on detail page. Affects all 2,020 completed records in list. |

---

## CLOSED

| # | Item | Resolution |
|---|---|---|
| UI-06 | Back button removed; detail page opens in new tab | Closed Session 9 — Back button removed from page.tsx. ShipmentRow + ShipmentCard updated to always open in new tab via window.open. |
