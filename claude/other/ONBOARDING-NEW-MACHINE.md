# Claude App Onboarding Prompt — AcceleFreight V2
**Purpose:** Load this at the start of a new session on a new machine to restore full context and working setup.

---

## Prompt to paste into Claude.ai

---

Hi Claude, I'm Calvin. I'm continuing development on the AcceleFreight V2 platform on a new machine. Please read my project files to restore context before we continue.

The project repo is at: `C:\dev\af-cloud-v2`

Please read the following files in order using MCP filesystem tools:

1. `C:\dev\af-cloud-v2\claude\handover\AF-Handover-Notes-v2_34.md` — latest session handover
2. `C:\dev\af-cloud-v2\claude\tests\AF-Test-List.md` — current test list and statuses

Once read, please confirm:
- The three fixes from the last session that are pending deployment
- Current dashboard stats
- Recommended first action for this session

---

## MCP Filesystem Setup (new machine checklist)

Before starting, make sure the MCP filesystem server is connected in Claude.ai:

1. Open **Claude.ai → Settings → Integrations / Connectors**
2. Ensure the **Filesystem MCP server** is connected and pointing to:
   `C:\dev\af-cloud-v2`
3. If not connected, the MCP server config should be:
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
4. Restart Claude desktop app after adding the config if needed

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

1. **Deploy the three pending fixes to production** (if not done yet):
   ```
   git add af-server/routers/shipments.py
   git add af-platform/src/app/actions/shipments.ts
   git add af-server/core/db_queries.py
   git commit -m "fix: PG 500 errors on shipment detail + list sort order"
   ```
   Then deploy af-server and af-platform to Cloud Run.

2. **Verify on production** — appv2.accelefreight.com
   - Shipments list loads in correct order (highest ID first)
   - AF-003830, AF-003844 detail pages load without 500

3. **Update shipment data** as needed (Calvin's operational task)
