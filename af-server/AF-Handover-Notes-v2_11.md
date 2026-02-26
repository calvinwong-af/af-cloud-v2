# AcceleFreight Platform — Handover Notes v2.11

**Session date:** 27 Feb 2026
**Preceding notes:** AF-Handover-Notes-v2_10.md

---

## Session Summary

Three things accomplished this session:

1. **V1 server reviewed in full** — Confirmed Python 3.7 / Flask / GAE stack. Identified what to drop, what to port. Decision made to phase it out rather than patch it.

2. **V2 server scaffolded and running** — `af-server/` created inside the monorepo (`af-cloud-v2/`). FastAPI, Python 3.11 venv, all core modules written. Server confirmed running locally at `http://localhost:8000`.

3. **Housekeeping** — Root `.gitignore` updated to cover all three modules (af-web, af-platform, af-server). Service account key and `.env.local` in place. Stray `{core,routers,models,logic,scripts}` empty folder in `af-server/` to be deleted.

---

## Local Dev — Current State

### af-server is running ✅
```
http://localhost:8000        → {"status":"OK","version":"2.0.0","service":"af-server"}
http://localhost:8000/docs   → Interactive API docs
http://localhost:8000/api/v2/shipments/stats → 401 (correct — auth required)
```

### To start af-server (from `af-server/` directory)
```powershell
.venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --port 8000
```

