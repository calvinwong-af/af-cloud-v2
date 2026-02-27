# AcceleFreight Platform — Handover Notes v2.12

**Session date:** 27 Feb 2026
**Preceding notes:** AF-Handover-Notes-v2_11.md

---

## Session Summary

Four things accomplished this session:

1. **Shipment search implemented** — Quick search (top nav, ID only) and list search bar (all fields: ID, company name, route ports). Both debounced 300ms, trigger at 3+ characters.

2. **Invoice toggle consistency fixed** — Toggle now correctly reads and writes `issued_invoice` for both V1 and V2 records. Bidirectional behaviour confirmed working (not invoiced → invoiced → not invoiced, To Invoice list updates correctly).

3. **V1 invoice toggle dual-write gap identified and prompted** — `updateInvoicedStatus` only wrote to `Quotation`. For V1 records the server reads from `ShipmentOrder`. Fix prompted to VS Code (see PROMPT-CURRENT.md).

4. **S2 composite indexes confirmed NOT yet done** — `index.yaml` still contains only V1-era indexes. S2 is the highest priority for the next session before any production deployment.

---

## What Was Fixed This Session

### Invoice Toggle — V1 Dual-Write Gap

**File:** `af-platform/src/lib/shipments-write.ts` → `updateInvoicedStatus`

**Problem:** Function only wrote `issued_invoice` to `Quotation` Kind. But `af-server/routers/shipments.py` stats and list endpoints read `issued_invoice` from `ShipmentOrder` for V1 records. Toggling a V1 shipment changed Quotation but the badge/list still saw the stale ShipmentOrder value.

**Fix (prompted to VS Code):** After the Quotation merge, add a second `ds.merge()` to `ShipmentOrder` for any `shipment_id.startsWith('AFCQ-')`. Wrapped in try/catch so missing ShipmentOrder entities don't break the operation.

**Status:** ⏳ Prompt sent — awaiting VS Code implementation

---

## Current index.yaml State

The file at `af-cloud-v2/index.yaml` currently contains **V1-era indexes only**:

```yaml
indexes:
  - kind: Quotation
    properties:
      - name: trash
      - name: updated
        direction: desc

  - kind: Quotation
    properties:
      - name: trash
      - name: company_id
      - name: updated
        direction: desc

  - kind: Company
    properties:
      - name: trash
      - name: name

  - kind: Company
    properties:
      - name: trash
      - name: countid
        direction: desc
```

**S2 has NOT been done.** No V2 query indexes exist yet.

---

## S2 — Composite Indexes Required (HIGHEST PRIORITY)

These indexes are needed to support the query patterns introduced by `af-server/routers/shipments.py`. Currently these queries work in dev via in-memory filtering and single-property indexes, but they will fail or degrade badly in production.

### Queries that need composite indexes

| Kind | Query Pattern | Used by |
|---|---|---|
| `ShipmentOrder` | `status >= X` + `company_id =` | stats, list, search (company-filtered) |
| `ShipmentOrder` | `status >= X` + `status < Y` + `company_id =` | list active tab |
| `Quotation` | `data_version = 2` + `trash = False` | stats, list (all V2) |
| `Quotation` | `data_version = 2` + `trash = False` + `company_id =` | stats, list (company-filtered) |
| `Quotation` | `data_version = 2` + `trash = False` + `status =` | stats per-bucket |

### Required additions to index.yaml

```yaml
  # ShipmentOrder — active/completed queries (V1 list + stats)
  - kind: ShipmentOrder
    properties:
      - name: status
      - name: company_id

  # Quotation V2 — base list query (all companies, AFU staff view)
  - kind: Quotation
    properties:
      - name: data_version
      - name: trash
      - name: updated
        direction: desc

  # Quotation V2 — company-filtered list query (AFC users)
  - kind: Quotation
    properties:
      - name: data_version
      - name: trash
      - name: company_id
      - name: updated
        direction: desc

  # Quotation V2 — status-filtered queries (tab counts in stats)
  - kind: Quotation
    properties:
      - name: data_version
      - name: trash
      - name: status
```

### Deployment command

After updating `index.yaml`:

```powershell
cd C:\dev\af-cloud-v2
gcloud datastore indexes create index.yaml --project=cloud-accele-freight
```

**Note:** Index build takes 5–30 minutes depending on dataset size. Monitor progress in GCP Console → Datastore → Indexes. Do NOT deploy af-server (SD1) until all indexes show `READY`.

---

## TODO Index (Updated)

### Server (af-server) — Priority Order

| ID | Task | Status |
|---|---|---|
| **S1** | Shipment stats endpoint | ✅ Done |
| **S1b** | Wire platform stats action to server | ✅ Done |
| **S2** | **Composite indexes — update index.yaml + deploy** | 🔴 **NEXT — Highest priority** |
| **S3** | Run `normalise_v1_data.py` dry run, then live | ⏳ After S2 |
| **SD1** | Deploy af-server to Cloud Run | ⏳ After S2 indexes READY |
| **SD2** | Map `api.accelefreight.com` | ⏳ After SD1 |
| **S4** | Status stage redesign | 🔵 Deferred |
| **S5** | Route Node Timeline | 🔵 Deferred |
| **S6** | Incoterm task definitions | 🔵 Deferred |

### Platform (af-platform) — In Progress / Queued

| Task | Status |
|---|---|
| Shipment search — quick search + list filter | ✅ Done |
| Invoice toggle — V2 read/write | ✅ Done |
| Invoice toggle — V1 dual-write (ShipmentOrder + Quotation) | ⏳ VS Code prompted |
| Geography module | ⏳ After SD1 |
| System Logs module | ⏳ After SD1 |
| Company detail — files tab | ⏳ After SD1 |
| Shipment detail — files tab, V1 parties cards | ⏳ Queued |
| Pricing Tables | ⏳ After S6 |
| Quotations module | ⏳ After Pricing Tables |
| V2 order ID numbering (continue V1 sequence) | 🔵 Deferred until V1 retirement |

---

## Key Files Reference

| File | Purpose |
|---|---|
| `af-server/routers/shipments.py` | Stats, list, search, status write, company reassign |
| `af-server/core/datastore.py` | `get_multi_chunked`, `parse_timestamp`, `run_query`, `entity_to_dict` |
| `af-server/core/constants.py` | All status codes, V1↔V2 mappings, prefixes |
| `af-platform/src/lib/shipments-write.ts` | `updateInvoicedStatus` (V1 dual-write fix pending) |
| `af-platform/src/app/actions/shipments-write.ts` | Server Actions — auth gate + call lib |
| `af-cloud-v2/index.yaml` | Datastore composite indexes — **needs S2 update** |
| `af-cloud-v2/CLAUDE.md` | VS Code session context — read at session start |
| `af-cloud-v2/AF-Coding-Standards.md` | 12 rules from real bugs — read before writing code |
| `af-cloud-v2/PROMPT-CURRENT.md` | Current VS Code prompt staging file |

---

## Known Issues / Watch Points

- **Deprecation warnings** in af-server console (`PropertyFilter` positional args) — cosmetic only, does not affect functionality
- **V1 issued_invoice** stored as int `0`/`1` on some records — coerced with `bool()` in all server reads
- **Search scalability** — current search does in-memory filtering on full Datastore working set. Acceptable up to ~5,000 active records. Flag for review when active shipments exceed 500.

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

*Next session: S2 — update index.yaml with V2 composite indexes and deploy to Datastore. Then SD1 (Cloud Run deploy) once indexes are READY.*
