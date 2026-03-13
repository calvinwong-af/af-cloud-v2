# AF Handover — Session 120 End | v6.39 | 2026-03-13

## Session Header
**AF Dev — Session 120 | AcceleFreight v2 | v6.38 Live | v6.39 Prompt Complete | Tests v2.61 (272/286)**

---

## What Was Done This Session

### Bug Fix — CompanyTable overflow clipping actions menu
- **File:** `af-platform/src/components/companies/CompanyTable.tsx`
- **Problem:** Actions menu (⋮) was clipped off-screen when the sidebar was open. `min-w-max` on the table prevented `overflow-x-auto` from ever activating — the ancestor flex container had no `min-w-0` constraint.
- **Fix:**
  - Added `min-w-0` to outer wrapper `div` — critical to enable horizontal scroll in flex/grid context
  - Replaced `min-w-max` with `style={{ minWidth: '820px' }}` — concrete minimum triggers scroll at right breakpoint
  - Added `whitespace-nowrap` to actions `<td>` — prevents button from being compressed to zero width
  - Added explicit column width classes to `<Th>` headers
- **Status:** Direct MCP edit — no Opus needed. ✅

### Confirmed — `companies.preferred_currency` exists
- Screenshots from Calvin confirmed the `CURRENCY` column is already visible in the Companies list UI
- Column name: `preferred_currency` on `companies` table
- No migration needed for quotation currency resolution

### v6.39 — Quotation Pricing Engine (Backend)
- **File modified:** `af-server/routers/quotations.py`
- **Status:** Opus complete ✅ — py_compile passes

**New endpoints added:**

| Endpoint | Description |
|---|---|
| `POST /quotations/{ref}/calculate` | Pricing engine — resolves all rate components, writes `quotation_line_items` |
| `GET /quotations/{ref}/line-items` | Returns all line items with computed effective values + totals summary |
| `POST /quotations/{ref}/line-items` | Add manual line item (always `is_manual_override = TRUE`) |
| `PATCH /quotations/{ref}/line-items/{id}` | Edit any line item (auto-sets `is_manual_override = TRUE`) |
| `DELETE /quotations/{ref}/line-items/{id}` | Hard delete any line item |

**`POST /quotations` updated:** Now inserts `currency` column (currently hardcoded `'MYR'` — see known issue below).

**Engine resolves 7 component types:**
- `ocean_freight` — FCL (per container, with surcharges) or LCL (W/M quantity, min_quantity applied)
- `air_freight` — tier-based on chargeable_weight, min_cost/min_price applied
- `export_local` / `import_local` — from `local_charges`, skips `paid_with_freight = TRUE`
- `export_customs` / `import_customs` — from `customs_rates` by port_code + direction
- `export_haulage` / `import_haulage` — FCL only, with supplier rebate + depot gate fee
- `export_transport` / `import_transport` — LCL/Air, per trip

**Key implementation details:**
- `_get_conversion_factor()` helper: queries `currency_rates` by base/target/date, returns 1.0 on miss — never raises
- Recalculate is idempotent: deletes non-manual rows, re-inserts; manual overrides (`is_manual_override = TRUE`) are preserved
- Effective values computed at read time: `max(qty × per_unit, min_price)` — never stored
- `scope_snapshot` keys drive component inclusion: `first_mile`/`last_mile` = `ASSIGNED` triggers haulage/transport
- Local charges included for both directions unconditionally (not scope-gated — by design)
- Customs gated on `export_clearance`/`import_clearance` = `ASSIGNED` in scope
- Haulage: wildcard container size fallback if exact size card not found
- Surcharges from JSONB: price surcharges from list price row, cost surcharges matched by code from supplier row
- `sort_order` values: freight=10, export_local=20, import_local=21, export_customs=30, import_customs=31, export_haulage=40, import_haulage=41, export_transport=42, import_transport=43, manual=99

**Known issue — currency not resolved from company:**
```python
# In POST /quotations, Opus left:
currency = "MYR"  # hardcoded — preferred_currency join not implemented
```
Fix needed: join `orders → companies` to get `preferred_currency`. Small fix — can be done as direct MCP edit in Session 121 before running v6.40, or included in the v6.40 prompt as a pre-task.

---

## Current State

### Live (v6.38)
- All pricing modules: FCL, LCL, Air, Haulage, Ground Transport, Local Charges, Customs
- Quotation create/list/detail — basic CRUD
- Quotation modal — scope + transport details, 2-step flow

### Complete but not yet deployed (v6.39)
- Pricing engine backend — all endpoints in `quotations.py`
- Needs deploy to Cloud Run before frontend can call it

### Next prompt ready
- **PROMPT-CURRENT.md** contains v6.39 (already run) — needs to be cleared/replaced with v6.40

---

## Immediate Next Actions (Session 121)

