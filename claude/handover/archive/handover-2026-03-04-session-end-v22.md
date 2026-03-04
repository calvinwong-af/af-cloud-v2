# Session Handover — Session 22 → Session 23
**Date:** 04 March 2026
**Platform:** AcceleFreight v2 (af-cloud-v2)
**Session type:** Design + Prompt Preparation (no code written this session)

---

## What Was Done This Session

This was a pure design and architecture session. No code was written or deployed.
The session established the complete Geography → Pricing → Quotation workstream
and produced a fully scoped build prompt ready for Opus.

### Design Decisions Confirmed

#### Three-Layer Model (locked)
```
Geography (Layer 1) → Pricing Tables (Layer 2) → Quotations (Layer 3)
```

#### Geography Model (locked)
- `states` — MY states + federal territories, reference data, fixed
- `cities` — last mile geographic unit; Klang Valley granular, outstation by major city
- `haulage_areas` — FCL container tariff areas, port-specific, haulier-coded (e.g. KL035)
- `ports` — existing table, extended with `lat` / `lng` columns

**Two distinct haulage models confirmed:**
1. **FCL container haulage** — port → named haulage area, uses haulier tariff codes, per container size (20GP/40GP/40HC)
2. **Last mile / LCL trucking** — port → city/state zone, per trip, per truck tonnage (1t/3t/5t/10t/20t), Klang Valley city-level, outstation state-level

#### Haulage Rate Structure (locked)
- Base rate + toll (actual at cost) + FAF % = total (from haulier tariff)
- AcceleFreight holds a contracted rebate off the haulier's published base
- Internal cost rate + sell rate stored separately — cost never exposed to customer
- Surcharges (DG, reefer, OOG, direct delivery) stored as separate table

#### Pricing Tables (locked)
**Two validity models coexist:**
- **Weekly** (`week_of` = ISO Monday): domestic haulage, last mile, THC, local surcharges, forex — volatile/fuel-linked
- **Contract period** (`valid_from` / `valid_until`): ocean freight, BAF/PSS, customs, telex, insurance — supplier-negotiated fixed terms

**Rate tables:**
- `haulage_rates` — FCL container, per area, weekly
- `transport_rates` — LCL last mile, per city, weekly, per truck size
- `rate_cards` — all other charge types, contract-period validity, JSONB rates blob
- `company_rate_overrides` — same structure as rate_cards + company_id FK
- `forex_rates` — currency_pair, rate, week_of

#### Quotations (locked)
**Charge types confirmed (all):**
Ocean freight (FCL/LCL/Air), Origin haulage/pickup (manual ad-hoc), Destination haulage
(rate card), Destination last mile trucking (rate card), Export customs, Import customs,
THC origin, THC destination, BAF/PSS/surcharges, Telex release, Insurance, DG surcharge,
Manual/miscellaneous line items

**Two line item classes:**
- Auto-populated from rate cards (domestic charges)
- Manual/ad-hoc (origin-country pickup, overseas agent costs — free text, manual amount, currency selectable per line)

**Currency rule:**
- MY-registered customers → MYR presentation
- Overseas customers → USD presentation
- Stored on company record as `default_currency`
- All line items normalised via forex table on output

**Status flow:** DRAFT → SENT → ACCEPTED / REJECTED / EXPIRED
**Quote-to-shipment:** accepted quote auto-seeds draft shipment; `quotation_id` nullable on shipment (staff can create shipment directly)

**Cross-border haulage/trucking:** parked — not in scope for quotation engine at this stage

#### Port Resolution via Claude API (new, locked)
When document parser encounters unknown port/airport code:
1. Parser returns `resolved: false` flag (not silent fail)
2. `POST /api/v2/geography/ports/resolve` — calls Claude API with the code, returns structured candidate (name, country_code, port_type, lat, lng, confidence)
3. Staff confirmation modal — editable fields, one-click insert
4. `POST /api/v2/geography/ports/confirm` — inserts to ports table, invalidates cache
**Rationale:** Claude has strong IATA/UN LOCODE knowledge; Google Maps handles coordinates and visual rendering separately

#### Google Maps Integration (new, locked)
**Three surfaces:**
1. **Geography admin** — small map preview on port/city/haulage area add/edit modals
2. **Shipment detail** — route map card (origin → destination markers + optional last mile point)
3. **Dashboard** — replace current dashboard with map-centric layout; active shipment markers by destination port; stat cards preserved below map

**Tracking live map and dashboard heatmap** — deferred to future sessions
**Quotation route map** — explicitly excluded (overkill)

**API key:** New Google Maps API key being provisioned. Required APIs: Maps JavaScript API, Places API, Geocoding API. Restrict to `appv2.accelefreight.com` + `localhost:3000`. Prompt uses `PENDING` placeholder so Opus build is not blocked.

---

## Prompt Written This Session

**PROMPT-CURRENT.md — v4.01**
`claude/prompts/PROMPT-CURRENT.md`

Four sections:
- **A** — Geography data model (states, cities, haulage_areas tables + CRUD endpoints + admin UI + seed data)
- **B** — Port resolution via Claude API (resolve + confirm endpoints + resolution modal)
- **C** — Environment variable placeholders (GOOGLE_MAPS_API_KEY = PENDING)
- **D** — Google Maps integration (MapProvider, PortMarkerMap, RouteMap, DashboardMap components)

