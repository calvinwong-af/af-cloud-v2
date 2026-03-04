# Session Handover — Session 25 → Session 26
**Date:** 05 March 2026
**Platform:** AcceleFreight v2 (af-cloud-v2)
**Session type:** Design + Prompt Prep + Verification

---

## What Was Done This Session

This session completed a multi-prompt arc (v4.03–v4.07) focused on route card timing, single source of truth, and auto status progression. All prompts executed by Opus and verified via screenshots.

### v4.04 — Task Leg Timing Sync + Route Node Edit Deprecation
- Backend: TRACKED POL/POD task saves sync timing to route_nodes JSONB
- Frontend: TimingEditPanel removed from RouteNodeTimeline — timeline is now display-only
- onTimingChanged callback wired to refresh route card after task timing saves

### v4.05 — Single Source of Truth (Route Card reads from task legs)
- Key design pivot: Route Card now reads timing directly from workflow task legs, not route_nodes
- POL task: scheduled_end = ETD, actual_end = ATD, scheduled_start = ETA at POL
- POD task: scheduled_start = ETA, actual_start = ATA
- Route node timing sync removed from tasks.py backend
- Route node timeline remains display-only for port identity only

### v4.06 — Route Card Display + Status Button Label
- Route Card shows stacked planned/actual timing (both visible simultaneously)
- EXPORT transaction type: origin shows ETA + ETD/ATD stacked
- IMPORT: origin shows ETD/ATD only
- Destination always shows ETA/ATA stacked
- "Advance to In Transit" button label (was "Advance to Departed") — status code 4001 unchanged
- onTimingChanged now also calls loadOrder() to refresh status card

### v4.07 — Timing Layout Polish + BL Apply Status Fix — VERIFIED
- No strikethrough on ETD when ATD is set — colour contrast used instead (muted = planned, sky = actual)
- Timing moved to bottom row of Route Card — below vessel line, spanning full width
- BL "Read file again" now triggers In Transit — backend checks if POL task has actual_end set and auto-advances status if below 4001
- Screenshot confirmed: status node advances to In Transit (Departed sub-label) after BL re-read

---

## Current Timing Architecture (finalised)

| Data | Source of Truth | Notes |
|---|---|---|
| ETD planned departure | POL task scheduled_end | TRACKED mode only |
| ATD actual departure | POL task actual_end | TRACKED mode only |
| ETA at POL | POL task scheduled_start | Shown on Route Card for EXPORT only |
| ETA planned arrival | POD task scheduled_start | TRACKED mode only |
| ATA actual arrival | POD task actual_start | TRACKED mode only |
| shipments.etd flat col | Derived copy | Synced from POL task on save |
| shipments.eta flat col | Derived copy | Synced from POD task on save |
| route_nodes timing fields | Deprecated | Display-only cosmetic — not read by Route Card |

## Status Auto-Progression (confirmed working)

| Trigger | Result |
|---|---|
| ATD set on POL task (TRACKED) | In Transit / Departed 4001 |
| ATD set via BL apply (if POL task has actual_end) | In Transit / Departed 4001 |
| ATA set on POD task (TRACKED) | Arrived 4002 |

---

## Test Status

270/284 passing (unchanged this session). New tests for v4.04–v4.07 features not yet formally added to test series — to be done in a future session.

---

## Open Backlog

| # | Item | Priority |
|---|---|---|
| UI-01 | Keyboard arrow nav on all combobox/dropdowns | Low |
| UI-02/04 | Port list filtered by freight type in PortEditModal | Low |
| UI-03 | Port edit pencil icon position on RouteCard | Low |
| UI-05 | No ability to edit order details on detail page | Medium |
| UI-09 | Read File opens legacy dialog (all doc types) | Medium |
| MAP-01 | Route Map not rendering — needs network tab debug on prod | Medium |

---

## Next Session — New PC Setup First

Before any development work, environment setup required on new machine:

1. Clone repo: git clone to C:\dev\af-cloud-v2
2. Install Node.js LTS, Python 3.11, Google Cloud SDK
3. Set up .venv in af-server: python3.11 -m venv .venv
4. pip install -r requirements.txt (inside .venv)
5. cd af-platform && npm install
6. Configure .env.local for both af-server and af-platform
7. Install Cloud SQL Auth Proxy (tools\start-proxy.bat)
8. Verify local dev: three terminals — Proxy, FastAPI uvicorn main:app --reload --port 8000, Next.js npm run dev
9. Install VS Code + Claude extension (Opus 4.6)
10. Confirm MCP filesystem connectivity to C:\dev\af-cloud-v2

After setup confirmed, resume from backlog — suggested starting point: MAP-01 route map debug or new feature work.

---

## Known MCP Setup Bugs on Windows

### Bug 1 — Wrong config file location (MSIX install)
The "Edit Config" button in Claude Desktop Developer settings opens:
  %APPDATA%\Claude\claude_desktop_config.json

But the app actually READS from the MSIX virtualized path:
  %LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json

Result: MCP servers silently fail to load with no error or indication anything is wrong.

Fix: Edit the file at the LOCALAPPDATA virtualized path directly, not the one the UI opens.
Alternatively merge mcpServers config into the file that already exists at the virtualized path
(it may already contain app preferences like coworkScheduledTasksEnabled).

### Bug 2 — UTF-16 file encoding
MCP filesystem tool on Windows saves files as UTF-16 by default.
CLI tools (gcloud, etc.) require UTF-8 and will fail silently or with encoding errors.

Fix: After MCP creates any file that will be consumed by a CLI tool, rewrite it in UTF-8:
  import pathlib
  content = pathlib.Path('file.yaml').read_text(encoding='utf-16')
  pathlib.Path('file.yaml').write_text(content, encoding='utf-8')

### Bug 3 — Always use full absolute paths
MCP file operations must use full absolute Windows paths (e.g. C:\dev\af-cloud-v2\...).
Relative paths silently fail or write to unexpected locations.

---

## Key File Locations

| Item | Path |
|---|---|
| Prompt log | claude/prompts/log/PROMPT-LOG-v4.01-v4.10.md |
| API contract | claude/other/AF-API-Contract.md v1.4 |
| Tasks router | af-server/routers/shipments/tasks.py |
| BL apply router | af-server/routers/shipments/bl.py |
| Route nodes router | af-server/routers/shipments/route_nodes.py |
| PortPair component | af-platform/src/components/shared/PortPair.tsx |
| Shipment detail page | af-platform/src/app/(platform)/shipments/[id]/page.tsx |
| Status constants | af-server/core/constants.py |
