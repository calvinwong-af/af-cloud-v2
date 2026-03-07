# Session 41 Handover — AcceleFreight v2
**Date:** 2026-03-07
**Version:** v5.07 Live (not yet deployed) | v5.08 Prompt Ready
**Tests:** 279/299 (unchanged — no new prompts executed this session)
**Session Type:** Design — Pricing Module Phase 1 scoping + Prompt v5.08 written

---

## Session Work

### Legacy Study — `financial_components.py`
Read the full legacy quotation assembly file. Key findings documented:
- Quotation builds components domain by domain: freight → local charges → customs → DG → haulage/transport → insurance → storage → other
- Rate lookup pattern is identical across all domains: find by lane key, then `effective_from DESC LIMIT 1`
- Markup logic is computed at quotation time (`max(company_markup, cost)`) — not stored in rate cards
- Minimum price enforcement: if `qty × per_unit < min_price`, override to `min_price` at qty=1
- `paid_with_freight` (PWF) flag on local charges — included even when AF is not responsible
- Transport tonnage brackets — full bracket list returned, applicable bracket selected by quantity

### Legacy Study — Real Air Freight Rate Sheets (4 PDFs)
Studied actual supplier quotation sheets (Transcargo Worldwide, KUL→BNE/KGL/BOM/SZX). Key findings:
- Rate card key for air = `origin:dest:dg_class:airline_code:service_tier`
- Multiple airlines per lane, each is a distinct product (not just a cost source)
- Service tiers on same airline (Normal/PRO, Normal/Priority, Normal/Swiftrider)
- Weight brackets (up to 7) are part of the rate card structure — not all airlines use all brackets
- Surcharges (FSC, SSC, MSC) are per-airline, not per-lane
- Minimum charge = flat AWB amount (not per-kg floor)
- Validity has explicit `valid_until` dates (not just open-ended effective dates)

### Pricing Module — Design Decisions (Locked)

**Separate tables for FCL, LCL, Air** — confirmed. Each has a structurally different rate card key and rate row.

**Air freight deferred** — too complex for Phase 1. Requires its own design session.

**Phase 1 scope: FCL + LCL freight rate cards only**

**FCL rate card key:** `origin:dest:dg_class:container_size:container_type`
- Rated per equipment type (20GP, 40HC etc.)
- Quantity at quotation time = number of containers

**LCL rate card key:** `origin:dest:dg_class`
- Rated by cargo weight/volume
- UOM standardised to `W/M` (Weight/Measurement = Revenue Tonne, synonymous terms)
- Quantity at quotation time = max(gross weight tonnes, CBM)

**Migration approach:**
- Rate card definitions: all active (non-trashed) records from Datastore
- Rate history: Jan 2024 onwards only
- Month-year → effective_from conversion: `"JAN-2024"` → `2024-01-01` (first of month)
- `is_price=True` → `supplier_id=NULL` (price reference row)
- **Option A migration**: copy all monthly records as-is, no deduplication
- **Cleanup script**: separate deduplication pass to run after migration verified

---

## Prompt v5.08 — Ready for Opus

**File:** `claude/prompts/PROMPT-CURRENT.md`

**Deliverables:**
1. `af-server/scripts/create_schema.py` — `rate_status` enum + `fcl_rate_cards` + `fcl_rates` + `lcl_rate_cards` + `lcl_rates` tables + indexes
2. `af-server/scripts/migrate_pricing_freight.py` — Datastore → PostgreSQL migration (`--dry-run` flag)
3. `af-server/scripts/cleanup_pricing_duplicates.py` — post-migration deduplication script (`--dry-run` flag)
4. `af-server/routers/pricing/__init__.py` — pricing router package
5. `af-server/routers/pricing/fcl.py` — 7 FCL endpoints
6. `af-server/routers/pricing/lcl.py` — 7 LCL endpoints
7. `af-server/main.py` — pricing router registered at `/api/v2/pricing`

**af-platform:** Deferred — prototype/mockup session first

---

## Pending Work Queue

### Immediate (next session)
1. **Run Opus on v5.08 prompt** — being run simultaneously this session
2. **Deploy af-server + af-platform** — Sessions 38 + 39 fixes still pending:
   - Status 1002 distinct string mapping (`constants.py`, `types.ts`)
   - Upload Document button visibility fix (`page.tsx`)
   - `order_type` overwrite bug fix (`db_queries.py`)
   - Full v5.07 scope redesign
