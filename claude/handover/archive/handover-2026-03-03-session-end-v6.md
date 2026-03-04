# Handover — 03 March 2026 (Session End — v2.82 deploying)

## Session Summary
This session was primarily a production debugging run. The shipments list was
empty in production after v2.81 deployed. Root cause was tracked down through
multiple layers: missing env vars, redirect stripping auth headers, and
ultimately a Datastore dependency in `verifySessionAndRole`. v2.82 was written
and dispatched to fix everything properly.

---

## Current System State

### Versions
| Item | Value |
|---|---|
| Last completed prompt | v2.82 ✅ (pushed, deploying) |
| Currently running | v2.82 build in progress |
| Next prompt | v2.83 (deferred bugs + logging migration) |
| Test master version | 2.52 |

### Stats
| Metric | Value |
|---|---|
| Total Orders | 2,034 |
| Active | 18 |
| Completed | 2,016 |
| To Invoice | 4 |

---

## What Was Done This Session

### Production Debugging — Shipments List Empty
After v2.81 deployed (user migration complete), the shipments list showed
empty in production. Full investigation trail:

**Finding 1 — Missing `GOOGLE_CLOUD_PROJECT_ID`**
- `cloudbuild.yaml` did not pass this env var to Cloud Run
- Datastore client failed to initialise silently
- Workaround: added to `cloudbuild.yaml` `--set-env-vars`

**Finding 2 — HTTP→HTTPS redirect strips Authorization header**
- `AF_SERVER_URL=https://api.accelefreight.com` caused a redirect chain
- Authorization header was dropped on redirect
- Workaround: changed to direct Cloud Run URL
  `https://af-server-667020632236.asia-northeast1.run.app`

**Finding 3 — Root cause: `verifySessionAndRole` reads Datastore**
- `auth-server.ts` still read `UserIAM` + `CompanyUserAccount` from Datastore
- This is the fundamental issue — not the env vars or redirect

### v2.82 Prompt Written and Dispatched
Key changes in v2.82:
- `verifySessionAndRole` rewritten to call `GET /api/v2/users/me` on af-server
  (PostgreSQL) instead of reading Datastore directly
- `cloudbuild.yaml` restored to `AF_SERVER_URL=https://api.accelefreight.com`
  (redirect issue is bypassed since Datastore no longer called in hot path)
- All debug `console.log` lines removed from `auth-server.ts` and
  `getShipmentListAction`
- Bug fixes: NaN KB file size, files badge, DG indicator, DG edit toggle
- DG badge in shipments list (cargo_is_dg already in SQL from previous session)
- `migrate_005_remove_mypkg_n.py` created (needs to be run manually)

### Deferred from v2.82
- Bug 3: AWB/BL party diff in DocumentParseModal — needs further analysis
- Bug 4: Duplicate company section in DocumentParseModal — could not reproduce
  from code review, needs runtime testing
- Bug 5 migration: `migrate_005_remove_mypkg_n.py` script created but not yet
  run against production DB

---

## What To Do Next Session

### Immediate — Verify v2.82
1. **Login works** — most critical, `verifySessionAndRole` was rewritten
2. **Shipments list loads** — the main fix
3. **Nav header shows correct name** — confirms `/users/me` working
4. **DG badge** in list for a DG shipment
5. **Files tab badge** pre-populated on page load
6. **File sizes** no longer show NaN KB

### Run migration script
```
python af-server/scripts/migrate_005_remove_mypkg_n.py
```
Removes `MYPKG_N` standalone port row. Check first that no shipments reference
`MYPKG_N` as a port code directly.

### Investigate deferred bugs
- Bug 3: AWB diff in DocumentParseModal
- Bug 4: Duplicate company section — test in browser with a real BL parse

### Planned Prompt Sequence (Updated)
| Prompt | Item | Status |
|---|---|---|
| v2.80 | BLUploadTab + CreateShipmentModal split | ✅ Complete |
| v2.81 | User migration — Datastore → PostgreSQL | ✅ Complete |
| v2.82 | Auth hot path migration + bug fixes | 🔄 Deploying |
| v2.83 | Deferred bugs (3, 4) + logAction migration | Next |

---

## Architecture State — Datastore Dependency

After v2.82 deploys, Datastore usage in af-platform is limited to:
- `logAction()` in `auth-server.ts` — writes system logs to `AFSystemLogs`

All read operations are now on PostgreSQL. The next Datastore migration target
is `logAction()` → PostgreSQL `system_logs` table (v2.83 or dedicated session).

---

## Key Files Modified This Session

| File | Change |
|---|---|
| `af-platform/src/lib/auth-server.ts` | verifySessionAndRole → calls /users/me, debug logs removed |
| `af-platform/src/app/actions/shipments.ts` | debug logs removed from getShipmentListAction |
| `af-platform/cloudbuild.yaml` | AF_SERVER_URL restored to https://api.accelefreight.com |
| `af-server/scripts/migrate_005_remove_mypkg_n.py` | Created — run manually against prod |
| `claude/prompts/PROMPT-CURRENT.md` | v2.82 prompt |
| `claude/handover/handover-2026-03-03-session-end-v6.md` | This file |
