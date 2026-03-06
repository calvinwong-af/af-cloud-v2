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

| Tool | Version | Install |
|---|---|---|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Python | 3.11 (NOT 3.14 — see CLAUDE.md) | [python.org](https://python.org) |
| Git | Latest | [git-scm.com](https://git-scm.com) |
| Google Cloud CLI | Latest | [cloud.google.com/sdk](https://cloud.google.com/sdk/docs/install) |
| PostgreSQL Client | 18 | [postgresql.org/download](https://www.postgresql.org/download/windows/) |
| Claude Code | Latest | `npm install -g @anthropic-ai/claude-code` |

---

## 3. Windows PATH Configuration

After installing the tools above, add these to your Windows PATH so they resolve from any terminal without full paths.

**How to open PATH editor:**
`Win + R` → `sysdm.cpl` → Advanced → Environment Variables → under **System variables**, select `Path` → Edit

Add the following entries:

| Tool | Path to add |
|---|---|
| PostgreSQL | `C:\Program Files\PostgreSQL\18\bin` |
| Google Cloud CLI | Added automatically by installer |
| Node.js | Added automatically by installer |
| Python 3.11 | Added automatically by installer (check during setup) |

**Verify PATH is working** (open a new terminal after saving):
```powershell
psql --version
gcloud --version
node --version
python --version
```

**psql command for running migrations** (requires proxy running via `tools\start-proxy.bat`):
```powershell
psql -h localhost -p 5432 -U af_server -d accelefreight -f "C:\dev\af-cloud-v2\af-server\migrations\<migration_file>.sql"
```
Password: `Afserver_2019`

---

## 4. Environment files (not in git — copy from old machine or secrets)

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

## 5. Install dependencies

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

## 6. Cloud SQL Auth Proxy (for local PostgreSQL access)

```bash
cd C:\dev\af-cloud-v2
tools\start-proxy.bat
```

This connects to Cloud SQL via `cloud-accele-freight:asia-northeast1:af-db`.

---

## 7. Claude Code settings

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

## 8. Run local dev

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

## 9. Start Claude Code

```bash
cd C:\dev\af-cloud-v2
claude
```

Claude Code will automatically read `CLAUDE.md` and `.claude/settings.local.json` from the repo. The memory file will be loaded from the user profile folder.

---

## 10. Claude Code Skills (`/prompt` and `/prompt-push`)

The repo includes two custom slash-command skills in `.claude/commands/`:

| Skill | File | Purpose |
|---|---|---|
| `/prompt` | `.claude/commands/prompt.md` | Read and execute `claude/prompts/PROMPT-CURRENT.md`, lint/compile check, log to prompt log, then clear the prompt file. Does **not** commit or push. |
| `/prompt-push` | `.claude/commands/prompt-push.md` | Run the full `/prompt` workflow, then `npm run build`, commit, and push. |

These files are checked into the repo, so they are available automatically after cloning — no extra setup needed.

### How to use
Inside a Claude Code session:
```
/prompt          # Execute the current prompt (no commit)
/prompt-push     # Execute the current prompt, build, commit & push
```

### How they work
1. **`/prompt`** reads `claude/prompts/PROMPT-CURRENT.md`, executes all tasks, runs `npm run lint` (platform) and `py_compile main.py` (server) if relevant files changed, logs the result to `claude/prompts/log/`, and clears the prompt file.
2. **`/prompt-push`** does everything `/prompt` does, then runs `npm run build`, stages changed files (excluding `.env.local` and service account keys), commits with a descriptive message + `Co-Authored-By` trailer, and pushes.

### Verify skills are loaded
After starting Claude Code, the skills should appear in the autocomplete when you type `/`. If they don't, confirm the files exist:
```bash
ls .claude/commands/
# Should show: prompt.md  prompt-push.md
```

---

## 11. Verify everything works

```bash
# Server compiles
cd af-server && .venv/Scripts/python -m py_compile main.py

# Platform builds
cd af-platform && npm run lint && npm run build

# Claude Code skills work
# In Claude Code, type: /prompt
```
