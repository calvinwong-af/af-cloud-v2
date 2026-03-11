# AF Dev — Session End Handover
**Session:** 96
**Date:** 2026-03-11
**Version Live:** v5.69
**Last Prompt Executed:** v5.97
**Prompt Ready (not yet executed):** v5.98
**Tests:** v2.61 — 272/286 passing (unchanged — no new test coverage this session; design session only)

---

## What Happened This Session

### v5.97 Confirmed Complete (Opus)

Created `af-server/migrations/037_haulage_pricing.sql` — three tables:
- `haulage_rate_cards` — port + area + container_size dimension, `side_loader_available` flag, `include_depot_gate_fee` flag
- `haulage_rates` — perpetual effective_from rate rows, `surcharges` JSONB (FAF + toll fee), `side_loader_surcharge` dedicated column
- `port_depot_gate_fees` — port-level depot gate fee, terminal override pattern

Migration **not yet applied to prod** — Calvin applies manually.

---

## Haulage Pricing Module — Design Decisions (All Confirmed This Session)

This was a pure design session establishing the schema for the haulage pricing module. All decisions below are confirmed and locked.

### Tables in scope

| Table | Migration | Status |
|---|---|---|
| `haulage_rate_cards` | 037 | ✅ Created, not applied |
| `haulage_rates` | 037 | ✅ Created, not applied |
| `port_depot_gate_fees` | 037 | ✅ Created, not applied |
| `haulage_supplier_rebates` | 038 | 🟡 Prompt ready, not executed |

### Key design decisions

**Rate card structure:**
- `haulage_rate_cards` is fully separate from `port_transport_rate_cards` — different products
- Third dimension is `container_size` (not `vehicle_type_id`): `20 | 40 | 40HC | wildcard`
- `wildcard` = applies to all sizes; rate resolution checks exact size first, falls back to wildcard
- `side_loader_available` BOOLEAN on rate card — capability of the route, set at card creation
- `include_depot_gate_fee` BOOLEAN on rate card — on/off switch for DGF lookup

**Five haulage charge components (legacy codes preserved):**

| Code | Description | v2 Location |
|---|---|---|
| HA-RAT | Haulage rate | `haulage_rates.list_price` / `cost` |
| HA-FAF | Fuel adjustment factor | `haulage_rates.surcharges` JSONB |
| HA-TOL | Toll fee | `haulage_rates.surcharges` JSONB |
| HA-SDL | Side-loader surcharge | `haulage_rates.side_loader_surcharge` (dedicated column) |
| HA-DGF | Depot gate fee | `port_depot_gate_fees.fee_amount` (separate table) |

**Side-loader design:**
- `side_loader_available = TRUE` on rate card + `side_loader_surcharge IS NULL` on active rate row → treat as ON REQUEST, do not silently skip
- Side-loader surcharge is a **dedicated column**, not JSONB — it is conditional and must be individually addressable by quotation engine

**Depot gate fee (`port_depot_gate_fees`):**
- Port-level charge, no `supplier_id` — it is a port tariff, not a supplier rate
- `terminal_id` nullable — terminal-specific fee overrides port-level fallback
- Resolution query: `ORDER BY terminal_id NULLS LAST, effective_from DESC LIMIT 1`
- Accessed via **badge on haulage rate card row** (Option B) — not a standalone page
- Badge shows current active DGF amount; clicking opens inline modal to view/edit
- Edit from any rate card at that port updates the shared record — modal must show notice: *"This fee applies to all haulage rate cards at [PORT] with depot gate fee enabled"*
- `include_depot_gate_fee = FALSE` → no badge shown, no lookup at quotation time

**Supplier rebate (`haulage_supplier_rebates`):**
- Malaysian FF agent model — hauliers give AF a standard percentage rebate off cost
- `rebate_percent NUMERIC(5,4)` — percentage, not fixed amount; no currency column
- Applies to **cost side only** — never visible to customer, never affects list price
- Varies by `supplier_id` + `container_size`
- `container_size` enum extended for side-loader variants: `20 | 40 | 40HC | side_loader_20 | side_loader_40 | side_loader_40HC`
- At quotation: if side-loader requested → look up `side_loader_XX` key; otherwise standard key
- `supplier_id` is a **hard FK to `companies(id)` ON DELETE RESTRICT** — confirmed design principle: a rate without a verified supplier is not a real rate
- Lives on supplier/company profile page in UI (not haulage pricing page) — supplier-level agreement, not route-level

**Hard FK principle (confirmed this session):**
- New haulage tables (`037`, `038`) use hard FK `REFERENCES companies(id) ON DELETE RESTRICT` for `supplier_id`
- Existing pricing tables (`port_transport_rates`, `fcl_rates`, `lcl_rates` etc.) currently use soft references — retrofitting these is a **backlog item for a future session**

**Effective cost formula (quotation engine reference):**
```
Effective cost =
  haulage_rates.cost
  - (haulage_rates.cost × haulage_supplier_rebates.rebate_percent)
  + toll_fee (surcharges JSONB)
  + faf (surcharges JSONB)
  + side_loader_surcharge (if requested)
  + port_depot_gate_fees.fee_amount (if include_depot_gate_fee = TRUE)

List price (customer-facing) =
  haulage_rates.list_price
  + toll_fee (surcharges JSONB)
  + side_loader_surcharge (if requested)
  + port_depot_gate_fees.fee_amount (if include_depot_gate_fee = TRUE)
  ← rebate never appears here
```

---

## Immediate Next Steps

1. **Run v5.98 in Opus** — creates `038_haulage_supplier_rebates.sql`
2. **Apply migrations 037 + 038 to prod** — Calvin runs manually via psycopg2 autocommit
3. **Next session: UI sweep** — review existing pricing UI patterns against the new haulage module; identify what needs to be built and what can be reused from `port_transport` UI components

---

## Backlog Items Added This Session

- **Retrofit hard FK on existing pricing tables** — `port_transport_rates`, `fcl_rates`, `lcl_rates` and other tables with `supplier_id` as soft reference should be migrated to `REFERENCES companies(id) ON DELETE RESTRICT`. Track as a dedicated migration (039 or later). Not urgent — application layer currently enforces this.

---

## Deferred (unchanged from previous session)

- Haulage data migration from Datastore (requires 037 + 038 applied first)
- Quotation module (next major workstream after pricing stabilises)
- Gen transport (area-to-area domestic) + cross-border transport — schema ready, no data
- Operations Playbook
- AI agent phases
- TD-02: drop deprecated flat surcharge columns
- UI-17: per-user country preference

---

## Files Modified This Session

| File | Change |
|---|---|
| `af-server/migrations/037_haulage_pricing.sql` | New — haulage_rate_cards, haulage_rates, port_depot_gate_fees |
| `claude/prompts/PROMPT-CURRENT.md` | v5.98 written and ready |
