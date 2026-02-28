# AcceleFreight Platform — Handover Notes v2.14

**Session date:** 27 Feb 2026  
**Preceding notes:** AF-Handover-Notes-v2_13.md

---

## Session Summary

Infrastructure and CI/CD session. No feature code written. Five items completed:

1. **SD3** — `AF_SERVER_URL` updated to `api.accelefreight.com` on af-platform Cloud Run
2. **S3** — V1 data normalisation dry run — all clean, nothing to migrate
3. **af-platform Cloud Build trigger** — GitHub push to `main` now auto-deploys
4. **af-server Cloud Build trigger** — GitHub push to `main` now auto-deploys
5. **Strategic decision** — V1 sunset confirmed, V2 data model review completed, old codebase obtained for pricing analysis

---

## What Was Done

### SD3 — AF_SERVER_URL Updated

Updated af-platform Cloud Run env vars:

```powershell
gcloud run services update af-platform `
  --region asia-northeast1 `
  --set-env-vars "AF_SERVER_URL=https://api.accelefreight.com,GOOGLE_CLOUD_PROJECT_ID=cloud-accele-freight" `
  --project=cloud-accele-freight
```

**Lesson learned:** Always quote the entire `--set-env-vars` string and verify with `gcloud run services describe` after each update. A previous attempt without quotes merged both vars into a single malformed value, dropping `GOOGLE_CLOUD_PROJECT_ID` and causing "Unauthorised" errors on all authenticated requests.

### S3 — Data Normalisation

Dry run of `scripts/normalise_v1_data.py` returned all zeros — data already clean:
- 3,853 Quotation records — `issued_invoice` already boolean on all
- 0 ShipmentOrders with missing `has_shipment` flag
- 330 UserIAM records — `account_type` already set on all

Script remains available for future use if new V1 records surface with inconsistencies.

### Cloud Build Triggers

Both triggers created on `calvinwong-af/af-cloud-v2` (GitHub), watching `^main$` branch:

| Trigger | Build config | Status |
|---|---|---|
| `af-platform` | `af-platform/cloudbuild.yaml` | ✅ Enabled |
| `af-server` | `af-server/cloudbuild.yaml` | ✅ Enabled |

**Note:** af-platform trigger has 6 substitution variables (`_FIREBASE_API_KEY` etc.) set from `.env.local` values. af-server uses built-in `$PROJECT_ID` and `$COMMIT_SHA` — no substitutions needed.

**Reminder:** First push to `main` after this session should be verified against Cloud Build history to confirm trigger fires correctly.

---

## Strategic Decisions Made

### V1 Sunset Confirmed

- `alfred.accelefreight.com` (old Vue TMS) will be decommissioned
- Underlying V1 Datastore Kind structure will be sunset
- All existing V1 data will be migrated to V2 structure
- Old Kinds become read-only archive post-migration, then deleted

### Data Model Review (AF-V2-Data-Model-v0_4.md)

Full gap analysis completed. Model is sound. Key gaps identified:

| Gap | Description | Blocking? |
|---|---|---|
| V1 migration script | Not yet written. Needs pricing model analysis first | Blocks Quotations module |
| Pricing Kinds | Old codebase obtained — analysis pending next session | Blocks migration script |
| ShipmentWorkFlow V2 | Deferred — needed when cross-border/ground built | Not blocking now |
| CROSS_BORDER / GROUND types | Fully defined in model, not yet implemented | Not blocking now |
| CompanyUserAccount 54% broken | Phase 3 cleanup — not blocking current build | Not blocking now |

### Module Priority Decisions

| Module | Decision |
|---|---|
| Geography | Deprioritised — self-contained, not blocking anything |
| System Logs | Deferred — build after V2 modules are generating meaningful logs |
| Shipment detail (files tab, V1 parties) | Queued — unblocked, useful for staff |
| V1 → V2 migration script | Next major task — pending pricing model analysis |
| Quotations module | After migration script + pricing model |

---

## Next Session Plan

**Primary objective:** Full analysis of old V1 codebase (pricing model focus).

Old codebase zip is available in the workspace. Next session should:

1. Extract and study the pricing Kinds — `PTMonthlyRate*`, `CompanyRates`, `CustomerRank`, `estimate_component`, `actual_component`
2. Map V1 pricing fields → V2 `CommercialQuotation.pricing` line items
3. Document findings as an addendum to `AF-V2-Data-Model-v0_4.md`
4. Begin outlining the V1 → V2 migration script

---

## Deployment State — End of Session

| Service | URL | Status |
|---|---|---|
| af-platform | https://appv2.accelefreight.com | ✅ Live, green |
| af-server | https://api.accelefreight.com | ✅ Live, green |
| af-server (direct) | https://af-server-667020632236.asia-northeast1.run.app | ✅ Live |
| af-cloud-auth-server | https://auth.accelefreight.com | ✅ Live, green |
| alfred.accelefreight.com | Old Vue TMS | ⚠️ Still live — do not touch |

**af-platform Cloud Run env vars (confirmed):**
- `AF_SERVER_URL` = `https://api.accelefreight.com`
- `GOOGLE_CLOUD_PROJECT_ID` = `cloud-accele-freight`

---

## Dev Environment Quick Start

```powershell
# Terminal 1 — af-server
cd C:\dev\af-cloud-v2\af-server
.venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --port 8000

# Terminal 2 — af-platform
cd C:\dev\af-cloud-v2\af-platform
npm run dev
```

`AF_SERVER_URL=http://localhost:8000` in `af-platform/.env.local`

---

## TODO Index (Updated)

### Infrastructure
| ID | Task | Status |
|---|---|---|
| SD3 | Update `AF_SERVER_URL` to `api.accelefreight.com` | ✅ Done |
| — | af-platform Cloud Build trigger | ✅ Done |
| — | af-server Cloud Build trigger | ✅ Done |
| — | Verify trigger fires on next push to main | ⏳ Pending — check after next feature push |

### Server (af-server)
| ID | Task | Status |
|---|---|---|
| S3 | normalise_v1_data.py dry run | ✅ Done — data already clean |
| S4 | Status stage redesign | 🔵 Deferred |
| S5 | Route Node Timeline | 🔵 Deferred |
| S6 | Incoterm task definitions | 🔵 Deferred |
| — | V1 → V2 migration script | 🔴 Next major task — pending pricing analysis |

### Platform (af-platform)
| Task | Status |
|---|---|
| Shipment detail — files tab | ⏳ Queued |
| Shipment detail — V1 parties cards | ⏳ Queued |
| Geography module | 🔵 Deprioritised |
| System Logs module | 🔵 Deferred — after V2 modules generating logs |
| Pricing Tables | ⏳ After S6 + pricing model analysis |
| Quotations module | ⏳ After migration script + Pricing Tables |
| Duplicate Shipment | ⏳ Needs server implementation |
| Company detail — files tab | ⏳ Queued |

### Data / Architecture
| Task | Status |
|---|---|
| Old codebase pricing analysis | 🔴 Next session |
| V2 data model addendum (pricing) | 🔴 After pricing analysis |
| V1 → V2 migration script | 🔴 After data model addendum |
| CompanyUserAccount repair (54% broken) | 🔵 Phase 3 — not blocking |
| Delete AF2-000001 test record | ⏳ Before production traffic |
| Rename Quotation Kind → ShipmentOrder | 🔵 Phase 2 — after V1 sunset |

---

*Next session: Old codebase analysis — pricing model. Bring the V1 zip.*
