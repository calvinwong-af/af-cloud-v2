# New PC Setup Guide — AcceleFreight V2 Development

**Purpose:** Restore full Claude Code + dev environment on a new machine.

---

## 1. Clone the repo

```bash
mkdir C:\dev
cd C:\dev
git clone https://github.com/calvinwong-af/af-cloud-v2.git
cd af-cloud-v2
```

---

## 2. Prerequisites

Install these before anything else:

| Tool | Install |
|---|---|
| Node.js 20+ | https://nodejs.org |
| Python 3.11 | https://python.org (NOT 3.14 — see CLAUDE.md) |
| Git | https://git-scm.com |
| Google Cloud CLI | https://cloud.google.com/sdk/docs/install |
| Claude Code | `npm install -g @anthropic-ai/claude-code` |

---

## 3. Environment files (not in git — copy from old machine or secrets)

**af-server/.env.local:**
```
DATABASE_URL=postgresql+psycopg2://af_server:<PASSWORD>@localhost:5432/accelefreight
INSTANCE_CONNECTION_NAME=cloud-accele-freight:asia-northeast1:af-db
DB_USER=af_server
DB_PASS=<PASSWORD>
DB_NAME=accelefreight
GOOGLE_CLOUD_PROJECT=cloud-accele-freight
```

**af-server/cloud-accele-freight-b7a0a3b8fd98.json** — GCP service account key (copy from old machine)

**af-platform/.env.local:**
```
AF_SERVER_URL=http://localhost:8000
NEXT_PUBLIC_FIREBASE_API_KEY=<from Firebase console>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=cloud-accele-freight.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=cloud-accele-freight
FIREBASE_API_KEY=<same as NEXT_PUBLIC>
```

---

## 4. Install dependencies

```bash
# af-platform
cd C:\dev\af-cloud-v2\af-platform
npm install

# af-server
cd C:\dev\af-cloud-v2\af-server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

---

## 5. Cloud SQL Auth Proxy (for local PostgreSQL access)

```bash
cd C:\dev\af-cloud-v2
tools\start-proxy.bat
```

This connects to Cloud SQL via `cloud-accele-freight:asia-northeast1:af-db`.

---

## 6. Claude Code settings

### Global settings
Create `C:\Users\<username>\.claude\settings.json`:
```json
{
  "effortLevel": "medium"
}
```

### Project permissions
Create `C:\dev\af-cloud-v2\.claude\settings.local.json`:
```json
{
  "permissions": {
    "allow": [
      "Bash(cd:*)",
      "Bash(cd /c/dev/af-cloud-v2/af-platform && npm run build 2>&1)",
      "Bash(ls:*)",
      "Bash(tail:*)",
      "Bash(git pull:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(npm run:*)",
      "Bash(firebase deploy:*)",
      "Bash(npx tsc:*)",
      "Bash(node:*)",
      "Bash(python:*)",
      "Bash(gcloud builds:*)",
      "Bash(gcloud artifacts:*)",
      "Bash(gcloud iam:*)",
      "Bash(gcloud projects:*)",
      "Bash(gcloud logging:*)",
      "Bash(gcloud run:*)",
      "Bash(source:*)",
      "Bash(cat:*)",
      "Bash(.venv/Scripts/python.exe:*)",
      "Bash(.venv/Scripts/python:*)",
      "Bash(.venv/Scripts/pip.exe install:*)",
      "Bash(git status:*)",
      "Bash(git checkout:*)",
      "Bash(npx eslint:*)",
      "Bash(npx next:*)",
      "mcp__filesystem__list_directory",
      "mcp__filesystem__directory_tree",
      "mcp__filesystem__read_text_file",
      "mcp__filesystem__get_file_info"
    ]
  }
}
```

### Auto-memory
Create `C:\Users\<username>\.claude\projects\C--dev-af-cloud-v2\memory\MEMORY.md`:
```markdown
# AF Cloud V2 - Project Memory

## Project Structure
- Monorepo: `af-web` (public site, complete), `af-platform` (internal platform, in progress)
- af-platform: Next.js 14 App Router, React 18, Tailwind 3, Firebase Auth
- af-server: FastAPI, SQLAlchemy Core, PostgreSQL (Cloud SQL)
- Fonts: Syne (display), Outfit (body), JetBrains Mono (mono)
- Icons: Lucide React
- No component library — pure Tailwind + custom components

## Key Conventions
- **AFC = Customer, AFU = Staff** (counterintuitive, documented in users.ts TODO)
- Server Components default, `"use client"` for interactivity
- Server Actions in `app/actions/` wrap lib functions
- CSS variables for theming: `--sky`, `--text`, `--surface`, `--border`, etc.
- `cn()` utility for conditional Tailwind classes

## User Preferences
- **Always proceed with commit+push** — never ask for confirmation when there are pending changes to commit/push. Just do it.
- **Always activate af-server venv automatically** — run `source .venv/Scripts/activate` before any Python commands without waiting for user.

## Build & Commit Rules
- **Do NOT run `npm run build` after every change** — test locally first (`npm run dev`). Only run build when explicitly requested or via `/prompt-push` skill.
- **Always run `cd af-platform && npm run lint`** before committing platform changes — Cloud Build fails on ESLint errors that `npm run dev` silently ignores
- **Always commit and push handover notes** (`AF-Handover-Notes-v2_*.md`)

## Prompt Log System
- Prompt completion logs live in `claude/prompts/log/` as versioned archive files
- Naming: `PROMPT-LOG-v2.XX-v2.YY.md` — 10 entries per file
- Active file: highest-numbered archive file (insert new entries at top, below header)
- **Descending order** — latest revision at the top of each file
```

> **Note:** The memory folder path encodes the project directory. On a different drive or path, the folder name will differ. Claude Code creates it automatically on first run — you just need to copy the MEMORY.md content into it.

---

## 7. Run local dev

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

## 8. Start Claude Code

```bash
cd C:\dev\af-cloud-v2
claude
```

Claude Code will automatically read `CLAUDE.md` and `.claude/settings.local.json` from the repo. The memory file will be loaded from the user profile folder.

---

## 9. Verify everything works

```bash
# Server compiles
cd af-server && .venv/Scripts/python -m py_compile main.py

# Platform builds
cd af-platform && npm run lint && npm run build

# Claude Code skills work
# In Claude Code, type: /prompt
```
