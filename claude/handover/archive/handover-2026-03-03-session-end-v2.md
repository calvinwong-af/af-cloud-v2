# Handover — 03 March 2026 (Session End — v2.77 queued)

## Session Summary
This session covered live testing of AWB apply (v2.73/v2.74 results), three completed
prompts (v2.74 tag labels, v2.75 test restructure, v2.76 AWB UX), a new modularization
plan, and preparation of v2.77 (shipments.py split). v2.77 is queued for Opus in the
next session.

---

## Current System State

### Versions
| Item | Value |
|---|---|
| Last completed prompt | v2.76 |
| Next prompt to run | v2.77 (queued in PROMPT-CURRENT.md) |
| Test master version | 2.51 (post v2.75 restructure) |
| Prompt log file | claude/prompts/log/PROMPT-LOG-v2.73-v2.82.md |

### Stats (unchanged)
| Metric | Value |
|---|---|
| Total Orders | 2,043 |
| Active | 23 |
| Completed | 2,019 |
| Draft | 1 |
| To Invoice | 8 |

---

## What Was Done This Session

### Live Test — AF-003861 AWB Apply
- AWB parsed and applied successfully
- Three UX gaps identified from screenshots:
  1. No diff indicator when AWB-applied parties differ from current shipment parties
  2. Files tab not updating after AWB apply (badge count + list)
  3. No loading/blocked state during apply operation

### v2.74 — File Tag Display Labels
- Added `KNOWN_ACRONYMS` set + `formatTagLabel()` helper to ShipmentFilesTab.tsx
- Tags now display: `awb` → `AWB`, `bl` → `BL`, `packing_list` → `Packing List` etc.
- Display-only — stored values remain lowercase

### v2.75 — Test List Modularization
- `AF-Test-List.md` (29 KB) replaced by modular structure:
  - `claude/tests/AF-Test-Master.md` — series registry dashboard (24 rows)
  - `claude/tests/series/` — 24 individual series files
  - `claude/tests/AF-Test-Archive.md` — untouched
- AF-Test-List.md deleted

### v2.76 — AWB Apply UX Fixes
- Issue 1: `currentParties` prop added to DocumentParseModal — amber diff badge
  shown when AWB-parsed shipper/consignee differs from current shipment parties
- Issue 2: `refreshKey` prop + skip-first-render useEffect added to ShipmentFilesTab;
  `filesRefreshKey` state in page.tsx incremented after successful file save;
  `router.refresh()` called after apply; saveDocumentFileAction errors now logged
- Issue 3: `isApplying` state added to DocumentParseModal — spinner + "Applying..."
  during apply, modal non-dismissible, 800ms success state before close
- DP series extended: DP-41–DP-47 added (26 PENDING total, 47 total)

### v2.77 — Queued (not yet run)
Split `af-server/routers/shipments.py` (118 KB) into a package:
```
routers/shipments/
  __init__.py, _helpers.py, _prompts.py
  core.py, status.py, bl.py, files.py
  tasks.py, route_nodes.py, doc_apply.py
```
Pure refactor — no functional changes. See PROMPT-CURRENT.md for full details.

---

## Modularization Plan (Multi-Session)

Three code splits planned across upcoming sessions:

| Prompt | Target | Size | Status |
|---|---|---|---|
| v2.77 | `af-server/routers/shipments.py` | 118 KB → 10 files | Queued |
| v2.78 | `af-platform/.../shipments/[id]/page.tsx` | 77 KB → 5 files | Planned |
| v2.79 | `BLUploadTab.tsx` + `CreateShipmentModal.tsx` | 49+45 KB | Planned |

Also planned (AI session files):
- Handover folder: rolling 3-file window policy + `archive/` subfolder
- Test series: completed series stay in `series/` files (no further action needed)

---

## What To Do Next Session

1. **Run v2.77 in VS Code (Opus)** — shipments.py split
2. **Smoke test after v2.77:**
   - Server starts with zero import errors
   - `GET /api/v2/shipments/stats` returns 200
   - `GET /api/v2/shipments/file-tags` returns 200 (tests static-before-dynamic route order)
   - `GET /api/v2/shipments/AF-003861` returns correct shipment data
3. **Write and run v2.78** — page.tsx split
4. **Write and run v2.79** — BLUploadTab + CreateShipmentModal split
5. **Continue DP pending tests** (DP-41–DP-47 from v2.76, plus earlier pending DP tests)

---

## Test Structure (Post v2.75)

| File | Purpose |
|---|---|
| `claude/tests/AF-Test-Master.md` | Series registry — read this first each session |
| `claude/tests/series/DP-document-parse.md` | Active: 47 total, 26 PENDING |
| `claude/tests/series/DT-datetime.md` | Active: 16 total, 15 PENDING |
| `claude/tests/series/VD-vessel-display.md` | Active: 7 total, 2 PENDING |
| `claude/tests/series/PP-port-pair.md` | Active: 9 total, 1 PENDING |
| `claude/tests/series/DS-datastore.md` | Active: 4 total, 1 PENDING |
| `claude/tests/series/BUG2-bugfixes.md` | Active: 2 total, 1 DEFERRED |
| `claude/tests/series/MB-mobile.md` | Deferred: 13 total, 11 DEFERRED |

---

## Key Architecture Decisions

### JSONB Best Practice (permanent)
Always use `_parse_jsonb()` for all JSONB column reads from PostgreSQL via SQLAlchemy.
Never use `json.loads()` directly on a DB row column.

### Document File Saving Pattern
- Data apply endpoints (apply-awb, apply-booking-confirmation) handle DB writes only
- File save handled by separate `POST /{id}/save-document-file` endpoint
- Frontend calls file save after successful data apply
- BL is the exception — saves inline (preserved)

### Modularization Principles
- Sub-modules import from `_helpers.py` freely
- Sub-modules must NOT import from each other except `tasks.py` → `core.py` for `_lazy_init_tasks_pg`
- `_helpers.py` and `_prompts.py` are dependency leaves — no cross-imports
- Route order in `__init__.py`: core → status → bl → files → tasks → route_nodes → doc_apply

### Test File Convention (post v2.75)
- Read `AF-Test-Master.md` at session start for overview
- Read only the specific series file(s) relevant to current session work
- When series reaches all-YES: update status to ✅ Complete in master only — series file stays in `series/`
- New series: create file in `series/` + add row to master

---

## Files Modified This Session
| File | Change |
|---|---|
| `af-platform/src/components/shipments/ShipmentFilesTab.tsx` | v2.74: formatTagLabel helper |
| `af-platform/src/components/shipments/DocumentParseModal.tsx` | v2.76: currentParties diff badge, isApplying state |
| `af-platform/src/components/shipments/ShipmentFilesTab.tsx` | v2.76: refreshKey prop |
| `af-platform/src/app/(platform)/shipments/[id]/page.tsx` | v2.76: filesRefreshKey state, router.refresh() |
| `claude/tests/AF-Test-Master.md` | v2.75: created (new structure) + v2.76: DP counts updated |
| `claude/tests/series/*.md` | v2.75: 24 series files created |
| `claude/tests/AF-Test-List.md` | v2.75: deleted |
| `claude/tests/series/DP-document-parse.md` | v2.76: DP-41–DP-47 added |
| `claude/prompts/PROMPT-CURRENT.md` | v2.77 queued |
| `claude/prompts/log/PROMPT-LOG-v2.73-v2.82.md` | v2.73–v2.76 logged |
