# Handover — 2026-03-14 Session End — v6.69

## Session Header
AF Dev — Session 131 | AcceleFreight v2 | v6.38 Live | v6.69 Latest | Tests v2.61 (272/286)

---

## Session Summary
Session 131 covered the full three-module pricing standardisation: customs, local charges, and DG class charges all migrated from flattened tables to explicit two-tier card/rate schema. All four prod migrations applied and verified clean. Backends fully rewritten.

---

## Prompts Completed This Session
- **v6.67** — Customs two-tier schema migration + backend rewrite (completed, log read)
- **v6.68** — Customs `is_international` fix + local charges two-tier migration + backend rewrite (completed, log read)
- **v6.69** — DG class charges two-tier migration + backend rewrite (completed, log read)

## Prompt In Progress
- None — clean state

## Deploy Queue
**v6.39–v6.69 = 31 versions pending** (v6.38 live on Cloud Run)

---

## Work Done This Session

### Architecture Decision (start of session)
Resolved four open design decisions from Session 130:
1. Naming: consistent with haulage pattern (`_rate_cards` / rates tables)
2. `is_active`: card level only — rate killed by `effective_to` or deletion
3. Three separate migrations for rollback isolation
4. One Opus prompt per module (backend only); frontend rewrites as separate follow-on prompts

### Migrations Applied to Prod (all verified clean)

| Migration | Description | Cards | Rate Rows | Nulls |
|---|---|---|---|---|
| 055 | Customs two-tier split | 282 | 356 | 0 ✓ |
| 056 | Customs `is_international` added | 52/52 domestic backfilled | — | — |
| 057 | Local charges two-tier split | 879 | 1,145 | 0 ✓ |
| 058 | DG class charges two-tier split | 33 | 327 | 0 ✓ |

### Migration Runner Scripts Created (MCP)
- `af-server/scripts/run_migration_055.py`
- `af-server/scripts/run_migration_056.py`
- `af-server/scripts/run_migration_057.py`
- `af-server/scripts/run_migration_058.py`

### Schema — New Tables
- `customs_rate_cards` — 6-part key: `{port_code}|{trade_direction}|{shipment_type}|{charge_code}|{is_domestic}|{is_international}`
- `local_charge_cards` — 9-part key: `{port_code}|{trade_direction}|{shipment_type}|{container_size}|{container_type}|{dg_class_code}|{charge_code}|{is_domestic}|{is_international}`
- `dg_class_charge_cards` — 9-part key: `{port_code}|{trade_direction}|{shipment_type}|{dg_class_code}|{container_size}|{container_type}|{charge_code}|{is_domestic}|{is_international}`

### Rate Row Standard (project-wide rule, locked in this session)
Rate rows contain ONLY: `id`, `rate_card_id`, `price`, `cost`, `effective_from`, `effective_to`, `created_at`, `updated_at`. All other fields on the card.

### Deprecated — Removed This Session
- `paid_with_freight` column — dropped from `local_charges` in migration 057, not present in `local_charge_cards`
- `is_active` removed from all three rate tables — now on cards only

### Backend Rewrites (Opus)
All three routers fully rewritten to two-tier schema:
- `af-server/routers/pricing/customs.py` — 8 endpoints: GET /ports, GET /cards, GET /rates/{id}, POST /rates (find-or-create card), PATCH /cards/{id}, PATCH /rates/{id}, DELETE /rates/{id}, DELETE /rates/card/{key}
- `af-server/routers/pricing/local_charges.py` — same 8-endpoint structure
- `af-server/routers/pricing/dg_class_charges.py` — same 8-endpoint structure; `close_previous` added (was missing from original)

### Quotation Engine Updates (Opus, in each prompt)
`routers/quotations.py` resolution functions updated to JOIN card + rate tables:
- `_resolve_customs` — JOINs `customs_rate_cards` + `customs_rates`
- `_resolve_local_charges` — JOINs `local_charge_cards` + `local_charges`; `paid_with_freight` references removed
- `_resolve_dg_class_charges` — JOINs `dg_class_charge_cards` + `dg_class_charges`

---

## Current State of Key Files

| File | State |
|------|-------|
| `af-server/routers/pricing/customs.py` | v6.68 — two-tier rewrite, 6-part key with `is_international` |
| `af-server/routers/pricing/local_charges.py` | v6.68 — two-tier rewrite, `paid_with_freight` gone |
| `af-server/routers/pricing/dg_class_charges.py` | v6.69 — two-tier rewrite, `close_previous` added |
| `af-server/routers/quotations.py` | v6.69 — all three resolution queries updated |
| `af-server/migrations/055_customs_two_tier.sql` | Applied to prod ✓ |
| `af-server/migrations/056_customs_is_international.sql` | Applied to prod ✓ |
| `af-server/migrations/057_local_charges_two_tier.sql` | Applied to prod ✓ |
| `af-server/migrations/058_dg_class_charges_two_tier.sql` | Applied to prod ✓ |

---

## Next Prompt to Write
**v6.70 — Customs frontend rewrite** (first of three frontend rewrites)

The three pricing frontend UIs (customs table + modal, local charges table + modal, DG class charges table) still reference the old flat API shape. Each needs rewriting to:
- Separate card-edit vs rate-edit operations
- Call `PATCH /cards/{id}` for card-level fields, `PATCH /rates/{id}` for price/cost/dates
- Add `is_international` to all three UIs
- Remove `paid_with_freight` from local charges UI
- `DELETE /rates/card/{key}` key format updated (6-part for customs, 9-part for LC/DG)

Do customs first (simplest card key), then local charges, then DG.

**Next migration number: 059**

---

## Open Items / Backlog

- **[NEXT]** Frontend rewrites — customs (v6.70), local charges (v6.71), DG class charges (v6.72)
- **[PENDING]** Deploy batch v6.39–v6.69 (31 versions pending against v6.38 live on Cloud Run)
- **[PENDING]** Geography → Tax Rules admin UI — `tax_rules` table management
- **[PENDING]** Manual line item tax — apply tax on manually added items by component_type + port country
- **[PENDING]** `is_domestic` audit on DG Class Charges — many rows tagged `is_domestic = true` from original migration
- **[PENDING]** AF-API-Pricing.md — needs update after frontend rewrites stabilise
- **[PENDING]** Air freight data migration — next major workstream after pricing module complete

---

## Key Principles Locked In This Session
- Rate rows: price/cost/dates only — everything else on the card (enforced across all 3 modules)
- `is_active` on card only — rates killed by `effective_to` or deleted
- `is_international` on all three modules (customs was missing it — fixed in 056)
- `paid_with_freight` deprecated and removed — do not reintroduce

---

## Session Startup Checklist (Session 132)

```
list_directory: claude/handover/           ← confirm latest file
list_directory: claude/prompts/log/        ← confirm current log file

read_multiple_files:
  - claude/handover/handover-2026-03-14-session-end-v6.69.md   ← this file
  - claude/prompts/log/PROMPT-LOG-v6.61-v6.70.md               (head:30)
  - claude/tests/AF-Test-Master.md
```

Session header:
`AF Dev — Session 132 | AcceleFreight v2 | v6.38 Live | v6.69 Latest | Tests v2.61 (272/286)`
