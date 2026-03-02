# Handover — 01 March 2026 (PostgreSQL Go-Live)

## Session Summary
PostgreSQL migration executed and deployed to production. All 3,854 shipments live in Cloud SQL. Performance target achieved. One deployment blocker resolved (missing google-cloud-datastore dependency). Platform fully operational on PostgreSQL backend.

---

## Current System State

### Stats (verified live — production, post-migration)
| Metric | Value |
|---|---|
| Total Orders | 2,043 |
| Active | 23 |
| Completed | 2,019 |
| Draft | 1 |
| To Invoice | 8 |
| Cancelled | 0 |

### Infrastructure
| Component | Status |
|---|---|
| Cloud SQL instance | `af-db` — PostgreSQL 15, asia-northeast1, db-g1-small |
| Database | `accelefreight` |
| DB User | `af_server` |
| Cloud Run — af-server | Live, connected via Cloud SQL Python Connector (pg8000) |
| Cloud Run — af-platform | Live, unchanged |
| Datastore | Still used for user records (auth.py reads from it) — NOT shipment data |

### Performance (observed in production)
- API calls: 128ms–357ms for full page loads including all data
- Stats query: 3.9ms (verified in Cloud SQL Studio)
- Previous performance: 6–12 seconds (Datastore scan)

---

## What Was Done This Session

### Cloud SQL Setup (manual, via GCP Console)
- Cloud SQL Admin API enabled
- Instance `af-db` created: PostgreSQL 15→18, asia-northeast1, db-g1-small (~$25/month)
- Database `accelefreight` and user `af_server` created
- IAM: Cloud SQL Client role granted to af-server service account
- Secret Manager: DATABASE_URL, DB_USER, DB_PASS, INSTANCE_CONNECTION_NAME created
- IAM: Secret Manager Secret Accessor granted at **project level** (not per-secret) — this was the fix for repeated permission errors

### Schema Creation
- `scripts/create_schema.py` could not run locally (no local PostgreSQL)
- Schema SQL executed directly in **Cloud SQL Studio** — 58.4ms, no errors
- Tables created: companies, shipments, shipment_workflows, shipment_files, ports, file_tags, system_logs
- Indexes: idx_shipments_tab (composite), idx_shipments_id_trgm (GIN), idx_shipments_active, idx_shipments_updated
- Sequence: shipment_countid_seq

### Cloud SQL Auth Proxy (local dev)
- `cloud-sql-proxy.exe` downloaded to `tools/` (gitignored)
- `tools/start-proxy.bat` — double-click to start proxy on localhost:5432
- `af-server/.env.local` updated with DB credentials

### Migration Execution
Two bugs encountered and fixed during migration:

**Bug 1 — countid=0 UniqueViolation**
- Multiple V1-migrated shipments had countid=0
- Fix: derive countid from shipment ID when countid=0 (`AF-000002` → `2`)

**Bug 2 — AFCQ- workflow ForeignKeyViolation**
- Workflow records referencing AFCQ- shipment IDs had no parent shipment (only AF- migrated)
- Fix: skip AFCQ- prefixed workflow records in `migrate_workflows()`

**Final migration results:**
| Entity | Count |
|---|---|
| Companies | 642 |
| Ports | 337 |
| File Tags | 36 |
| Shipments | 3,854 (0 skipped) |
| Workflows | 2,036 (AFCQ- workflows skipped) |
| Files | 1,085 |
| Sequence seeded at | 3,867 |

### Deployment Issues Resolved

**Issue 1 — Secret Manager permissions**
- Initial deployment failed: permission denied on secrets for af-server service account
- Root cause: only DATABASE_URL secret existed; DB_USER, DB_PASS, INSTANCE_CONNECTION_NAME missing
- Fix: created 3 missing secrets + granted Secret Accessor at project level

**Issue 2 — Missing google-cloud-datastore**
- Deployment succeeded but all API responses returned zero/empty
- Root cause: `google-cloud-datastore` removed from requirements.txt during migration cleanup, but `core/auth.py` still imports from `core/datastore.py` (user records still in Datastore)
- Error in Cloud Run logs: `ImportError: cannot import name 'datastore' from 'google.cloud'`
- Fix: re-added `google-cloud-datastore==2.19.0` to `requirements.txt`
- **This was the final blocker** — after this fix, platform loaded correctly with all data

### Git State
- Commit: `ff765e5` — v2.47 (main migration work, 21 files changed)
- Commit: restore google-cloud-datastore fix (pushed to main, Cloud Build triggered)

---

## Architecture — Current State

```
af-platform (Next.js 14)
    └── API calls → api.accelefreight.com (af-server)
                        └── PostgreSQL (Cloud SQL af-db)  ← ALL shipment data
                        └── Datastore (Google)            ← User records only (auth)
                        └── GCS                           ← File storage (unchanged)
```

**Key principle:** Datastore is NOT dead — it still serves user/auth records. Only shipment data moved to PostgreSQL.

---

## Known Issues / Deferred

| Item | Notes |
|---|---|
| `geography` route — 404 | Page not built yet |
| `logs` route — 404 | Page not built yet |
| `pricing` route — 404 | Page not built yet |
| PG test series — all PENDING | Migration confirmed working visually, formal test pass not done |
| Local dev requires proxy | Must run `tools/start-proxy.bat` before local af-server dev |

---

## Test List
Version: **2.18** — see `claude/tests/AF-Test-List.md`

### PG Series — needs formal test pass next session
All 15 PG tests remain PENDING. Visually confirmed:
- PG-04 ✓ (stats <10ms)
- PG-05 ✓ (active tab loads fast)
- PG-14 ✓ (Active=23, Total=2043, TI=8)
- PG-15 ✓ (well under 500ms)

Recommend running PG series formally at start of next session before building new features.

---

## Files Modified This Session
| File | Change |
|---|---|
| `af-server/requirements.txt` | Added `google-cloud-datastore==2.19.0` (critical fix) |
| `af-server/scripts/migrate_to_postgres.py` | countid=0 fix + AFCQ- workflow skip |
| `af-server/tools/download-proxy.ps1` | New — downloads cloud-sql-proxy |
| `af-server/tools/start-proxy.bat` | New — starts proxy on localhost:5432 |
| `.gitignore` | Added `tools/cloud-sql-proxy.exe` |
| `claude/handover/handover-2026-03-01-session-pg-live.md` | This file |

---

## Next Session — Recommended Actions

1. **Run PG test series** — formal verification pass (PG-01 through PG-15)
2. **Decide next feature area** — options:
   - Mobile UX improvement pass (MB series)
   - Port terminal architecture (PT series / MYPKG_N)
   - New shipment creation flow (manual entry)
   - Geography / Logs / Pricing pages (currently 404)