### Environment
- Python: **3.11** (explicitly — do NOT use system Python 3.14, pydantic wheels don't exist for it yet)
- Venv: `af-server/.venv/`
- Key file: `af-server/cloud-accele-freight-b7a0a3b8fd98.json`
- Env file: `af-server/.env.local` (created, points to key file)

---

## Repository Structure (Current)

```
af-cloud-v2/
├── af-web/              → accelefreight.com         ✅ LIVE (Firebase Hosting, static)
├── af-platform/         → appv2.accelefreight.com   🔄 In progress (Cloud Run, SSR)
├── af-server/           → api.accelefreight.com     🆕 Running locally — not yet deployed
├── index.yaml           ← Datastore composite indexes
├── firebase.json
└── .firebaserc

Old V1 (do not touch):
  alfred.accelefreight.com  → Vue TMS        ⚠️ Still live
  af-cloud-webserver        → Flask/GAE      ⚠️ Still live (phases out when Vue retires)

Shared backend (never modify):
  Firebase Datastore  — cloud-accele-freight  (asia-northeast1)
  Firebase Auth       — cloud-accele-freight
  GCS bucket          — files-accelefreight
```

---

## af-server File Structure

```
af-server/
├── main.py                        ← FastAPI app, CORS, router registration
├── Dockerfile                     ← Python 3.12-slim, uvicorn
├── .dockerignore
├── cloudbuild.yaml                ← Cloud Build → Cloud Run (asia-northeast1)
├── requirements.txt               ← fastapi==0.103.2, pydantic==1.10.13 (v1 — no Rust needed)
├── .env.example
├── .env.local                     ← Created — points to service account key (gitignored)
├── cloud-accele-freight-b7a0a3b8fd98.json  ← Service account key (gitignored)
│
├── core/
│   ├── __init__.py
│   ├── auth.py                    ← Firebase token verification (replaces Gordon + auth microservice)
│   ├── constants.py               ← All status codes, types, roles (ported + cleaned from V1)
│   ├── datastore.py               ← Datastore client singleton + run_query helper
│   └── exceptions.py              ← AFException, NotFoundError, ForbiddenError, etc.
│
├── routers/
│   ├── __init__.py
│   ├── shipments.py               ← GET /stats (S1 fix) + list/get/create/status stubs
│   ├── companies.py               ← Stub
│   ├── users.py                   ← Stub
│   ├── geography.py               ← Stub
│   └── files.py                   ← Stub
│
├── models/
│   └── __init__.py
│
├── logic/
│   ├── __init__.py
│   └── workflow.py                ← get_applicable_processes() — incoterm task rules (S6 stub)
│
└── scripts/
    ├── __init__.py
    └── normalise_v1_data.py       ← S3 migration — 3 passes, DRY_RUN=true safe
```

---

## Key Architecture Decisions

### Stack
| Concern | V1 (old) | V2 (new) |
|---|---|---|
| Runtime | Python 3.7 / Flask 2.0 | Python 3.11 / FastAPI 0.103.2 |
| Hosting | Google App Engine Standard | Cloud Run (asia-northeast1) |
| Auth | External auth microservice round-trip per request | Firebase Admin SDK inline (no external call) |
| Caching | Redis (RedisLabs) | None — Datastore + Next.js Server Actions |
| Dashboard cache | UserDashboard Kind + task queue | Eliminated — query directly with indexes |
| Datastore client | `google-cloud-datastore==1.13.2` (per-request init) | `google-cloud-datastore==2.19.0` (singleton) |
| Pydantic | Not used | v1.10.13 (pure Python — no Rust/Cargo required) |

### Python Version Note
The dev machine has Python 3.14 as the system Python. **Always use the `.venv` inside `af-server/`** which is built on Python 3.11. pydantic-core has no wheels for 3.14 yet so installing into the system Python will fail.

### What Was Dropped from V1 (Do Not Port)
- External auth microservice (`auth.accelefreight.com`)
- Redis layer and all Redis keys
- `UserDashboard` Kind + task queue cache rebuild jobs
- `QuotationFreight` / `QuotationFCL` / `QuotationLCL` / `QuotationAir` model logic (V1-only, read via v1-assembly.ts in Next.js)
- GAE cron jobs (`cron.yaml`)
- BigQuery activity logging
- Vessel network / shipping schedule scraping
- Xero integration (Phase 2 — code preserved in V1 server for reference)
- `deprecated_invoices_model.py`

### What Will Be Ported (Per Router, When Implemented)
| V1 Source | V2 Destination |
|---|---|
| `logic/financial_components.py` | `logic/financial.py` — pricing calculation engine |
| `logic/workflow_status.py` | `logic/workflow.py` — incoterm task rules |
| `model/geography_model.py` | `routers/geography.py` + `models/geography.py` |
| `model/pricing/` (4 files) | `routers/pricing.py` (not yet scaffolded) |
| `model/incoterm_model.py` | Merged into `core/constants.py` |
| `model/files_model.py` | `routers/files.py` — GCS signed URLs |
| `auth/access_auth.py` Gordon logic | `core/auth.py` FastAPI dependencies |

---

## S1 Fix — How It Works

`GET /api/v2/shipments/stats` in `routers/shipments.py`:

- **V2 records** — queries `Quotation` Kind where `data_version=2` + `trash=False`, reads `status` directly, counts into active / completed / to_invoice / cancelled buckets.
- **V1 records** — queries `ShipmentOrder` Kind where `status >= 110` (booking confirmed = became a real shipment). Maps V1 status codes to V2 buckets. `issued_invoice` coerced with `bool()` to handle int 0/1 stored by V1.

This fixes the broken in-memory counting in `src/lib/shipments.ts` which was reading `Quotation.status` for V1 records and returning ~1,960 active instead of ~23.

**Next.js change required (S1b):** Update `getShipmentOrderStatsAction` in `src/app/actions/shipments.ts` to call `GET /api/v2/shipments/stats` with the user's Firebase ID token in `Authorization: Bearer <token>`, instead of the current in-memory calculation. Use `AF_SERVER_URL` env var for the base URL.

---

## CORS — Allowed Origins

```python
ALLOWED_ORIGINS = [
    "https://appv2.accelefreight.com",
    "http://localhost:3000",
    "http://localhost:3001",
]
```

`alfred.accelefreight.com` is intentionally excluded — V1 Vue calls the V1 Flask server only.

---

## TODO Index

### Server (af-server) — Priority Order

| ID | Task | Status |
|---|---|---|
| **S1** | Shipment stats endpoint (`GET /api/v2/shipments/stats`) | ✅ Implemented |
| **S1b** | Wire `getShipmentOrderStatsAction` in af-platform to call server stats endpoint | ⏳ Next session |
| **S2** | Composite indexes — add to `af-cloud-v2/index.yaml` and deploy | ⏳ Next session |
| **S3** | Run `scripts/normalise_v1_data.py` dry run, then live | ⏳ Next session |
| **S4** | Status stage redesign (`ShipmentWorkFlow` per-stage timestamps) | 🔵 Deferred |
| **S5** | Route Node Timeline (visual leg tracker) | 🔵 Deferred |
| **S6** | Incoterm task definitions (rules engine) | 🔵 Deferred |
| **SD1** | Deploy af-server to Cloud Run (one-time GCP setup below) | ⏳ After S1b |
| **SD2** | Map `api.accelefreight.com` in Cloudflare + Cloud Run | ⏳ After SD1 |

### Next.js (af-platform) — Priority Order

| Task | Dependency |
|---|---|
| Update `getShipmentOrderStatsAction` to call server stats endpoint (S1b) | S1 ✅ |
| Shipment list — full V1+V2 join via server | After SD1 |
| Geography module | After server geography router |
| System Logs module | — |
| Company detail — files tab | After server files router |
| Shipment detail — files tab, V1 parties cards | — |
| Pricing Tables | After S6 |
| Quotations module | After pricing tables |

---

## First-Time Cloud Run Deployment (When Ready)

### 1. Create Artifact Registry repo
```powershell
gcloud artifacts repositories create af-server `
  --repository-format=docker `
  --location=asia-northeast1 `
  --project=cloud-accele-freight
```

### 2. Create service account
```powershell
gcloud iam service-accounts create af-server `
  --display-name="AF Server V2 Cloud Run SA" `
  --project=cloud-accele-freight

gcloud projects add-iam-policy-binding cloud-accele-freight `
  --member="serviceAccount:af-server@cloud-accele-freight.iam.gserviceaccount.com" `
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding cloud-accele-freight `
  --member="serviceAccount:af-server@cloud-accele-freight.iam.gserviceaccount.com" `
  --role="roles/firebase.admin"
```

### 3. First deploy (from `af-cloud-v2/af-server/`)
```powershell
gcloud builds submit --config=cloudbuild.yaml --project=cloud-accele-freight
```

### 4. Map domain (Cloudflare + Cloud Run)
Cloudflare CNAME:
- Name: `api` → Target: `ghs.googlehosted.com.` → Proxy: DNS only (grey)

```powershell
gcloud beta run domain-mappings create `
  --service=af-server `
  --domain=api.accelefreight.com `
  --region=asia-northeast1
```

### 5. Add to af-platform/.env.local
```
AF_SERVER_URL=https://api.accelefreight.com
```
Local dev:
```
AF_SERVER_URL=http://localhost:8000
```

---

## Gitignore — Root .gitignore (af-cloud-v2/)

Updated this session to cover all three modules:

```gitignore
.claude

# af-server (Python / FastAPI)
af-server/*.json
af-server/.env.local
af-server/.venv/
af-server/__pycache__/
af-server/**/__pycache__/

# af-platform + af-web (Next.js / Node)
node_modules/
.next/
.env.local
.env*.local
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# General
.DS_Store
Thumbs.db
*.log
```

`af-server/.gitignore` deleted — root file covers everything.

---

*Next session: S1b — wire `getShipmentOrderStatsAction` in af-platform to call `GET /api/v2/shipments/stats`. Then S2 (composite indexes) and S3 (normalisation script dry run).*
