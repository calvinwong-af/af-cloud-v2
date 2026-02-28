# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Autonomy

Claude has standing permission to proceed with all queried processes without asking for confirmation. This includes:
- Running builds, linters, and tests
- Reading and editing files
- Running shell commands (git, npm, pip, etc.)
- Creating commits when asked
- Installing dependencies

Do not pause to ask "should I proceed?" — just do it.

---

## Required Reading

**Before writing any code, read `AF-Coding-Standards.md` in this repo root.**
It contains rules and patterns derived from real bugs encountered in this project. Following it avoids repeated debugging cycles.

---

## Claude File Locations

All AI-assisted project management files live under `claude/` in the repo root.
Do not write these files to the repo root.

| File | Path |
|---|---|
| Active Opus prompt | `claude/prompts/PROMPT-CURRENT.md` |
| Test list | `claude/tests/AF-Test-List.md` |
| Handover notes | `claude/handover/AF-Handover-Notes-v2_XX.md` |
| Prompt completion log | `claude/PROMPT-LOG.md` |

### Rules
- Handover notes are written by Claude AI (Sonnet) via MCP at session end, only when prompted
- `PROMPT-CURRENT.md` is overwritten each time a new prompt is prepared; cleared to `_No active prompt._` after Opus executes it
- `AF-Test-List.md` is updated alongside each handover note
- Opus reads `PROMPT-CURRENT.md` from `claude/prompts/` — not the repo root

### Prompt Completion Log (`claude/PROMPT-LOG.md`)
**Rule:** After completing any prompt (from `PROMPT-CURRENT.md` or user-issued tasks), Claude MUST append an entry to `claude/PROMPT-LOG.md` with the following format:

```markdown
### [YYYY-MM-DD HH:MM UTC] — Prompt Title
- **Status:** Completed | Partial | Failed
- **Tasks:** Brief list of what was done
- **Files Modified:** List of changed files
- **Notes:** Any issues, blockers, or follow-ups (optional)
```

- Append to the file — never overwrite previous entries
- Use UTC timestamps
- Log every prompt execution, including partial completions and failures
- If a prompt has multiple tasks, report status per task

---

## Project Overview

Monorepo: `af-cloud-v2/`

| Module | Domain | Status |
|---|---|---|
| `af-web/` | accelefreight.com | Live (Firebase Hosting, static) |
| `af-platform/` | appv2.accelefreight.com | In progress (Next.js, Cloud Run) |
| `af-server/` | api.accelefreight.com | In progress (FastAPI, local only) |

**Do not touch:**
- `alfred.accelefreight.com` — old Vue TMS, still live
- `af-cloud-webserver` — old Flask/GAE server, still live
- Any V1 Datastore records — read-only from V2. Never write to V1 `Quotation` or `ShipmentOrder` records except via the explicit V1 status write path in `af-server`.

---

## Stack

| Layer | Tech |
|---|---|
| Platform frontend/SSR | Next.js 14 App Router (TypeScript, React 18) |
| Server API | FastAPI (Python 3.11, Pydantic v1) |
| Database | Google Cloud Datastore (Firestore in Datastore mode) |
| Auth | Firebase Auth — ID tokens verified by `af-server/core/auth.py` |
| Hosting | Cloud Run (asia-northeast1) |
| Styling | Tailwind 3, Lucide React icons, no component library |

---

## Common Commands

### af-platform (Next.js)
```bash
cd af-platform
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
```

### af-server (FastAPI)
```bash
cd af-server
# Activate venv first (PowerShell: .venv\Scripts\Activate.ps1)
source .venv/bin/activate          # or .venv\Scripts\Activate.ps1 on Windows
python -m uvicorn main:app --reload --port 8000   # Dev server (localhost:8000)
pip install -r requirements.txt    # Install dependencies
```
- Python: **3.11 via `.venv`** — do NOT use system Python
- API docs available at `http://localhost:8000/docs` when running

### af-web (public site)
```bash
cd af-web
npm run dev          # Dev server
npm run build        # Production build
```
Deployed via Firebase Hosting (`firebase.json` in repo root).

### Environment Files (all gitignored)
- `af-server/.env.local` + `af-server/cloud-accele-freight-b7a0a3b8fd98.json`
- `af-platform/.env.local` — must include `AF_SERVER_URL=http://localhost:8000` for local dev

---

## Architecture

### af-server structure
All API routes are prefixed `/api/v2/`. Routers are registered in `main.py`.