3. **Run prod backfill** after deploy: `backfill_scope_from_tasks.py` on prod DB
4. **Smoke test after deploy** (see Session 39 handover for full checklist)
5. **Review v5.08 Opus output** — verify schema, migration scripts, router

### After v5.08 verified
6. **Run migration locally:** `migrate_pricing_freight.py --dry-run` first, then full run
7. **af-platform pricing UI** — prototype/mockup design session before building

### Backlog (active)
- Delete retired route stubs: `shipments/` and `ground-transport/`
- Route migration: `shipments/[id]` → `orders/shipments/[id]`, `ground-transport/[id]` → `orders/deliveries/[id]`
- GT smoke tests: GT-10 through GT-13 (6 PENDING)

### Deferred
- Air freight rate cards — separate design session required
- Quotation engine integration (Phase 2 — after all rate card domains complete)
- `/orders/haulage` page design
- Ground transportation design
- Operations Playbook (Jermaine)
- AI agent phases (all post-core)

---

## Pricing Module — Phase 1 Todo (updated)

### Schema & Migration
- [ ] Create `rate_status` enum in PostgreSQL ← v5.08
- [ ] Create `fcl_rate_cards` table ← v5.08
- [ ] Create `fcl_rates` table with indexes ← v5.08
- [ ] Create `lcl_rate_cards` table ← v5.08
- [ ] Create `lcl_rates` table with indexes ← v5.08
- [ ] Migration script — FCL & LCL rate card definitions ← v5.08
- [ ] Migration script — FCL & LCL rates (Jan 2024+, Option A no dedup) ← v5.08
- [ ] Cleanup script — deduplication (run after migration verified) ← v5.08
- [ ] Run migration on local DB (post v5.08 Opus)
- [ ] Run migration on prod DB (after local verified)

### af-server
- [ ] Pricing router package skeleton ← v5.08
- [ ] FCL rate card + rate endpoints (7) ← v5.08
- [ ] LCL rate card + rate endpoints (7) ← v5.08
- [ ] Register in main.py ← v5.08

### af-platform
- [ ] Deferred — prototype/mockup session first

### Testing
- [ ] New test series `PR` — FCL and LCL smoke tests

### Deferred
- [ ] Air freight — separate design session
- [ ] Quotation engine integration (Phase 2)

---

## Key Architecture — Pricing

### Effective-date query pattern (universal)
```sql
WHERE rate_card_id = $1
  AND supplier_id = $2        -- NULL for price reference row
  AND effective_from <= $ref_date
ORDER BY effective_from DESC
LIMIT 1
```

### FCL rate card key format
`{origin_port_code}:{destination_port_code}:{dg_class_code}:{container_size}:{container_type}`
Example: `CNSHA:MYKUL:NON-DG:20:GP`

### LCL rate card key format
`{origin_port_code}:{destination_port_code}:{dg_class_code}`
Example: `CNSHA:MYKUL:NON-DG`

### Price reference row
`supplier_id = NULL` — ceiling price for customer markup calculation
Customer price = `max(company_markup_rate, cost_per_unit)`

### Negative rates are valid
Carrier rebates can produce negative cost values (e.g. -133/WM). Store and display as-is.

### ON_REQUEST status
Rate card exists but rate is unpublished. Must be confirmed by staff before quoting.
Stored as `rate_status = 'ON_REQUEST'` — not as zero or null.

---

## Sessions 38+39 Fixes Still Needing Deploy
- `constants.py` — Status 1002 distinct string mapping
- `db_queries.py` — `order_type` overwrite bug fix
- `types.ts` — `normalizeStatusToNumeric` fix
- `page.tsx` — Upload Document visibility fix
- v5.07 scope redesign (full backend + frontend)
- Prod backfill: `backfill_scope_from_tasks.py` (run after deploy)

---

## File Locations
- Active prompt: `claude/prompts/PROMPT-CURRENT.md` (v5.08 — ready for Opus)
- Prompt log: `claude/prompts/log/PROMPT-LOG-v5.00-v5.10.md`
- Tests master: `claude/tests/AF-Test-Master.md`
- Backlog: `claude/other/AF-Backlog.md`
- Legacy reference: `claude/legacy-reference/` (gitignored)
- Pricing schema (new): `af-server/scripts/create_schema.py` (after v5.08)
- Pricing router (new): `af-server/routers/pricing/` (after v5.08)
- Migration script (new): `af-server/scripts/migrate_pricing_freight.py` (after v5.08)
- Cleanup script (new): `af-server/scripts/cleanup_pricing_duplicates.py` (after v5.08)
