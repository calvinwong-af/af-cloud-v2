# AF Dev Handover — Session End
**Date:** 2026-03-10
**Session:** 79
**Version Live:** v5.69 (no new deployment this session)
**Last Prompt Executed:** v5.76 (complete) — v5.77 written, pending Opus execution
**Tests:** v2.61 — 272/286 (unchanged)

---

## What Was Done This Session

### Design — Transport module table naming

After v5.76 built the transport pricing module using `transport_rate_cards` /
`transport_rates`, a design review confirmed the three-type transport architecture:

| Type | Table prefix | Dimensions | Status |
|---|---|---|---|
| Port pickup/delivery | `port_transport_` | port + area + vehicle type | Current build |
| General delivery | `gen_transport_` | origin area + destination area + vehicle type | Future |
| Cross-border | `cb_transport_` | origin area + destination area + vehicle type | Future |

**Decision:** Three separate table pairs, each self-contained. No unified table with
discriminator column — clean separation per type.

**Naming rationale:**
- `freight_rate_cards` rejected — "freight" connotes ocean/air (FCL/LCL already use this)
- `drayage` / `haulage` rejected — synonymous with container movement, not general trucking
- `port_transport_rate_cards` chosen — unambiguous, clearly port-to-area scope
- `gen_transport_` and `cb_transport_` reserved for future types

### Migration 026 rewritten
- Updated `af-server/migrations/026_transport_pricing.sql` with new table names:
  `port_transport_rate_cards` + `port_transport_rates`
- Old `transport_rate_cards` / `transport_rates` tables were created from the previous
  026 run but are **empty** — need to be dropped and recreated (handled in v5.77 prompt)

### v5.77 — Rename transport → port_transport (prompt written, not yet executed)
Covers:
- Drop old empty tables + recreate from updated migration 026
- Rename `transport.py` → `port_transport.py`, API prefix `/transport` → `/port-transport`
- Dashboard summary key `"transportation"` → `"port-transport"`
- All frontend files: `_transport-*` → `_port-transport-*`
- All action/type names: `Transport*` → `PortTransport*`
- Migration script `migrate_transport_pricing.py` table name references updated
- `/pricing/transportation` URL and `PRICING_COMPONENTS` entry unchanged

### Migration script written
- `af-server/scripts/migrate_transport_pricing.py` — written but **not yet run**
- Still references old table names (`transport_rate_cards`) — will be updated by v5.77
- Run dry run after v5.77 completes to verify counts before live migration

---

## Immediate Next Steps (Next Session)

1. **Execute v5.77** via Opus — rename throughout codebase
2. **Verify** — `GET /api/v2/pricing/port-transport/vehicle-types` and areas endpoints
3. **Dry run migration script** — `.venv\Scripts\python scripts\migrate_transport_pricing.py --dry-run`
4. **Check vehicle type mapping output** — confirm legacy tonnage integers map correctly to `vehicle_type_id` values in DB
5. **Live migration** — once dry run counts look correct
6. **Deploy** — migration 026 (prod) + backend + frontend

---

## Known Deferred Items

- **PR-02** — Orphan open-ended supplier rows migration cleanup (broader script deferred)
- **PR-03** — `expiring_soon` dashboard query overcounts (do not touch until scoped)
- **PR-01** — Surcharge model clarification — review before Quotation
- **UI-17** — Per-user default country preference
- **TD-02** — Drop deprecated flat surcharge columns from FCL/LCL tables
- **gen_transport module** — type 1 general delivery, no legacy data, future scope
- **cb_transport module** — type 3 cross-border, no legacy data, future scope
- **Quotation workstream** — after port_transport complete
- **Operations Playbook** — deferred (Jermaine to participate)
- **AI agent phases** — deferred until core platform complete

---

## Migrations State

| # | File | Local | Prod |
|---|---|---|---|
| 020–025 | All migrations | ✅ | ✅ |
| 026 | `026_transport_pricing.sql` (rewritten) | ⚠️ Old tables exist, need drop+recreate | ⏳ Pending |

---

## Transport Architecture Decisions (Locked)
- Three separate table pairs: `port_transport_`, `gen_transport_`, `cb_transport_`
- Rate structure identical across all three (trucking charges only — list price, cost, min prices, surcharges)
- Other cost components (customs, duties etc.) handled by separate modules
- `port_transport_rate_cards` card key format: `port_un_code:area_id:vehicle_type_id`

## Architecture Reminders
- `shipments.etd` / `shipments.eta` deprecated; POL/POD task legs are source of truth
- BC writes scheduled timing only; BL/AWB writes actual timing only
- Forward-only status progression
- All shipment records use `AF-` prefix; `AFCQ-` retired
- af-web (Vue public site) parked indefinitely
- Scenario 4 alert = card-level logic (locked in v5.74)
