# Handover — Session 122 End
**Date:** 2026-03-13
**Prompt Version at handover:** v6.41 (last prompt run) — v6.42 is next
**Tests:** v2.61 (272/286)
**Live on Cloud Run:** v6.38
**Complete, pending deploy:** v6.39, v6.40, v6.41

---

## Session Summary

Session 122 was a design/investigation session — no prompts were written or run. Work was done entirely in this Claude instance.

### What was investigated

**Context:** After v6.41 deploy (local charges + customs filtering fix), Calvin raised DG charges for THC as missing from the pricing engine.

**Legacy Datastore audit confirmed two separate gaps:**

#### Gap 1 — DG Class Charges table (missed migration) — DEFERRED to next session after Gap 2
The legacy system had a completely separate Datastore entity kind `PricingDGClassCharges` (kind: `PT-DGCC`) for DG-specific port charges (inspection, documentation, hazmat handling fees). This was never migrated to v2. Needs: new `dg_class_charges` table + data migration script + pricing engine resolver. **Deferred — not yet designed.**

#### Gap 2 — DG flag on `local_charges` for THC DG premium — DESIGNED, prompt pending
**Problem:** `local_charges` table has no DG dimension. THC rates differ for DG-2 and DG-3 shipments but the table can't store separate DG-specific THC rows. The legacy system never handled this either — this is net-new work.

**Agreed design:**
- Add `dg_class_code VARCHAR(10) NOT NULL DEFAULT 'NON-DG'` to `local_charges`
- CHECK constraint: `IN ('NON-DG', 'DG-2', 'DG-3', 'ALL')` — matching FCL rate card conventions
  - `ALL` = wildcard, applies regardless of DG status
  - `NON-DG` = standard (non-DG) shipments only
  - `DG-2`, `DG-3` = specific DG class rows
- Backfill existing data:
  - **Non-THC charges** → `'ALL'` (applies to all shipment types)
  - **THC charges** → `'NON-DG'` (existing data is non-DG rates)
  - THC charge code identification: need to confirm exact charge codes in prod before writing the backfill WHERE clause (likely `LC-THC` or similar — check prod before writing migration)
- Drop and recreate `lc_unique` unique constraint to include `dg_class_code`
- Update `_resolve_local_charges` in `af-server/routers/quotations.py`:
  - Add `dg_class_code` filter to SQL: match exact DG class OR `'ALL'`
  - Resolution priority: exact DG class match preferred over `'ALL'` (CASE in ORDER BY, same pattern as customs)
  - `shipment["dg_class_code"]` already available from `_load_shipment_data` — no shipment data changes needed

---

## Key Context for Next Session

### Pricing engine DG flow (already in place in v2)
- `_load_shipment_data` extracts `dg_class_code` from `cargo.is_dg` / `cargo.dg_class` on the order, defaults to `"NON-DG"`
- FCL freight already uses `dg_class_code` to match `fcl_rate_cards` — pattern is established
- `shipment["dg_class_code"]` flows through to all resolvers

### Legacy DG class codes (from `PricingDGClassCharges.properties`)
```python
'dg_class_code': helper.str_format  # e.g. DG-2, DG-3
```
The legacy system used `DG-2` and `DG-3` as the two active classes. These match what FCL rate cards use.

### `local_charges` current schema (migration 023)
- Unique constraint: `(port_code, trade_direction, shipment_type, container_size, container_type, charge_code, is_domestic, effective_from)`
- New constraint will add `dg_class_code` as a dimension

### Files to read at session start
- `claude/handover/handover-2026-03-13-session-end-v641.md` (this file)
- `claude/tests/AF-Test-Master.md`
- `claude/prompts/log/PROMPT-LOG-v6.41-v6.50.md` (tail:25)
- `af-server/migrations/023_local_charges.sql` (for exact schema before writing migration)
- `af-server/routers/quotations.py` (view_range around `_resolve_local_charges` — lines ~560–680)

---

## Next Actions (Session 123)

1. **Check THC charge codes in prod** — run a quick SQL query to confirm exact `charge_code` values for THC rows in `local_charges` before writing the backfill
2. **Write prompt v6.42** — migration `049_local_charges_dg.sql` + pricing engine update to `_resolve_local_charges` in `quotations.py`
3. **Deploy v6.39–v6.41** — still pending (Calvin pushing via VS Code → Cloud Build)
4. **Gap 1 (DG Class Charges)** — design and prompt in a later session after Gap 2 is shipped

---

## Pending Deploy Queue (unchanged from Session 121)

| Version | Description | Status |
|---|---|---|
| v6.39 | Pricing engine backend | Complete, not deployed |
| v6.40 | Quotation detail frontend + currency fix | Complete, not deployed |
| v6.41 | Local charges + customs filtering fix | Complete, not deployed |

---

## Test Status
- **v2.61** — 272/286 passing — no changes this session
- No new test series needed for Gap 2 (pricing engine behaviour change, covered by manual testing of calculate endpoint)