Status: **Ready to pass to Opus. Has not been run yet.**

---

## Test Status (unchanged this session — no code)

| Suite | Total | YES | PENDING | DEFERRED | NA | Status |
|---|---|---|---|---|---|---|
| All series | 284 | 270 | 0 | 12 | 9 | — |

**Overall: 270/284 passing**
No test changes this session. New Geography/Maps tests will be added after v4.01 completes.

---

## New Test Series Needed (post v4.01)

Once Opus completes v4.01, add the following test series to AF-Test-Master.md:

| Series | Description | File |
|---|---|---|
| GEO | Geography admin — states, cities, haulage areas CRUD | series/GEO-geography.md |
| PR | Port Resolution — Claude API resolve + confirm flow | series/PR-port-resolution.md |
| MAP | Google Maps — admin preview, route map, dashboard map | series/MAP-maps.md |

---

## Open Backlog (unchanged)

| # | Item | Priority |
|---|---|---|
| UI-01 | Keyboard arrow nav on all combobox/dropdowns | Low |
| UI-02/04 | Port list filtered by freight type in PortEditModal | Low |
| UI-03 | Port edit pencil icon position on RouteCard | Low |
| UI-05 | No ability to edit order details on detail page | Medium |
| UI-09 | Read File opens legacy dialog (all doc types) | Medium |

---

## Pending Actions (in order)

1. **Provision new Google Maps API key** — enable Maps JS, Places, Geocoding APIs; restrict to correct domains; add to both `.env.local` files
2. **Run PROMPT-CURRENT.md v4.01 in Opus** — Phase 1 Geography + Port Resolution + Maps
3. **After v4.01 completes:** Add GEO, PR, MAP test series to AF-Test-Master.md
4. **After v4.01 verified:** Begin Phase 2 prompt — Pricing Tables (rate_cards, haulage_rates, transport_rates, forex_rates, company_rate_overrides)

---

## Architecture Notes

### Build Sequence Reminder
- **Phase 1 (current):** Geography — states, cities, haulage_areas, port resolution, maps
- **Phase 2 (next):** Pricing Tables — all rate tables, admin UI, weekly + contract-period validity
- **Phase 3 (after):** Quotation Engine — quote builder, customer portal, PDF, quote-to-shipment

### Key Infrastructure (unchanged)
- Production: `https://af-server-667020632236.asia-northeast1.run.app`
- Frontend: `appv2.accelefreight.com` | API: `api.accelefreight.com`
- LOCAL_DEV_SKIP_AUTH=true in af-platform .env.local for local dev
- Python venv: `.venv` (Python 3.11) — always use this, not system Python 3.14

---

## Key File Locations

| Item | Path |
|---|---|
| Current prompt | claude/prompts/PROMPT-CURRENT.md |
| Test master | claude/tests/AF-Test-Master.md |
| API contract | claude/other/AF-API-Contract.md |
| Backlog | claude/other/AF-Backlog.md |
| Geography router | af-server/routers/geography.py |
| Ports router | af-server/routers/ports.py |
| Main server | af-server/main.py |
| AI router | af-server/routers/ai.py |
| Platform types | af-platform/src/lib/types.ts |

---

## ⚠️ API Contract Session Notes

**The next session that opens AF-API-Contract.md must add the following new sections.**
These endpoints are being built by v4.01 but the contract doc has not been updated yet.

### New endpoints to document (all under `/api/v2/geography/`):

#### States
- `GET /geography/states` — list all active states
- `GET /geography/states/{state_code}` — get single state

#### Cities
- `GET /geography/cities` — list all, optional `?state_code=`
- `GET /geography/cities/{city_id}` — get single city
- `POST /geography/cities` — create (AFU only)
- `PATCH /geography/cities/{city_id}` — update name/active/lat/lng (AFU only)

#### Haulage Areas
- `GET /geography/haulage-areas` — list all, optional `?port_un_code=&state_code=`
- `GET /geography/haulage-areas/{area_id}` — get single area
- `POST /geography/haulage-areas` — create (AFU only)
- `PATCH /geography/haulage-areas/{area_id}` — update (AFU only)
- `DELETE /geography/haulage-areas/{area_id}` — soft delete (AFU only)

#### Port Resolution
- `POST /geography/ports/resolve` — AI-assisted port code lookup via Claude API (AFU only)
  - Request: `{ "code": "MUC" }`
  - Response: `{ "status": "OK", "already_exists": bool, "candidate": { un_code, name, country, country_code, port_type, lat, lng, confidence } }`
- `POST /geography/ports/confirm` — confirm and insert resolved port (AFU only)
  - Request: full port candidate object
  - Response: `{ "status": "OK", "data": { ...inserted port } }`

#### Updated Port response shape
Existing `/geography/ports` and `/geography/ports/{un_code}` responses now include:
- `lat: number | null`
- `lng: number | null`

**Standard response envelope for all new geography endpoints:**
```json
{ "status": "OK", "data": [...] }
```
**Auth:** All endpoints require auth. Write endpoints (POST/PATCH/DELETE) return 403 for AFC accounts.