### 1. Fix currency resolution in `POST /quotations` (MCP direct edit)
In `af-server/routers/quotations.py`, replace the hardcoded `currency = "MYR"` with:
```python
# Resolve company currency
company_row = conn.execute(
    text("""
        SELECT c.preferred_currency
        FROM orders o
        JOIN companies c ON c.id = o.company_id
        WHERE o.order_id = :sid
    """),
    {"sid": body.shipment_id},
).fetchone()
currency = (company_row[0] or "MYR") if company_row else "MYR"
```
*(Verify FK column name — may be `company_id` or `company_ref` on `orders` table.)*

### 2. Deploy v6.39
Push to main → Cloud Build → Cloud Run (asia-northeast1). Verify `POST /quotations/{ref}/calculate` responds.

### 3. Write and run v6.40 — Quotation Detail Frontend
The quotation detail page (`/quotations/[ref]`) needs to be extended with:
- **Calculate button** — calls `POST /quotations/{ref}/calculate`, refreshes line items
- **Line items table** — grouped by component_type, columns: description, charge code, UOM, qty, price/unit, cost/unit, effective price, effective cost, margin %
- **Totals bar** — total price, total cost, overall margin
- **Manual add** — modal or inline form to add a manual line item
- **Edit/delete** — inline edit on any row (PATCH), delete button
- **Scope changed warning** — if `scope_changed = TRUE` on quotation, show banner prompting recalculate
- **Warnings display** — surface any warnings returned from calculate endpoint

---

## Schema Reference (key tables)

### `quotations` (migration 046 + 048 additions)
```
id UUID PK
quotation_ref VARCHAR  -- AFQ-00000001
shipment_id UUID FK → orders
status VARCHAR DEFAULT 'DRAFT'
revision INTEGER
scope_snapshot JSONB
transport_details JSONB
notes TEXT
currency VARCHAR(3) DEFAULT 'MYR'        -- added migration 048
scope_changed BOOLEAN DEFAULT FALSE      -- added migration 048
created_by VARCHAR
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### `quotation_line_items` (migration 048)
```
id SERIAL PK
quotation_id UUID FK → quotations(id) ON DELETE CASCADE
component_type VARCHAR(40)
charge_code VARCHAR(20)
description VARCHAR(255)
uom VARCHAR(20)
quantity NUMERIC(12,4)
price_per_unit NUMERIC(12,4)
min_price NUMERIC(12,4)
price_currency VARCHAR(3)
price_conversion NUMERIC(14,6) DEFAULT 1
cost_per_unit NUMERIC(12,4)
min_cost NUMERIC(12,4)
cost_currency VARCHAR(3)
cost_conversion NUMERIC(14,6) DEFAULT 1
source_table VARCHAR(60) NULL
source_rate_id INTEGER NULL
is_manual_override BOOLEAN DEFAULT FALSE
sort_order INTEGER DEFAULT 0
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### `currency_rates` (migration 047)
```
id SERIAL PK
base_currency VARCHAR(3)
target_currency VARCHAR(3)
rate NUMERIC(14,6)
effective_from DATE
notes TEXT
created_at / updated_at TIMESTAMPTZ
```
20 pairs seeded at effective_from = 2026-01-01 (legacy Datastore migration).

---

## File Index

| File | Status |
|---|---|
| `af-server/routers/quotations.py` | v6.39 — pricing engine complete |
| `af-server/migrations/046_quotations.sql` | Live — base quotations table |
| `af-server/migrations/047_currency_rates.sql` | Live — currency_rates table |
| `af-server/migrations/048_quotation_line_items.sql` | Live — line items + quotations.currency/scope_changed |
| `af-server/scripts/migrate_currency_rates.py` | Run — 20 pairs inserted |
| `af-platform/src/app/(platform)/quotations/[ref]/page.tsx` | v6.38 — detail page (no line items yet) |
| `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx` | v6.38 — QuotationDetail client component |
| `af-platform/src/app/actions/quotations.ts` | v6.38 — getQuotationAction, listAllQuotationsAction |
| `af-platform/src/components/companies/CompanyTable.tsx` | Session 120 fix — overflow scroll |
| `claude/prompts/PROMPT-CURRENT.md` | Contains v6.39 (already run) — replace with v6.40 |

---

## Tests
- **Version:** v2.61
- **Passing:** 272/286
- **No changes to tests this session**

---

## Key Patterns / Reminders
- `CAST(:x AS jsonb)` + `bindparam(type_=String())` — required for all JSONB inserts (pg8000 Cloud Run compat)
- `Array.from(new Set(...))` not `[...new Set()]` — TS downlevelIteration issue in Next.js build
- `str_replace` unreliable on paths with `(platform)` — use `write_file` rewrite
- All migrations run against prod only via Cloud SQL Auth Proxy (`tools\start-proxy.bat`)
- Migration files never include `BEGIN`/`COMMIT`
- Prompt log is Opus's responsibility — never pre-populate
- Session startup: load latest handover + `AF-Test-Master.md` + prompt log tail + relevant `claude/other/` files in single `read_multiple_files` call
