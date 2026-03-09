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
PROMPT-CURRENT.md was rewritten to include migration 022 + customs schema fix as Part 1, then filter standardisation as Parts 2–4. Opus completed all parts.

**v5.57 final scope:**
1. Migration 022 run locally — `customs_rates` schema corrected to `port_code`
2. `customs.py` — `country_code` → `port_code` throughout
3. `pricing.ts` — `CustomsRate` interface + actions updated
4. `_thc-table.tsx` — full PortCombobox filter standardisation
5. `_customs-table.tsx` + `_customs-modal.tsx` — identical pattern, `country_code` → `port_code`

---

## Backlog / Deferred
- Ground transportation design — not yet scoped
- Geography → Pricing → Quotation workstream — pricing module in progress
- Operations Playbook — deferred (Jermaine to participate)
- AI agent phases — deferred until core platform complete

---

## Architecture Reminders
- `shipments.etd` / `shipments.eta` deprecated; POL/POD task legs are source of truth
- BC writes scheduled timing only; BL/AWB writes actual timing only
- Forward-only status progression
- All shipment records use `AF-` prefix; `AFCQ-` retired
- af-web (Vue public site) parked indefinitely
