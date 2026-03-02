# AF Platform — Backlog

Items identified during development/testing that are not urgent but should be addressed in future sessions.

---

## LOW PRIORITY

| # | Item | Context | Notes |
|---|---|---|---|
| BL-01 | Search results pagination — Load more on search | Identified during PG-07 search test | Search is hard-capped at 25 results with no Load more option. "big screen" hits the cap exactly, silently cutting off additional records. Fix: add offset/cursor to search endpoint + Load more button in search mode. Server: `GET /search` needs `offset` param. Client: `searchShipmentsAction` + `handleSearchChange` in shipments/page.tsx. |
| BL-02 | Search debounce — excessive repeated API calls | Identified during PG-07 search test | 8 requests fired for a single "big screen" query. Debounce is 300ms — consider increasing to 500ms to reduce noise. Low impact but adds unnecessary server load. |

---

## DEFERRED (by design)

| # | Item | Context | Notes |
|---|---|---|---|
| D-01 | Token auto-refresh on 401 — force getIdToken(true) on failed API call | Identified from auth/id-token-expired error in session | Firebase onIdTokenChanged handles normal refresh. Belt-and-suspenders: catch 401 from af-server, force refresh token, retry once. Not urgent — only manifests after long idle sessions. |
| D-02 | customer_reference field — schema migration + restore in INSERT | Identified in v2.56 schema sweep | Field was removed as ghost column (not in create_schema.py). Legitimate operational field that users enter in BL upload form. Needs ALTER TABLE + restore in create_from_bl INSERT. |
| D-03 | Route card port names showing dashes on all V1 migrated records | Identified from completed tab snapshot | origin and destination labels set to port_un_code only (e.g. CNSHK, MYPKG) in toShipmentOrder(). Port name lookup not happening at list level — only on detail page. Wider scope than initially thought — affects all 2,020 completed records in list. |
