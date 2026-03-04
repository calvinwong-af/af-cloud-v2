# Handover — 03 March 2026 (Session End — v2.81 running)

## Session Summary
This session verified v2.80 (three-part frontend split), fixed two bugs found
during smoke testing, logged new bugs/features, and wrote + dispatched the v2.81
prompt (User migration — Datastore → PostgreSQL). A parallel API Contract session
is planned to run alongside ongoing development.

---

## Current System State

### Versions
| Item | Value |
|---|---|
| Last completed prompt | v2.80 ✅ |
| Currently running | v2.81 (Opus — User migration Datastore → PostgreSQL) |
| Next prompt | v2.82 (Bug fixes) |
| Test master version | 2.51 |

### Stats
| Metric | Value |
|---|---|
| Total Orders | 2,035 |
| Active | 19 |
| Draft | 0 |

---

## What Was Done This Session

### v2.80 — Verified Complete ✅
Three-part frontend split confirmed working:
- `page.tsx`: 1,759 → 496 lines
- `BLUploadTab`: 1,131 → 383 lines → `_bl-upload/` (3 components)
- `CreateShipmentModal`: 1,029 → 530 lines → `_create-shipment/` (5 steps + _constants + _types)
- New shipment AF-003873 created successfully during smoke test

### Bug Fixed — Terminal selector reset (v2.80 regression)
- **Symptom:** Clicking Northport in terminal selector reverted to Westports
- **Root cause:** `useEffect` deps included `activePorts` (new array ref every render), causing auto-select to fire repeatedly
- **Fix:** Changed deps from `[originCode, activePorts]` / `[destCode, activePorts]` to `[originCode, orderType]` / `[destCode, orderType]` in `CreateShipmentModal.tsx`

### Bug Fixed — Port Klang (North Port) appearing as standalone port in dropdown
- Identified `MYPKG_N` still exists as a row in the `ports` table
- Should have been removed when PT series migrated Northport to terminal_id on MYPKG
- Logged as bug #5 for v2.82

### DG Badge Investigation
- Attempted to add DG badge to shipment list TYPE column
- Root cause found: `list_shipments` SQL query does not select `cargo` JSONB at all
- Added `(s.cargo->>'is_dg')::boolean AS cargo_is_dg` to SQL + `cargo_is_dg` to items dict in `db_queries.py`
- Frontend updated to check `(order as any).cargo_is_dg`
- Badge still not showing — deferred for v2.82 with full DG feature work

### Strategic Decisions
- **API Contract session:** Will run as a dedicated parallel Claude AI session, not blocking development. Start after v2.81 is verified (so User object shape is final before writing the User section). Output: `claude/other/AF-API-Contract.md`
- **DG feature:** All DG work to be addressed together in v2.82 — badge in list, indicator in detail, edit toggle + description field, `Cargo` type cleanup in `types.ts`

### v2.81 Prompt Written
Saved to `claude/prompts/PROMPT-CURRENT.md`. Key details:
- New `users` PostgreSQL table (flat — consolidates UserAccount + UserIAM + CompanyUserAccount)
- Migration script `scripts/migrate_users.py`
- `_build_claims()` in `auth.py` rewritten — single PG query on uid (hot path)
- Full `routers/users.py` replacing stub (list, create, update, delete, reset password, `/me`)
- `lib/users.ts` + `actions/users.ts` in af-platform rewritten to call af-server
- DS-03 closes automatically after this prompt
- **Critical deploy order:** run migration script BEFORE deploying new `_build_claims()` or all logins break

---

## Bugs Logged to v2.82
| # | Bug | Source |
|---|---|---|
| 1 | File size showing NaN KB in Files tab | Pre-existing |
| 2 | Files tab badge not pre-populated on page load | Pre-existing |
| 3 | DP-48: AWB diff not shown on Parties card after apply | Pre-existing |
| 4 | Company/Shipment Owner renders twice in DocumentParseModal | v2.79 regression |
| 5 | MYPKG_N still exists as standalone port row in ports table | PT series gap |
| 6 | DG indicator missing in shipment detail Overview tab | New feature |
| 7 | DG edit toggle + description field in detail page | New feature |

### DG Tech Debt (v2.83 / API Contract)
- `Cargo` type in `types.ts` has `dg_classification: DGClassification | null` but DB stores `is_dg: boolean` — mismatch to resolve in API contract session

---

## What To Do Next Session

1. **Verify v2.81** when Opus finishes:
   - Run `migrate_users.py --dry-run` → confirm user count looks right
   - Run `migrate_users.py` → confirm all users inserted
   - Restart af-server — confirm login still works
   - Navigate to `/users` — full user list renders with correct roles/companies
   - Create a new user — appears in list
   - Deactivate a user — login blocked
   - Reset password — user can log in with new password
   - DS-03 → mark YES in `tests/series/DS-datastore.md`

2. **Open parallel API Contract session** — start after v2.81 verified so User shape is final

3. **Write v2.82 prompt** — bug fixes (7 bugs + DG feature)

---

## Planned Prompt Sequence (Updated)
| Prompt | Item | Status |
|---|---|---|
| v2.80 | BLUploadTab + CreateShipmentModal split | ✅ Complete |
| v2.81 | User migration — Datastore → PostgreSQL | 🔄 Running in Opus |
| v2.82 | Bug fixes (7 bugs + DG feature) | Next |
| v2.83 | API Contract Document (parallel session) | Planned |

---

## Key Files Modified This Session
| File | Change |
|---|---|
| `af-platform/src/components/shipments/CreateShipmentModal.tsx` | Terminal selector useEffect deps fix |
| `af-platform/src/components/shipments/ShipmentOrderTable.tsx` | DG badge added (not yet working) |
| `af-server/core/db_queries.py` | Added `cargo_is_dg` to list_shipments SQL |
| `claude/prompts/PROMPT-CURRENT.md` | v2.81 prompt written |
| `claude/handover/handover-2026-03-03-session-end-v5.md` | This file |
