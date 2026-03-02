# Claude App Onboarding Prompt — AcceleFreight V2
**Purpose:** Load this at the start of a new session on a new machine to restore full context and working setup.

---

## Prompt to paste into Claude.ai

---

Hi Claude, I'm Calvin. I'm continuing development on the AcceleFreight V2 platform on a new machine. Please read my project files to restore context before we continue.

The project repo is at: `C:\dev\af-cloud-v2`

Please read the following files in order using MCP filesystem tools:

1. `C:\dev\af-cloud-v2\claude\handover\` — read the **highest numbered** handover file (e.g. AF-Handover-Notes-v2_35.md)
2. `C:\dev\af-cloud-v2\claude\tests\AF-Test-List.md` — current test list and statuses

Once read, please confirm:
- Summary of the last session's changes
- Current dashboard stats
- Recommended first action for this session

---

## MCP Filesystem Setup (new machine checklist)

### ⚠️ Windows MSIX Bug — Read This First

Claude Desktop on Windows is distributed as an MSIX package. It has a known bug where the **"Edit Config" button opens the wrong config file**. The app reads from a virtualized path but the button opens a different file — changes made via the button have no effect.

**Do NOT use the Edit Config button.** Manually edit the correct file instead.

**Step 1 — Find the correct config file:**

Open File Explorer and navigate to:
```
%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\
```
The file to edit is: `claude_desktop_config.json`

> Tip: paste the path directly into the File Explorer address bar. The `Claude_pzs8sxrjxfjjc` folder name contains a unique suffix — if it differs on your machine, look for any folder starting with `Claude_` under `%LOCALAPPDATA%\Packages\`.

**Step 2 — Edit the config file:**

Open `claude_desktop_config.json` in Notepad or VS Code and set the contents to:
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:\\dev\\af-cloud-v2"
      ]
    }
  }
}
```

**Step 3 — Restart Claude Desktop** fully (quit from system tray, reopen).

**Step 4 — Verify:** Start a new chat. If MCP is connected, Claude will have filesystem tools available. You can confirm by asking Claude to list files in `C:\dev\af-cloud-v2\claude\`.

> This bug is tracked in Claude Desktop GitHub issues #26073, #28231, #4201. The workaround is permanent until Anthropic patches MSIX config handling.

---

## Local Dev Environment (new machine checklist)

Make sure these are running before testing:

**Terminal 1 — Cloud SQL Auth Proxy:**
```
cd C:\dev\af-cloud-v2
tools\start-proxy.bat
```

**Terminal 2 — FastAPI Server:**
```
cd C:\dev\af-cloud-v2\af-server
.venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

**Terminal 3 — Next.js Platform:**
```
cd C:\dev\af-cloud-v2\af-platform
npm run dev
```

Test at: http://localhost:3000/shipments

---

## First Actions This Session

1. **Read the latest handover file** (highest numbered in `claude/handover/`) to restore full context.
2. **Check pending deployments** — confirm whether last session's changes are deployed to production.
3. **Verify on production** — appv2.accelefreight.com
4. **Continue from recommended next steps** in the handover notes.
