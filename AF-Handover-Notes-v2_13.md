# AcceleFreight Platform — Handover Notes v2.13

**Session date:** 27 Feb 2026
**Preceding notes:** AF-Handover-Notes-v2_12.md

---

## Session Summary

Four things accomplished this session:

1. **Shipment ID prefix fix** — V2 IDs now use `AF-` prefix (retiring `AF2-`). ID sequence continues from V1 max (AFCQ-003863), so next V2 shipment will be `AF-003864`. Regex validation in `af-platform/src/app/actions/shipments.ts` updated to accept `AF-` alongside legacy `AFCQ-` and `AF2-`.

2. **List performance improved** — Eliminated the Quotation batch fetch on every list request (was up to 2,030 extra Datastore reads per tab switch). Added 5-minute in-memory company name cache. Removed a broken V2 projection query that was causing a `FailedPrecondition` error. Tab switching is now noticeably faster; initial load still slow (deferred — architectural fix needed).

3. **SD2 complete — `api.accelefreight.com` domain mapping** — Cloud Run domain mapping created for `api.accelefreight.com` → `af-server (asia-northeast1)`. Cloudflare CNAME (`api` → `ghs.googlehosted.com`) was already in place. SSL cert provisioning in progress — should turn green within 15 minutes.

4. **Namecard PDF** — Generated a PDF version of the corporate namecard. Rendering quality needs refinement — deferred to a future session. HTML version (`AF-Namecard.html`) remains the clean reference.

---

## What Was Fixed This Session

### 1. Shipment ID Format Validation

**File:** `af-platform/src/app/actions/shipments.ts` → `fetchShipmentOrderDetailAction`

**Change:** Regex updated from `/^(AFCQ|AF2)-\d+$/` to `/^(AFCQ|AF2|AF)-\d+$/`

This was causing "Invalid shipment order ID format" on the Shipments page after the prefix change to `AF-`.

### 2. List Performance — Quotation Batch Fetch Removed

**File:** `af-server/routers/shipments.py` → `list_shipments`, `_make_v1_summary`, `_batch_company_names`

**Changes (by Opus, then projection bug fixed by Claude):**
- `_make_v1_summary` now reads display fields directly from `ShipmentOrder` entity — no Quotation join needed for list view
- `_batch_company_names` now has a 5-minute in-memory cache (`_company_name_cache` dict + `_company_name_cache_ts` timestamp)
- Removed a V2 projection query (`v2_query.projection = [...]`) that Opus added — it required a 12-field composite index that doesn't exist and caused a `FailedPrecondition: no matching index found` error

**Known remaining issue:** Initial list load still 3-5s locally due to full `ShipmentOrder` table scan (~2,030 records). Will be faster in production (Cloud Run co-located with Datastore). Proper fix requires a denormalised `ShipmentListCache` Kind or Firestore migration — deferred as architectural work.

### 3. AF- Prefix — af-server Constants Already Correct

`af-server/core/constants.py` already had `PREFIX_V2_SHIPMENT = "AF-"` from Opus's work in the previous prompt. No change needed server-side.

---

## Deployment State — End of Session

| Service | URL | Status |
|---|---|---|
| af-platform | https://appv2.accelefreight.com | ✅ Live, green |
| af-server | https://api.accelefreight.com | ⏳ SSL provisioning (~15 min) |
| af-server (direct) | https://af-server-667020632236.asia-northeast1.run.app | ✅ Live |
| af-cloud-auth-server | https://auth.accelefreight.com | ✅ Live, green |

**Note:** `AF_SERVER_URL` on af-platform Cloud Run is currently set to the direct Cloud Run URL (`https://af-server-667020632236.asia-northeast1.run.app`). Once `api.accelefreight.com` SSL is confirmed green, update this env var:

```powershell
gcloud run services update af-platform `
  --region asia-northeast1 `
  --set-env-vars AF_SERVER_URL=https://api.accelefreight.com `
  --project=cloud-accele-freight
```

---

## TODO Index (Updated)

### Server (af-server)

| ID | Task | Status |
|---|---|---|
| S1 | Shipment stats endpoint | ✅ Done |
| S1b | Wire platform stats to server | ✅ Done |
| S2 | Composite indexes | ✅ Done |
| SD1 | Deploy af-server to Cloud Run | ✅ Done |
| SD2 | Map `api.accelefreight.com` | ✅ Done (SSL provisioning) |
| **SD3** | **Update `AF_SERVER_URL` to `api.accelefreight.com` once SSL green** | 🔴 Next — quick |
| S3 | Run `normalise_v1_data.py` dry run → live | ⏳ Pending |
| S4 | Status stage redesign | 🔵 Deferred |
| S5 | Route Node Timeline | 🔵 Deferred |
| S6 | Incoterm task definitions | 🔵 Deferred |
| — | List performance — ShipmentListCache / Firestore | 🔵 Deferred (architectural) |

### Platform (af-platform)

| Task | Status |
|---|---|
| Shipment search — quick search + list filter | ✅ Done |
| Invoice toggle — V2 + V1 dual-write | ✅ Done |
| V2 order ID — `AF-` prefix + continue V1 sequence | ✅ Done |
| ID format validation — accept `AF-` prefix | ✅ Done |
| **Permanent Cloud Build trigger for af-platform** | ⏳ Still needed |
| Geography module | ⏳ After SD3 |
| System Logs module | ⏳ Queued |
| Company detail — files tab | ⏳ Queued |
| Shipment detail — files tab, V1 parties cards | ⏳ Queued |
| Pricing Tables | ⏳ After S6 |
| Quotations module | ⏳ After Pricing Tables |

---

## Key Files Reference

| File | Purpose |
|---|---|
| `af-server/routers/shipments.py` | Stats, list, search, status write, company reassign |
| `af-server/core/constants.py` | All status codes, V1↔V2 mappings, prefixes |
| `af-platform/src/app/actions/shipments.ts` | Server Actions — auth gate, ID validation |
| `af-platform/src/lib/shipments-write.ts` | Write operations incl. ID generation |
| `af-cloud-v2/index.yaml` | Datastore composite indexes |
| `af-cloud-v2/CLAUDE.md` | VS Code session context |
| `af-cloud-v2/AF-Coding-Standards.md` | 12 rules from real bugs |
| `af-cloud-v2/PROMPT-CURRENT.md` | Current VS Code prompt staging file |

---

## Known Issues / Watch Points

- **Deprecation warnings** in af-server console (`PropertyFilter` positional args) — cosmetic only
- **V1 issued_invoice** stored as int `0`/`1` on some records — coerced with `bool()` in all server reads
- **Search scalability** — in-memory filtering on full Datastore working set. Flag for review when active shipments exceed 500
- **List initial load** — 3-5s due to full ShipmentOrder scan. Acceptable for now; needs architectural fix at scale
- **AF2-000001 test record** — still exists in Datastore. Delete via UI before production traffic

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

*Next session: SD3 — update AF_SERVER_URL to api.accelefreight.com once SSL is green. Then S3 (normalise_v1_data.py dry run). Then permanent Cloud Build trigger for af-platform.*
