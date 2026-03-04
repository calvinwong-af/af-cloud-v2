# Handover — 03 March 2026 (Session End — v2.83 complete)

## Session Summary
This session was a continuation of the v2.82 production debugging run. The
shipments list was still empty after v2.82 deployed. The root cause was tracked
down to a FastAPI nested router constraint — `redirect_slashes=False` combined
with `@router.get("/")` on a sub-router caused silent empty responses. Multiple
fix attempts were made before Opus found the correct solution (v2.83).

---

## Current System State

### Versions
| Item | Value |
|---|---|
| Last completed prompt | v2.83 ✅ deployed + confirmed working |
| Currently running | v2.83 in production |
| Next prompt | v2.84 (deferred bugs + logAction migration) |
| Test master version | 2.52 |

### Stats (last seen)
| Metric | Value |
|---|---|
| Total Orders | 2,034 |
| Active | 18 |
| Completed | 2,016 |
| To Invoice | 4 |

---

## What Was Done This Session

### v2.83 — Fix Empty Shipments List

**Root cause 1:** `redirect_slashes=False` on both `FastAPI()` app and
`APIRouter()` combined with `@router.get("/")` meant `GET /api/v2/shipments`
(no trailing slash) never matched — returning 200 with empty data silently.
Stats/search worked because they have explicit non-empty paths.

**Fix attempt 1 (Claude AI):** Changed `@router.get("/")` → `@router.get("")`
→ broke Cloud Run startup with `FastAPIError: Prefix and path cannot be both empty`.

**Fix attempt 2 (Claude AI):** Added `redirect_slashes=False` to `main.py`
FastAPI app level → server started but list still empty.

**Final fix (Opus):** Removed root-level decorators from `core.py` entirely.
Registered `list_shipments` and `create_shipment_manual` directly on the package
router in `__init__.py` via `router.add_api_route("", ...)`. Since `main.py`
includes the package router with prefix `/api/v2/shipments`, routes resolve to
`GET/POST /api/v2/shipments` exactly — no redirect, no FastAPIError.

**Confirmed working in production:** Shipments list now returns data correctly.

### Coding Standards Updated
Opus added new entries to `AF-Coding-Standards.md` covering:
- FastAPI tab/enum parameter validation (use `Literal` type)
- Server Actions null safety and error handling patterns
- Pre-push lint check requirement for af-platform

---

## What To Do Next Session

### Immediate — Verify v2.83 fully
These were deferred from v2.82 and not yet confirmed:
1. **DG badge** in shipments list for a DG shipment
2. **Files tab badge** pre-populated on page load (not lazily)
3. **File sizes** no longer show NaN KB

### Run migration script (still pending)
```
python af-server/scripts/migrate_005_remove_mypkg_n.py
```
Removes `MYPKG_N` standalone port row. Verify no shipments reference
`MYPKG_N` as a port code directly before running.

### v2.84 — Deferred Bugs + logAction Migration
| Item | Detail |
|---|---|
| Bug 3 | AWB diff not shown on shipment detail page after BL parse apply (DP-48) |
| Bug 4 | Duplicate company section in DocumentParseModal — needs runtime testing to reproduce |
| logAction migration | Move `logAction()` in `auth-server.ts` from Datastore → PostgreSQL `system_logs` table |

### Planned Prompt Sequence (Updated)
| Prompt | Item | Status |
|---|---|---|
| v2.80 | BLUploadTab + CreateShipmentModal split | ✅ Complete |
| v2.81 | User migration — Datastore → PostgreSQL | ✅ Complete |
| v2.82 | Auth hot path migration + bug fixes | ✅ Complete |
| v2.83 | Shipments list routing fix | ✅ Complete |
| v2.84 | Deferred bugs (3, 4) + logAction migration | Next |

---

## Architecture State — Datastore Dependency

After v2.83, Datastore usage in af-platform is limited to:
- `logAction()` in `auth-server.ts` — writes system logs to `AFSystemLogs`

All read operations are on PostgreSQL. `logAction()` migration is the last
remaining Datastore dependency in af-platform.

---

## Active Test Series (Pending Work)

| Series | Pending | Notes |
|---|---|---|
| DP | 22 | Document Parser — most critical active series |
| DT | 15 | DateTime inputs — no work done yet |
| VD | 2 | Vessel display — minor |
| PP | 1 | Port pair — PP-06 ETA sync |

---

## Key Files Modified This Session

| File | Change |
|---|---|
| `af-server/routers/shipments/core.py` | Removed `@router.get("/")` and `@router.post("/")` from list/create |
| `af-server/routers/shipments/__init__.py` | Added `router.add_api_route("")` for list + create |
| `af-server/main.py` | Added `redirect_slashes=False` to FastAPI app (remains) |
| `AF-Coding-Standards.md` | New sections: FastAPI Literal params, Server Action null safety, lint check |
| `claude/prompts/PROMPT-CURRENT.md` | v2.83 debug prompt (now stale — v2.83 complete) |
| `claude/prompts/log/PROMPT-LOG-v2.83-v2.92.md` | v2.83 entry added by Opus |
| `claude/handover/handover-2026-03-03-session-end-v7.md` | This file |

---

## Notes for Next Session

- Read this file + `AF-Test-Master.md` + `PROMPT-LOG-v2.83-v2.92.md` to orient
- v2.83 is stable in production — shipments list and dashboard both working
- The `migrate_005_remove_mypkg_n.py` script is sitting in `af-server/` root,
  ready to run — do this early next session before other work
- Context limit: Claude AI sessions have harder context limits than Claude Code.
  If the session is getting long, wrap up and start fresh rather than risk
  losing context mid-task.
