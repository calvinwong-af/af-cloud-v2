# AF Platform — Backlog

Items identified during development/testing that are not urgent but should be addressed in future sessions.

---

## LOW PRIORITY

| # | Item | Context | Notes |
|---|---|---|---|
| BL-05 | Transport card missing air shipment fields on detail page | Identified during v2.85 DP testing | For air shipments, the Transport card only shows Booking Ref and ETD. Missing fields: MAWB, HAWB, flight number, flight date. These fields exist in the DB after v2.85 fix — they just need to be rendered. Conditional display: show air fields (MAWB/HAWB/flight) for Air order type, sea fields (vessel/voyage) for Sea order type. |
| BL-03 | Inline edit of document reference fields on shipment detail page | Identified during v2.85 DP testing | AFU staff should be able to edit booking ref, MAWB, HAWB, MBL, HBL, and packages directly on the shipment detail Overview tab. Pencil icon per section (Transport card), edit-in-place popover or modal, PATCH to af-server, AFU only. |
| BL-04 | Company name not showing in DocumentParseModal confirmed company card (manual search) | Identified during v2.85 DP testing | When user manually searches and selects a company via State C search, confirmed card shows ID twice instead of name. Root cause: `onLink` callback in `BLParseResult.tsx` only passes `company_id`. Fix: change to `onLink: (id: string, name: string) => void` across `CompanyMatchSection` and all call sites. |
| BL-01 | Search results pagination — Load more on search | Identified during PG-07 search test | Search is hard-capped at 25 results with no Load more option. "big screen" hits the cap exactly, silently cutting off additional records. Fix: add offset/cursor to search endpoint + Load more button in search mode. Server: `GET /search` needs `offset` param. Client: `searchShipmentsAction` + `handleSearchChange` in shipments/page.tsx. |
| BL-02 | Search debounce — excessive repeated API calls | Identified during PG-07 search test | 8 requests fired for a single "big screen" query. Debounce is 300ms — consider increasing to 500ms to reduce noise. Low impact but adds unnecessary server load. |

---

## PLANNED PROMPTS

| Prompt | Item | Scope | Notes |
|---|---|---|---|
| v2.77 | shipments.py modularisation | af-server | ✅ Complete — 10-file package verified, shipments.py deleted, smoke tests passed |
| v2.78 | page.tsx split | af-platform | Split 78KB page into page.tsx shell + _components.tsx + _doc-handler.ts. Pure structural split. |
| v2.79 | DocumentParseModal split — doc type plugin pattern | af-platform | ✅ Complete — 4-file plugin pattern verified, lint clean, DP-48 preserved as-is |
| v2.80 | BLUploadTab + BLUpdateModal + CreateShipmentModal split | af-platform | Modal/form group split. BLUpdateModal (34KB) and ShipmentTasks (31KB) also candidates. |
| v2.81 | User migration — Datastore → PostgreSQL | af-server + core | Migrate UserAccount, UserIAM, CompanyUserAccount, UserRolesTable, AFUserAccount to PostgreSQL. Rewrite core/auth.py. Remove google-cloud-datastore dependency entirely. |
| v2.82 | Bug fixes — Files tab + AWB diff + company search | af-platform | (1) File size showing NaN KB in Files tab. (2) Files tab badge not pre-populated on page load — only updates after tab is opened. (3) DP-48: AWB diff not shown on Parties card after apply. (4) Company/Shipment Owner section rendering twice in DocumentParseModal — amber banner (State C) in orchestrator AND grey search field in review component. Ownership section should only render in the orchestrator, not inside BCReview/AWBReview/BLReview. Regression from v2.79 split. |
| v2.83 | API Contract Document | af-server + af-platform | Dedicated session — read schema, models, and types; draft canonical object definitions for Shipment, User, Company, Parties. Output: claude/other/AF-API-Contract.md. Required before AI agent phase. |

---

## DEFERRED (by design)

| # | Item | Context | Notes |
|---|---|---|---|
| D-01 | Token auto-refresh on 401 — force getIdToken(true) on failed API call | Identified from auth/id-token-expired error in session | Firebase onIdTokenChanged handles normal refresh. Belt-and-suspenders: catch 401 from af-server, force refresh token, retry once. Not urgent — only manifests after long idle sessions. |
| D-02 | customer_reference field — schema migration + restore in INSERT | Identified in v2.56 schema sweep | Field was removed as ghost column (not in create_schema.py). Legitimate operational field that users enter in BL upload form. Needs ALTER TABLE + restore in create_from_bl INSERT. |
| D-03 | Route card port names showing dashes on all V1 migrated records | Identified from completed tab snapshot | origin and destination labels set to port_un_code only (e.g. CNSHK, MYPKG) in toShipmentOrder(). Port name lookup not happening at list level — only on detail page. Wider scope than initially thought — affects all 2,020 completed records in list. |
