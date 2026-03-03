# AF Platform — Backlog

Items identified during development/testing that are not urgent but should be addressed in future sessions.

---

## ACTIVE TODOS (from Session 9 testing)

| # | Item | Context | Notes |
|---|---|---|---|
| UI-01 | Keyboard arrow navigation on all combobox/dropdown selects | Identified during v2.88 port edit modal testing | Sweeping revision — all searchable list components (PortEditModal, CompanyReassignModal, port dropdowns in DocumentParseModal, etc.) should support up/down arrow keys to navigate rows and Enter to select. Consistent UX across the platform. |
| UI-02 | Port list filtered by freight type in PortEditModal | Identified during v2.88 port edit modal testing | Air shipments should only see airports (air ports), sea shipments should only see sea ports. The Port type and ports array already distinguish these — filter at the modal level based on order.order_type (AIR vs SEA_FCL/SEA_LCL). |
| UI-03 | Port edit pencil icon position on RouteCard | Identified during v2.88 port edit modal testing | Current absolute-positioned pencil icons are not well-placed visually. Revisit placement — consider inline next to the port code/name text rather than floating over the PortPair component. |
| UI-04 | Port edit modal — no freight type filtering | Identified during v2.89 testing | PortEditModal shows all ports regardless of shipment type. Air shipments should only see airports; sea shipments should only see sea ports. Filter by order.order_type before passing ports to modal. Same underlying issue as UI-02. |
| UI-05 | No ability to edit order details on shipment detail page | Identified during v2.89 testing | Users cannot edit order-level fields (order_type, transaction_type, incoterm) from the detail page. Needs an Edit Order modal or inline edit for these fields. AFU only. |
| UI-07 | BL apply — packages not updated for LCL shipments | Session 17 | BL apply does not write packages/container data for LCL. Should follow same pattern as AWB apply (packages written to type_details). |
| UI-08 | BL apply — cargo description not updated | Session 17 | Cargo description field not populated after BL apply. Should follow same pattern as AWB (cargo_description written to shipment). |
| UI-09 | "Read File" re-opens old legacy dialog instead of new parser | Session 17 | After BL apply via new DocumentParseModal flow, clicking "Read File" again opens the old BLUpdateModal. All legacy parse dialogs for all file types (BL, AWB, BC) should be removed — "Read File" should always route through DocumentParseModal. |
| UI-10 | Parties card — no diff indicator after document apply | Session 17 | After applying a document that changes parties (shipper/consignee), the Parties card on the detail page shows no visual indicator of what changed. Diff badge works inside DocumentParseModal during review but does not persist post-apply. Tracked as DP-48. |
| UI-06 | CLOSED — Back button removed; detail page opens in new tab | Closed Session 9 | Back button removed from page.tsx. ShipmentRow + ShipmentCard updated to always open in new tab via window.open. |

---

## LOW PRIORITY

| # | Item | Context | Notes |
|---|---|---|---|
| BL-05 | Transport card missing air shipment fields on detail page | Identified during v2.85 DP testing | For air shipments, the Transport card only shows Booking Ref and ETD. Missing fields: MAWB, HAWB, flight number, flight date. These fields exist in the DB after v2.85 fix — they just need to be rendered. Conditional display: show air fields (MAWB/HAWB/flight) for Air order type, sea fields (vessel/voyage) for Sea order type. |
| BL-03 | Inline edit of document reference fields on shipment detail page | Identified during v2.85 DP testing | AFU staff should be able to edit booking ref, MAWB, HAWB, MBL, HBL, and packages directly on the shipment detail Overview tab. Pencil icon per section (Transport card), edit-in-place popover or modal, PATCH to af-server, AFU only. |
| BL-04 | Company name not showing in DocumentParseModal confirmed company card (manual search) | Identified during v2.85 DP testing | When user manually searches and selects a company via State C search, confirmed card shows ID twice instead of name. Root cause: onLink callback in BLParseResult.tsx only passes company_id. Fix: change to onLink: (id: string, name: string) => void across CompanyMatchSection and all call sites. |
| BL-01 | Search results pagination — Load more on search | Identified during PG-07 search test | Search is hard-capped at 25 results with no Load more option. Fix: add offset/cursor to search endpoint + Load more button in search mode. |
| BL-02 | Search debounce — excessive repeated API calls | Identified during PG-07 search test | 8 requests fired for a single query. Debounce is 300ms — consider increasing to 500ms to reduce noise. |

---

## PLANNED PROMPTS

| Prompt | Item | Scope | Notes |
|---|---|---|---|
| v2.77 | shipments.py modularisation | af-server | COMPLETE — 10-file package verified, shipments.py deleted, smoke tests passed |
| v2.78 | page.tsx split | af-platform | Split 78KB page into page.tsx shell + _components.tsx + _doc-handler.ts. Pure structural split. |
| v2.79 | DocumentParseModal split — doc type plugin pattern | af-platform | COMPLETE — 4-file plugin pattern verified, lint clean, DP-48 preserved as-is |
| v2.80 | BLUploadTab + BLUpdateModal + CreateShipmentModal split | af-platform | Modal/form group split. BLUpdateModal (34KB) and ShipmentTasks (31KB) also candidates. |
| v2.81 | User migration — Datastore to PostgreSQL | af-server + core | Migrate UserAccount, UserIAM, CompanyUserAccount, UserRolesTable, AFUserAccount to PostgreSQL. Rewrite core/auth.py. Remove google-cloud-datastore dependency entirely. |
| v2.82 | Bug fixes — Files tab + AWB diff + company search | af-platform | (1) File size showing NaN KB in Files tab. (2) Files tab badge not pre-populated on page load. (3) DP-48: AWB diff not shown on Parties card after apply. (4) Company/Shipment Owner section rendering twice in DocumentParseModal. |
| v2.83 | API Contract Document | af-server + af-platform | Dedicated session — read schema, models, and types; draft canonical object definitions for Shipment, User, Company, Parties. Output: claude/other/AF-API-Contract.md. Required before AI agent phase. |

---

## DEFERRED (by design)

| # | Item | Context | Notes |
|---|---|---|---|
| D-01 | Token auto-refresh on 401 | Identified from auth/id-token-expired error in session | Firebase onIdTokenChanged handles normal refresh. Belt-and-suspenders: catch 401 from af-server, force refresh token, retry once. Not urgent — only manifests after long idle sessions. |
| D-02 | customer_reference field — schema migration + restore in INSERT | Identified in v2.56 schema sweep | Field was removed as ghost column (not in create_schema.py). Legitimate operational field that users enter in BL upload form. Needs ALTER TABLE + restore in create_from_bl INSERT. |
| D-03 | Route card port names showing dashes on all V1 migrated records | Identified from completed tab snapshot | origin and destination labels set to port_un_code only in toShipmentOrder(). Port name lookup not happening at list level — only on detail page. Affects all 2,020 completed records in list. |
