# AF Platform — Handover Notes v2.18
**Date:** 28 February 2026
**Session Focus:** BL Parser ID Fix + BL Parse Update Mode Design
**Prepared by:** Claude / Calvin
**Supersedes:** AF-Handover-Notes-v2_17.md

---

## Version History (Summary)

| Version | Date | Summary |
|---|---|---|
| ... | ... | See v2.17 for full history |
| 2.17 | 28 Feb 2026 | V1→V2 migration complete. Post-migration server fixes. Incoterm task engine designed. BL parse scoped. |
| 2.18 | 28 Feb 2026 | BL parser ID counter fix. BL parse update mode designed. |

---

## Session Summary

Two things this session:

1. **BL parser shipment ID fix** — `create-from-bl` was using an isolated
   `Counter` Kind (`"shipment_v2"`) that started at 1, completely disconnected
   from the V1 `AFCQ-` sequence. Fixed by replacing with the same scan-based
   global max approach used by the manual creation path (`shipments-write.ts`).
   Tested and confirmed: new BL-created shipment received `AF-003867` ✅

2. **BL parse update mode designed** — see section below. Ready for Opus prompt
   next session.

---

## What Was Fixed This Session

### BL Parser ID Counter

**File:** `af-server/routers/shipments.py` → `create_from_bl`

**Problem:** Used `Counter` Kind with key `"shipment_v2"`, initialising from 0
on first run → produced `AF-000001`.

**Fix:** Replaced with scan-based approach:
1. Scan `ShipmentOrderV2CountId` for max V2 countid
2. Scan `Quotation` keys-only for max `AFCQ-` numeric suffix
3. Also scan `AF-` / `AF2-` keys to catch any previously issued V2 IDs
4. `global_max + 1` = new countid
5. Write `ShipmentOrderV2CountId` entity to register the new ID

**Test result:** `AF-003867` ✅ (gap of 2 from 003865 expected — test records
created and deleted during Opus validation)

**Rogue record deleted:** `AF-000001` removed from Datastore ✅

**Commit:** In progress at end of session.

---

## BL Parse — Update Mode Design

The BL parser currently only supports **create mode** (IMPORT). The next
workstream is **update mode** (EXPORT) — carrier issues a BL post-departure,
staff uploads it to update an existing shipment's booking details.

### Two Modes

| Mode | Trigger | Action | Transaction Type |
|---|---|---|---|
| `create` | Staff receives BL from overseas shipper | Creates new `AF-` shipment | Always IMPORT |
| `update` | Carrier issues BL post-departure | Updates existing shipment booking fields | Always EXPORT |

### Update Mode — What Gets Updated

When a BL is uploaded in update mode, the following fields are patched on the
existing `Quotation` (ShipmentOrder) entity:

| Field | Source |
|---|---|
| `booking.booking_reference` | `waybill_number` from parsed BL |
| `booking.carrier` | `carrier` from parsed BL |
| `booking.vessel_name` | `vessel_name` from parsed BL |
| `booking.voyage_number` | `voyage_number` from parsed BL |
| `etd` | `on_board_date` from parsed BL |
| `parties.shipper` | `shipper_name` + `shipper_address` from parsed BL |
| `type_details.containers[]` | Container numbers + seal numbers from parsed BL |
| `updated` | `now` |

**What does NOT change:** status, company_id, incoterm, order_type,
transaction_type, origin/destination ports, cargo description, tasks.

### Update Mode — Trigger for FREIGHT_BOOKING → EXPORT_CLEARANCE Unblock

When `booking.booking_reference` is set by the BL update, the server must
check if `FREIGHT_BOOKING` task is `COMPLETED`. If it is, and
`EXPORT_CLEARANCE` is `BLOCKED`, it should be unblocked to `PENDING`.

This mirrors the existing logic in `PATCH /tasks/{task_id}` — it should be
extracted into a shared helper `_maybe_unblock_export_clearance(client,
shipment_id, tasks)` and called from both the task update endpoint and the
new BL update endpoint.

### Update Mode — UI Flow

The existing `BLUploadTab.tsx` handles the create flow. For update mode,
a separate but similar component is needed — or the existing one is extended
with a mode toggle.

**Proposed UI flow for update mode:**

1. Staff opens an existing EXPORT shipment detail page
2. Clicks "Upload BL" button (new button on shipment detail — booking section)
3. Upload zone appears (same drag/drop UI as create mode)
4. BL is parsed — same `POST /api/v2/shipments/parse-bl` endpoint (no change)
5. Preview shown with pre-filled fields — staff can review/adjust
6. Staff clicks "Update Shipment" — calls new `PATCH /api/v2/shipments/{id}/bl`
7. Booking fields updated, status auto-advances if appropriate, tasks unblocked

