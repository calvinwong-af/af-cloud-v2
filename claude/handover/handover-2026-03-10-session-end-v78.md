# AF Dev Handover — Session End
**Date:** 2026-03-10
**Session:** 78
**Version Live:** v5.69 (no new deployment this session)
**Last Prompt Executed:** v5.76
**Tests:** v2.61 — 272/286 (unchanged)

---

## What Was Done This Session

### Design — Ground Transport Financial Module (Port-to-Area)

Spent the session scoping and designing the Transport pricing module before writing the implementation prompt. Key decisions made:

- **Scope:** Port-to-area transport only (port → city/area). Haulage deferred — easy extension once transport is built.
- **Navigation:** Transport lives under `/pricing/transportation` — unlocking the existing locked placeholder in the pricing dashboard (Option A). Consistent with FCL/LCL pattern.
- **Card key:** `port_un_code:area_id:vehicle_type_id` (e.g. `MYKLG:12:lorry_3t`). Reuses existing `areas` and `vehicle_types` tables from migrations 009–010.
- **Rate structure:** Carries over legacy `min_list_price` / `min_cost` as explicit columns (minimum billing floor, semantically distinct from LCL's `min_quantity`).
- **Surcharges:** Legacy `toll_fee` etc. fold into existing `surcharges` JSONB.
- **No month-copy feature:** `effective_from/to` model makes it unnecessary.
- **Dashboard:** Extended `dashboard_summary` to include `"transportation"` key using same 4-scenario alert logic as FCL/LCL.

### v5.76 — Transport Pricing Module (Phase 1)
- `026_transport_pricing.sql` — `transport_rate_cards` + `transport_rates` tables
- `af-server/routers/pricing/transport.py` — full CRUD, 12-month time-series, 4-scenario alerts, close_previous
- `af-server/routers/pricing/__init__.py` — transport router registered + dashboard summary extended
- `af-platform/src/app/actions/pricing.ts` — all Transport server actions + types added
- `af-platform/src/app/(platform)/pricing/transportation/page.tsx` — page shell
- `af-platform/src/app/(platform)/pricing/transportation/_transport-rate-cards-tab.tsx` — card list with port/area/vehicle filters
- `af-platform/src/app/(platform)/pricing/transportation/_transport-rate-list.tsx` — time-series rate rows
- `af-platform/src/app/(platform)/pricing/transportation/_transport-rate-modal.tsx` — rate create/edit modal (list_price, cost, min_list_price, min_cost)
- `af-platform/src/app/(platform)/pricing/_dashboard.tsx` — Transportation card unlocked
- `af-platform/src/app/(platform)/pricing/_components.tsx` — TransportRateCardsTab exported

---

## Current State

- **No active prompt** — `PROMPT-CURRENT.md` clear
- **Transport module built** — v5.76 complete, pending testing and deployment
- **Migration 026** — created, not yet run on local or prod
- **Pricing dashboard** — Transportation card now unlocked

---

## Next Steps

1. **Test v5.76** — run migration 026 locally, verify all transport endpoints and frontend
2. **Seed transport data** — areas table may need port-linked data (KLANG → Shah Alam, PJ, etc.) before cards can be created; confirm what's already seeded
3. **Deploy** — migration 026 + backend + frontend to prod once tested
4. **Haulage module** — extend from transport once transport is stable (easy carry-over)
5. **Quotation workstream** — after transport + haulage

---

## Known Deferred Items

- **PR-02** — Orphan open-ended supplier rows migration cleanup (cards 109/110 patched; broader script deferred)
- **PR-03** — `expiring_soon` dashboard query overcounts open-ended cards (do not touch until scoped)
- **PR-01** — Surcharge model clarification (list price vs supplier side) — review before Quotation
- **UI-17** — Per-user default country preference (pricing hardcodes MY)
- **TD-02** — Drop deprecated flat surcharge columns (`lss`, `baf`, `ecrs`, `psc`) from FCL/LCL tables
- **Quotation workstream** — after transport + haulage
- **Operations Playbook** — deferred (Jermaine to participate)
- **AI agent phases** — deferred until core platform complete

---

## Migrations State

| # | File | Local | Prod |
|---|---|---|---|
| 020–025 | All migrations | ✅ | ✅ |
| 026 | `026_transport_pricing.sql` | ⏳ Pending | ⏳ Pending |

---

## Architecture Reminders
- `shipments.etd` / `shipments.eta` deprecated; POL/POD task legs are source of truth
- BC writes scheduled timing only; BL/AWB writes actual timing only
- Forward-only status progression
- All shipment records use `AF-` prefix; `AFCQ-` retired
- af-web (Vue public site) parked indefinitely
- Transport card key format: `port_un_code:area_id:vehicle_type_id`
- `min_list_price` / `min_cost` on transport rates = minimum billing floor (distinct from LCL's `min_quantity`)