```
af-server/
  main.py              # FastAPI app, CORS, router registration
  core/
    auth.py            # Firebase ID token verification
    datastore.py       # Datastore client singleton
    constants.py       # Shared constants
    exceptions.py      # AFException + handler
  routers/
    shipments.py       # /api/v2/shipments — list, detail, status writes
    companies.py       # /api/v2/companies
    users.py           # /api/v2/users
    geography.py       # /api/v2/geography
    files.py           # /api/v2/files
  logic/
    workflow.py        # Status transition logic, status_history management
  models/              # Pydantic v1 request/response models
```

### af-platform data flow
```
React Server Component
  → Server Action (app/actions/*.ts — "use server" wrappers)
    → lib function (lib/*.ts — fetch to af-server with Firebase ID token)
      → af-server endpoint (/api/v2/*)
        → Google Cloud Datastore
```

Key lib files:
- `lib/datastore.ts` / `lib/datastore-query.ts` — generic Datastore access (used for operations not yet migrated to af-server)
- `lib/shipments.ts` — shipment reads via af-server
- `lib/shipments-write.ts` — shipment writes via af-server
- `lib/v1-assembly.ts` — V1 multi-Kind record assembly logic
- `lib/firebase.ts` / `lib/firebase-admin.ts` — Firebase client/admin SDK setup
- `lib/auth-server.ts` — server-side auth helpers

Platform route groups:
- `app/(platform)/` — authenticated pages (dashboard, shipments, users, companies)
- `app/login/` — unauthenticated login page

### User role convention
- **AFC = Customer** (company user), **AFU = Staff** (internal user) — this is counterintuitive, documented in `lib/users.ts`.

---

## Key Architectural Rules

1. **All Datastore reads/writes for shipment operations go through `af-server`** — not directly from `af-platform`. The platform calls `af-server` via authenticated fetch using the user's Firebase ID token.

2. **V1 records are read-only** except for explicit status writes via the V1 status write path. Never write to `Quotation` Kind records with `AFCQ-` prefix except `company_id` and `status` via their designated endpoints.

3. **V1 operational status lives on `ShipmentOrder.status`** — never read `Quotation.status` to determine operational state for V1 records.

4. **Status writes and `status_history` appends are atomic** — both happen in the same server request handler. Never handle `status_history` in the platform layer.

5. **`af-platform` calls `af-server` using `AF_SERVER_URL` env var** — `http://localhost:8000` in local dev, `https://api.accelefreight.com` in production.

---

## Datastore Kinds Reference

| Kind | Prefix | Notes |
|---|---|---|
| `Quotation` | `AFCQ-` (V1), `AF2-` (V2) | Primary shipment/order record |
| `ShipmentOrder` | `AFCQ-` | V1 operational state — source of truth for V1 status |
| `ShipmentWorkFlow` | `AFCQ-` | Workflow stages + `status_history` array |
| `ShipmentTrackingId` | random | Lookup table: tracking ID → shipment ID |
| `Company` | `AFC-` | Customer companies |
| `UserIAM` | Firebase UID | Auth roles |
| `CompanyUserAccount` | — | Links users to companies (54% missing `company_id` — guard with default) |

---

## Verification Checklist

**Complete this checklist before finishing any task:**

- [ ] All FastAPI tab/enum parameters include every value the platform sends
- [ ] No unhandled values return empty silently — fallthrough raises HTTP 400
- [ ] V1 status reads from `ShipmentOrder.status`, never `Quotation.status`
- [ ] `issued_invoice` coerced with `bool()` before any comparison
- [ ] All Datastore filters use `PropertyFilter` keyword form (not positional)
- [ ] Batch-fetch used for cross-Kind joins — no N+1 loops
- [ ] `get_multi_chunked` used instead of `client.get_multi` (1000-key Datastore limit)
- [ ] Timestamps parsed with `parse_timestamp()` (server) or `new Date()` (platform) — no hardcoded strptime
- [ ] Timestamps written with `datetime.now(timezone.utc).isoformat()`
- [ ] Status writes and `status_history` appends in the same server handler
- [ ] Status code → UI mapping is explicit and covers all 11 codes including `-1`
- [ ] List page state cleared only on tab change, not on re-render
- [ ] New endpoints registered in `main.py` if added to a router
- [ ] Server Actions: top-level try/catch, every path returns structured result — never throws
- [ ] Client calls to Server Actions: null guard on result (`if (!result)`) + outer try/catch

---

*Last updated: 28 Feb 2026*
