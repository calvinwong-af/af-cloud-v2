# AF Dev — Session 101 Handover
**Date:** 2026-03-11 | **Last Prompt:** v6.05 | **Next Session:** 102

---

## Session Summary

### Prompts completed this session
- **v6.05** — Haulage Supplier Pricing: Rebates + FAF (Backend + Frontend). Status: **Completed by Opus.**

### v6.05 scope (all completed)
- `af-server/migrations/041_haulage_faf_rates.sql` — new table, GIN index on port_rates JSONB
- `af-server/routers/pricing/haulage.py` — 8 new endpoints: 4 rebate (GET/POST/PATCH/DELETE), 4 FAF (GET/POST/PATCH/DELETE)
- `af-platform/src/app/actions/pricing.ts` — HaulageSupplierRebate, FafPortRate, HaulageFafRate types + 8 server actions
- `af-platform/src/app/(platform)/companies/page.tsx` — stores role in state, passes to CompanyTable
- `af-platform/src/components/companies/CompanyTable.tsx` — threads userRole prop down to CompanyActionsMenu
- `af-platform/src/components/companies/CompanyActionsMenu.tsx` — Supplier Pricing menu item (AFU-ADMIN only), wires SupplierPricingModal
- `af-platform/src/components/companies/SupplierPricingModal.tsx` — new tabbed dialog (Rebates + FAF tabs, inline add/edit forms, expandable FAF rows with port rates builder)

### ⚠️ Migration 041 not yet run
`af-server/migrations/041_haulage_faf_rates.sql` needs to be executed manually against Cloud SQL before the FAF endpoints will work.

---

## FAF design decisions (settled this session)

- **Two FAF methods:** absolute value → `HA-FAF` surcharge on `haulage_rates` (existing surcharge infrastructure); percentage → new `haulage_faf_rates` table
- **Scope:** supplier-level with port+container_size breakdown in `port_rates` JSONB array
- **JSONB entry shape:** `{ port_un_code, container_size: "20"|"40"|"40HC"|"wildcard", faf_percent }`
- **Wildcard:** `container_size: "wildcard"` = applies to all sizes at that port (standard for trip-based hauliers)
- **No match:** ON REQUEST — flag for ops review, never silently skip
- **Coexistence:** absolute + percent FAF can both exist on same rate; no conflict detection needed
- **No migration:** FAF data entered fresh via UI using Excel export as reference (`scripts/output/faf_export_non_my.xlsx`)

### Supplier Rebates design decisions
- Rebates tab on `SupplierPricingModal` — AF Admin only (AFU-ADMIN role gate, frontend only for now)
- No "supplier type" definition needed — dialog is accessible from any company row, gated by role

### FAF Excel export
- Script: `af-server/scripts/export_faf_to_excel.py`
- Output: `af-server/scripts/output/faf_export_non_my.xlsx`
- Columns: supplier_id, port_un_code, month_year, area_id (legacy city_code), equipment_size, equipment_type, faf_percent, faf_value, has_faf_percent, has_faf_value
- Excludes all MY* ports
- **Not yet run** — Calvin to run when ready: `.venv\Scripts\python scripts\export_faf_to_excel.py`

---

## Immediate next actions

1. **Run migration 041** against Cloud SQL (Auth Proxy must be running)
2. **Run FAF Excel export** — `.venv\Scripts\python scripts\export_faf_to_excel.py`
3. **Test SupplierPricingModal** — verify Rebates and FAF tabs, add/edit/delete flows, AFU-ADMIN gate
4. **Next workstream TBD** — options: Air Freight pricing UI, or move to Quotation module

---

## Active backlog (unchanged)

| Item | Status |
|---|---|
| Air Freight pricing UI | Deferred — structurally different (weight breakpoint tiers) |
| Haulage FAF data entry | Pending migration 041 + Excel export |
| Quotation module | Next major workstream after pricing stable |
| TD-02: drop deprecated flat surcharge columns | Deferred |
| UI-17: per-user country preference | Deferred (schema migration needed) |
| Gen transport + cross-border | No data, deferred |
| Operations Playbook | Deferred until platform complete |

---

## Key file locations

| Area | Path |
|---|---|
| Haulage router | `af-server/routers/pricing/haulage.py` |
| Migration 041 | `af-server/migrations/041_haulage_faf_rates.sql` |
| Migration 038 | `af-server/migrations/038_haulage_supplier_rebates.sql` |
| FAF export script | `af-server/scripts/export_faf_to_excel.py` |
| FAF export output | `af-server/scripts/output/faf_export_non_my.xlsx` |
| Supplier Pricing modal | `af-platform/src/components/companies/SupplierPricingModal.tsx` |
| Company actions menu | `af-platform/src/components/companies/CompanyActionsMenu.tsx` |
| Pricing server actions | `af-platform/src/app/actions/pricing.ts` |
| Prompt log | `af-cloud-v2/claude/prompts/log/PROMPT-LOG-v6.01-v6.10.md` |
