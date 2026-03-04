# Session Handover — Session 26 → Session 27
**Date:** 05 March 2026
**Platform:** AcceleFreight v2 (af-cloud-v2)
**Session type:** New PC Setup

---

## What Was Done This Session

This session was entirely dedicated to setting up the new development PC from scratch. No code changes were made. All development environment components are now confirmed working.

### New PC Setup — Completed

| # | Task | Status |
|---|---|---|
| 1 | Node.js LTS installed | ✅ Done |
| 2 | MCP filesystem connected to C:\dev\af-cloud-v2 | ✅ Done |
| 3 | Repo cloned to C:\dev\af-cloud-v2 | ✅ Done |
| 4 | Google Cloud CLI installed + gcloud init | ✅ Done |
| 5 | gcloud signed in as calvin.wong@accelefreight.com | ✅ Done |
| 6 | Default project set to cloud-accele-freight | ✅ Done |
| 7 | Default region set to asia-northeast1-a | ✅ Done |
| 8 | Python 3.11.9 installed (last 3.11 with Windows binary installer) | ✅ Done |
| 9 | Python PATH fixed (disabled Microsoft Store alias via App Execution Aliases) | ✅ Done |
| 10 | af-server .venv created + pip install -r requirements.txt | ✅ Done |
| 11 | af-platform npm install | ✅ Done |
| 12 | af-server .env.local copied + cloud-accele-freight-key.json in place | ✅ Done |
| 13 | af-platform .env.local copied | ✅ Done |
| 14 | Cloud SQL Auth Proxy downloaded (tools\download-proxy.ps1) | ✅ Done |
| 15 | gcloud auth application-default login completed | ✅ Done |
| 16 | All 3 local dev servers running (proxy, FastAPI, Next.js) | ✅ Done |
| 17 | VS Code installed + Claude Code extension installed | ✅ Done |
| 18 | Claude Code CLI installed (npm install -g @anthropic-ai/claude-code) | ✅ Done |

### Key Windows Gotchas Encountered This Session

1. **MCP MSIX bug** — "Edit Config" opens wrong config file. Must edit at:
   `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json`

2. **npx wrapper required** — MCP filesystem on Windows requires `cmd /c` wrapper or direct `npx` call

3. **Python PATH** — Python 3.11.9 installer did not add to PATH automatically. Fixed via:
   - Adding `C:\Users\calvi\AppData\Local\Programs\Python\Python311` to User PATH
   - Adding `C:\Users\calvi\AppData\Local\Programs\Python\Python311\Scripts` to User PATH
   - Disabling Microsoft Store python.exe / python3.exe aliases in App Execution Aliases

4. **PowerShell execution policy** — Required `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` before .venv activation

5. **Python 3.11 binary installers** — 3.11.9 is the last 3.11 release with a Windows binary installer. 3.11.10+ are source-only security releases. Always use 3.11.9 for new machine setup.

6. **Application Default Credentials** — Cloud SQL Auth Proxy requires `gcloud auth application-default login` separately from `gcloud init`

---

## Current State (carried over from Session 25)

### Timing Architecture (finalised)

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

### Status Auto-Progression (confirmed working)

| Trigger | Result |
|---|---|
| ATD set on POL task (TRACKED) | In Transit / Departed 4001 |
| ATD set via BL apply (if POL task has actual_end) | In Transit / Departed 4001 |
| ATA set on POD task (TRACKED) | Arrived 4002 |

### Test Status
270/284 passing (unchanged). New tests for v4.04–v4.07 not yet formally added to test series.

---

## Open Backlog

| # | Item | Priority |
|---|---|---|
| UI-05 | No ability to edit order details on detail page | Medium |
| UI-09 | Read File opens legacy dialog (all doc types) | Medium |
| MAP-01 | Route Map not rendering — needs network tab debug on prod | Medium |
| UI-01 | Keyboard arrow nav on all combobox/dropdowns | Low |
| UI-02/04 | Port list filtered by freight type in PortEditModal | Low |
| UI-03 | Port edit pencil icon position on RouteCard | Low |

---

## Next Session

New PC fully set up — ready to resume development. Suggested starting points:
- **MAP-01** — Route Map not rendering on prod (network tab debug)
- **UI-05** — Edit order details on shipment detail page
- **UI-09** — Read File opens legacy dialog

Read handover + PROMPT-LOG + API contract at session start before proceeding.

---

## Key File Locations

| Item | Path |
|---|---|
| Prompt log (active) | claude/prompts/log/PROMPT-LOG-v4.01-v4.10.md |
| API contract | claude/other/AF-API-Contract.md v1.4 |
| Tasks router | af-server/routers/shipments/tasks.py |
| BL apply router | af-server/routers/shipments/bl.py |
| Route nodes router | af-server/routers/shipments/route_nodes.py |
| PortPair component | af-platform/src/components/shared/PortPair.tsx |
| Shipment detail page | af-platform/src/app/(platform)/shipments/[id]/page.tsx |
| Status constants | af-server/core/constants.py |
