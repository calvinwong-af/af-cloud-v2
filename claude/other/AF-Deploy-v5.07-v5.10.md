# Deployment & Migration Checklist — v5.07 → v5.10
**Date:** 2026-03-07
**Covers:** v5.07, v5.08, v5.09, v5.10 + Migrations 012 & 013 + Scope backfill

---

## Pre-Deploy: Local Verification

- [ ] Local server running (Cloud SQL Auth Proxy + FastAPI port 8000 + Next.js port 3000)
- [ ] Smoke test Configure Scope on AF-003881 (CNF IMPORT): open dialog → both Import Clearance + Last Mile visible → set Last Mile to Not in Scope → save → reopen → Last Mile still visible showing Not in Scope ✓
- [ ] Confirm task mode badge updates after scope save (Tasks tab refreshes without manual reload)
- [ ] Confirm Configure Scope button visible on Overview and Files tabs (not just Tasks)

---

## Step 1 — Run Migrations on Prod

Migrations 012 and 013 are already on prod (013 was run in Session 42 to fix the 500).
Verify both columns exist before proceeding.

**Verify migration 012 (is_test column):**
```
psql $PROD_DB -c "\d orders" | grep is_test
```

**Verify migration 013 (scope column):**
```
psql $PROD_DB -c "\d shipment_details" | grep scope
```

If either is missing, run the corresponding script:
```
cd af-server
.venv\Scripts\python scripts\run_migration_013.py
```
(No run script exists for 012 — apply manually via psql if needed:)
```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
```

---

## Step 2 — Deploy Code

Push to `main` — Cloud Build triggers automatically for both services.

```
git add -A
git commit -m "v5.07–v5.10: Scope redesign, pricing schema, UI polish, scope dialog fixes"
git push origin main
```

Monitor Cloud Build for both af-server and af-platform. Both must reach ✅ before proceeding.

---

## Step 3 — Run Scope Backfill on Prod

The backfill writes the derived scope (from workflow_tasks) to `shipment_details.scope` for all V2 shipments that don't already have it set.

**Dry run first:**
```
cd af-server
.venv\Scripts\python scripts\backfill_scope_from_tasks.py --dry-run
```
Expected: ~33 shipments to update, ~2006 skipped (no tasks = V1 legacy).

**Full run:**
```
.venv\Scripts\python scripts\backfill_scope_from_tasks.py
```

**Verify:**
```
.venv\Scripts\python scripts\verify_scope_backfill.py
```
Expected output: all eligible shipments on new schema, 0 needing backfill.

> Note: Point `.env.local` at prod DB (Cloud SQL Auth Proxy) before running.

---

## Step 4 — Prod Smoke Tests

| Check | Expected |
|---|---|
| Shipment list loads | ✅ |
| Shipment detail loads (V2 record) | ✅ |
| Configure Scope dialog opens | ✅ |
| Configure Scope saves without 500 | ✅ |
| Task mode badge updates after scope save | ✅ |
| Upload Document button visible | ✅ |
| is_test badge shows on test orders (if any exist) | ✅ |
| Orders page loads | ✅ |
| Ground Transport list loads | ✅ |

---

## Step 5 — Pricing Migration (separate, after code deploy confirmed clean)

Schema was deployed to prod in Session 42 (`create_pricing_schema.py`). Tables exist.
Rate data has NOT been migrated yet.

**Do not run until code deploy is confirmed stable.**

**Dry run:**
```
cd af-server
.venv\Scripts\python scripts\migrate_pricing_freight.py --dry-run
```

**Full run (after dry run verified):**
```
.venv\Scripts\python scripts\migrate_pricing_freight.py
```

**Deduplication (after migration verified):**
```
.venv\Scripts\python scripts\cleanup_pricing_duplicates.py --dry-run
.venv\Scripts\python scripts\cleanup_pricing_duplicates.py
```

---

## Notes

- `create_schema.py` is **stale** — references old `shipment_files.shipment_id` column (renamed to `order_id` in migration 011). Do NOT run against prod.
- Pricing schema on prod was created by `create_pricing_schema.py` (targeted script, Session 42) — not `create_schema.py`.
- `backfill_scope_from_tasks.py` and `verify_scope_backfill.py` were corrected this session to read/write `shipment_details.scope` (not `orders.scope`).
- af-platform pricing UI is deferred — prototype/mockup session required before building.
