# AF Dev Handover — Session 67 End
**Date:** 2026-03-09
**Version Live:** v5.55
**Last Prompt Executed:** v5.57 (completed)
**Tests:** v2.61 — 272/286 (unchanged this session)

---

## What Was Done This Session

### Legacy Reference Files Added
- `claude/legacy-reference/af-team-af-cloud-webserver-2999c133ea36/` — full Flask/Datastore backend
- `claude/legacy-reference/af-team-af-cloud-webapp-fdcc08416c3d/` — full Vue.js frontend
- Key file reviewed: `model/pricing/pricing_port_charges_model.py` — confirmed legacy customs charges (`PricingCustomsCharges`) are keyed by `port_un_code + transaction_type + container_load`, NOT by country. This invalidated the original `customs_rates.country_code` design.

### Migration 022 Created (MCP direct)
- `af-server/migrations/022_customs_port_code.sql`
- Drops `country_code` from `customs_rates`, adds `port_code VARCHAR(10) NOT NULL REFERENCES ports(un_code)`
- Drops and recreates unique constraint: `(port_code, trade_direction, shipment_type, charge_code, effective_from)`
- Table was empty on prod — safe, no data migration needed
- **Status: written, NOT yet run on prod**

### Prompt v5.57 Revised & Executed
PROMPT-CURRENT.md was rewritten to include migration 022 + customs schema fix as Part 1, then filter standardisation as Parts 2–4. Opus completed all parts. See prompt log for full detail.

**v5.57 final scope:**
1. Migration 022 run locally — `customs_rates` schema corrected to `port_code`
2. `customs.py` — `country_code` → `port_code` throughout
3. `pricing.ts` — `CustomsRate` interface + actions updated
4. `_thc-table.tsx` — full PortCombobox filter standardisation (Country → Port → Direction + text bar)
5. `_customs-table.tsx` + `_customs-modal.tsx` — identical pattern, `country_code` → `port_code`

---

## Current State

### Migrations
| # | File | Local | Prod |
|---|---|---|---|
| 018 | `018_...` | ✅ | ✅ |
| 019 | `019_...` | rolled back | safe to skip |
| 020 | `020_...` | ✅ | ✅ |
| 021 | `021_thc_customs_rates.sql` | ✅ | ✅ |
| 022 | `022_customs_port_code.sql` | ✅ | ⚠️ NOT YET RUN |

### Active Prompt
PROMPT-CURRENT.md — v5.57 is the last completed prompt. No new prompt written. File contains completed v5.57 content (can be overwritten).

---

## Immediate Next: Legacy Data Migration (Datastore → PostgreSQL)

**Goal:** Migrate legacy `PricingLocalCharges` and `PricingCustomsCharges` data from Google Cloud Datastore into the new `thc_rates`/`customs_rates` PostgreSQL tables.

### Key legacy model facts (from `pricing_port_charges_model.py`):
**PricingLocalCharges (kind: `PT-LOCAL-CHARGES`)**
- Fields: `pt_id`, `pt_group`, `code`, `description`, `port_type` (SEA/AIR), `port_un_code`, `transaction_type` (IMPORT/EXPORT), `container_load` (FCL/LCL/AIR or `*`), `container_size` (e.g. 20/40 or `*`), `container_type` (GP/HC/RF or `*`), `is_domestic`, `is_international`, `trash`
- Rates stored separately in `PTMonthlyRatePortCharges` kind, keyed by `PT-LOCAL-CHARGES+{MON-YYYY}+{pt_id}`
- Rate fields: `uom`, `currency`, `price.price`, `price.min_price`, `cost.cost`, `cost.min_cost`, `roundup_qty`, `conditions.paid_with_freight`
- Monthly rate structure — NOT a flat effective_from/to design like af-server

**PricingCustomsCharges (kind: `PT-CUSTOMS-CHARGES`)**
- Fields: `pt_id`, `pt_group`, `code`, `description`, `port_type`, `port_un_code`, `container_load` (FCL/LCL/AIR or `*`), `transaction_type`, `is_domestic`, `is_international`, `trash`
- Rates same monthly structure as local charges
- `get_pt_group`: `port_un_code:transaction_type:container_load`

### Migration strategy to design in next session:
- Local charges map to a **new table** (not `thc_rates` — different structure: has container_size, container_type, is_domestic, conditions.paid_with_freight, wildcard `*` matching)
- Customs charges map to `customs_rates` — but monthly rate structure needs to be flattened to effective_from/to rows
- THC (Terminal Handling Charges) is a **new concept** in af-server — legacy had no direct THC table; THC was bundled into local charges
- Need to decide: do we create a separate `local_charges` table, or fold into `thc_rates` with additional columns?

### Legacy data access:
- GCP project: `cloud-accele-freight`
- Datastore can be exported or queried via `google-cloud-datastore` Python client
- Service account JSON available in legacy repo: `cloud-accele-freight-b7a0a3b8fd98.json`
- Also check `legacy-reference` for any existing export scripts

---

## Backlog / Deferred
- BL-01 Search Pagination — completed v4.22
- BL-03 Transport Card Inline Edit — completed v4.24
- Ground transportation design — not yet scoped
- Geography → Pricing → Quotation workstream — pricing module in progress
- Operations Playbook — deferred (Jermaine to participate)
- AI agent phases — deferred until core platform complete
- Prod/dev Google Maps API key separation — deferred

---

## Architecture Reminders
- `shipments.etd` / `shipments.eta` deprecated; POL/POD task legs are source of truth
- BC writes scheduled timing only; BL/AWB writes actual timing only
- Forward-only status progression
- All shipment records use `AF-` prefix; `AFCQ-` retired
- af-web (Vue public site) parked indefinitely
