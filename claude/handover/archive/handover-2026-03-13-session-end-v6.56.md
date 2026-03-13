# Handover — 2026-03-13 Session End — v6.56

## Session Summary
**Session:** 128 (continued)
**Date:** 2026-03-13
**Prompt version at session end:** v6.56 (written, not yet run)
**Live on Cloud Run:** v6.38
**Complete, pending deploy:** v6.39–v6.55 (17 versions)
**Tests:** v2.61 (272/286) — no changes this session

---

## Work Completed This Session

### v6.54 — DG Class Charges Card-Level Edit Fix + Effective To Alignment (Opus)
- Fixed `update_dg_class_charge` PATCH: card-level field changes now propagate to ALL sibling rows.
- Fixed Effective To label misalignment in 3 modals (local charges, DG class, customs).

### v6.55 — DG Classification on Shipment Orders (Opus)
- Replaced boolean `is_dg` checkbox in create-shipment flow with 3-option selector: Not DG / DG Class 2 / DG Class 3.
- Added `dg_class_code: Optional[str]` to cargo write endpoints in `af-server/routers/shipments/core.py`.
- Updated `_load_shipment_data` in `quotations.py` to read `dg_class_code` (with fallback to legacy `dg_class` key).
- Updated `StepCargo.tsx`, `CreateShipmentModal.tsx`, `StepReview.tsx`, shipment detail page, `lib/types.ts`, `shipments-write.ts`.
- No migration needed — `orders.cargo` is JSONB. `is_dg` still written for backward compat.
- Pricing engine now correctly receives `"DG-2"` or `"DG-3"` for DG shipments, enabling `_resolve_dg_class_charges` to fire.

### v6.56 — Port Combobox in Pricing Modals (WRITTEN, not yet run)
- Replace plain port code text inputs in `_local-charges-modal.tsx`, `_dg-class-charges-modal.tsx`, `_customs-modal.tsx` with `PortCombobox`.
- Parent tables supply `portOptions` prop (fetched once on mount). No internal fetch inside modals.
- `_local-charges-table.tsx` already fetches ports — just needs to pass to modal.
- `_dg-class-charges-table.tsx` and `_customs-table.tsx` need ports fetch added.

---

## Immediate Next Actions

1. **Run v6.56 in Opus** — port combobox in pricing modals.
2. **Deploy v6.39–v6.55** — 17 versions queued.
3. **Verify `is_domestic` on DG Class Charges** — many rows tagged `is_domestic = true` from migration. Confirm whether DG charges apply to domestic or international shipments and bulk-update if needed.

---

## Pending Deploy Queue

| Version | Description |
|---------|-------------|
| v6.39 | Pricing engine backend |
| v6.40 | Quotation detail frontend + currency fix |
| v6.41 | Local charges + customs filtering fix |
| v6.42 | Container size normalisation (3 resolvers) |
| v6.43 | `local_charges` DG dimension — migration + engine |
| v6.44 | `local_charges` router `dg_class_code` |
| v6.45 | `dg_class_charges` table + engine |
| v6.46 | `dg_class_charges` CRUD router |
| v6.47 | `dg_class_charges` legacy data migration script |
| v6.48 | DG Class Charges frontend UI |
| v6.49 | DG Class Charges clickable time-series cells |
| v6.50 | is_international flag — migration + backend |
| v6.51 | Local charges modal fixes + paid_with_freight removal + DG Class dropdown |
| v6.52 | is_international frontend (modals + types) |
| v6.53 | Phantom row fix + card-level PATCH propagation + card_key uom/currency |
| v6.54 | DG class charges card-level edit fix + Effective To alignment |
| v6.55 | DG classification on shipment orders |

---

## Key Design Decisions Made This Session

### DG Classification on Orders
- `dg_class_code` stored in `orders.cargo` JSONB alongside `is_dg` (derived boolean, kept for backward compat).
- Valid values: `null` (non-DG), `"DG-2"`, `"DG-3"` — matching enum in `dg_class_charges` and `local_charges`.
- Pricing engine uses `"NON-DG"` as sentinel when no class found. Logs warning if `is_dg=True` but no class code.
- Create-shipment flow now collects classification upfront — no deferred "add later" message.

### Port Combobox Pattern
- Prop injection preferred over internal fetch in modals.
- Parent tables own the ports data lifecycle; modals are pure presentational consumers.
- `PortCombobox` className matches existing `inputCls` for visual consistency.

---

## Open Items / Backlog

- **is_domestic on DG Class Charges** — verify against legacy system before bulk update.
- **Customs module audit** — delete support in customs modal; FCL/LCL/AIR/haulage/transport modules audit for same error-handling gaps.
- **Retrofit hard FK pattern** to existing pricing tables (backlog).
- **AF-API-Contract** domain file `AF-API-Pricing.md` — needs update for DG classification endpoints and pricing module changes.
- **Air freight data migration** — next major workstream after current pricing stabilisation.
- **Quotation module** — deferred until pricing module stabilises.

---

## Key File Paths

| Purpose | Path |
|---------|------|
| Current prompt | `claude/prompts/PROMPT-CURRENT.md` |
| Prompt log | `claude/prompts/log/PROMPT-LOG-v6.51-v6.60.md` |
| Test master | `claude/tests/AF-Test-Master.md` |
| Shipments router | `af-server/routers/shipments/core.py` |
| Quotations router | `af-server/routers/quotations.py` |
| DG charges router | `af-server/routers/pricing/dg_class_charges.py` |
| Local charges router | `af-server/routers/pricing/local_charges.py` |
| Local charges modal | `af-platform/src/app/(platform)/pricing/local-charges/_local-charges-modal.tsx` |
| DG charges modal | `af-platform/src/app/(platform)/pricing/dg-class-charges/_dg-class-charges-modal.tsx` |
| Customs modal | `af-platform/src/app/(platform)/pricing/customs/_customs-modal.tsx` |
| StepCargo | `af-platform/src/components/shipments/_create-shipment/StepCargo.tsx` |
| CreateShipmentModal | `af-platform/src/components/shipments/CreateShipmentModal.tsx` |
| PortCombobox | `af-platform/src/components/shared/PortCombobox.tsx` |