### New Server Endpoint

```
PATCH /api/v2/shipments/{shipment_id}/bl
```

**Request body:**
```python
class UpdateFromBLRequest(BaseModel):
    waybill_number: str | None = None
    carrier: str | None = None
    vessel_name: str | None = None
    voyage_number: str | None = None
    etd: str | None = None
    shipper_name: str | None = None
    shipper_address: str | None = None
    containers: list | None = None  # [{container_number, container_type, seal_number}]
```

**Logic:**
1. Load `Quotation` entity — 404 if not found
2. AFC company check — must match `company_id` on shipment
3. Patch fields onto existing entity (merge, not replace)
4. If `waybill_number` is set → call `_maybe_unblock_export_clearance`
5. Write entity + update `updated` timestamp
6. Log to `AFSystemLogs`
7. Return updated `booking` + `parties` + `etd`

**Auth:** `require_afu` only — customers cannot upload BLs.

### New Platform Action

New action in `af-platform/src/app/actions/shipments-write.ts`:

```typescript
export async function updateShipmentFromBLAction(
  shipmentId: string,
  payload: UpdateFromBLPayload,
): Promise<UpdateFromBLResult>
```

Calls `PATCH /api/v2/shipments/{id}/bl`.

### Placement on Shipment Detail Page

The "Upload BL" button should appear on the shipment detail page inside the
**booking/route section** (Overview tab), visible only to AFU roles, and only
when the shipment is in an appropriate status (Booked or later, EXPORT only).

---

## Current State of BL Parser (Create Mode)

For next session context — what is already built:

### Server (`af-server/routers/shipments.py`)
- `POST /api/v2/shipments/parse-bl` — Claude API call, port matching, company matching, initial status derivation ✅
- `POST /api/v2/shipments/create-from-bl` — creates Quotation + ShipmentWorkFlow + auto-generates incoterm tasks ✅ (ID fix applied this session)

### Platform (`af-platform`)
- `BLUploadTab.tsx` — full UI: drag/drop upload, parsing state, preview form with pre-filled fields, company match card, container table ✅
- `parseBLAction` — calls `parse-bl` server endpoint ✅
- `createShipmentFromBLAction` — calls `create-from-bl` server endpoint ✅
- BL upload accessible via "New Shipment" modal (as a tab alongside manual entry) ✅

---

## TODO Index

### 🔴 Next Session (immediate priority)

| Task | Notes |
|---|---|
| BL parse — update mode | Design complete above — write Opus prompt |
| Verify commit + push fired Cloud Build | Check Cloud Run deployment after commit |

### ⏳ Queued (unblocked)

| Task | Notes |
|---|---|
| Shipment detail — files tab | Unblocked |
| Shipment detail — V1 parties cards | Unblocked |
| Company detail — files tab | Unblocked |
| Duplicate Shipment | Needs server endpoint |
| Pricing Tables UI | S6 dependency cleared |

### ⏳ Queued (blocked on dependencies)

| Task | Blocked on |
|---|---|
| Quotations / ShipmentOrder creation module | Pricing Tables first |
| Draft auto-cleanup job (60 days) | After creation module |

### 🔵 Deferred

| Task | Notes |
|---|---|
| S4 — Status stage redesign | Per-stage timestamps on ShipmentWorkFlow |
| S5 — Route Node Timeline | Visual leg tracker |
| Geography module | Low priority |
| System Logs module | After V2 modules generating meaningful logs |
| CompanyUserAccount repair (54% broken) | Phase 3 |
| Supplier reference model | When pricing module scoped |
| Invoicing module redesign | Future scope |
| Phase 2 — Rekey AFCQ- → AF- | After all 22 active orders close + old TMS off |

---

## Deployment State

| Service | URL | Status |
|---|---|---|
| af-platform | https://appv2.accelefreight.com | ✅ Live |
| af-server | https://api.accelefreight.com | ✅ Live |
| af-cloud-auth-server | https://auth.accelefreight.com | ✅ Live |
| alfred.accelefreight.com | Old Vue TMS | ⚠️ To be decommissioned |

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

## Working Method

- **Claude AI (Sonnet 4.6)** — design, high-level rationale, small MCP edits, handover files, prompt preparation
- **VS Code (Opus 4.6)** — complex coding and file creation
- **Handover files** — written to repo root (`C:\dev\af-cloud-v2\`), only when prompted
- **Prompt file** — `C:\dev\af-cloud-v2\PROMPT-CURRENT.md`, overwritten each time
- **Handover index** — increments from last created (next will be v2.19)
