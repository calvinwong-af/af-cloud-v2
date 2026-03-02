# AF Platform — Handover Notes v2.17
**Date:** 28 February 2026
**Session Focus:** V1 → V2 Data Migration + Post-Migration Fixes
**Prepared by:** Claude / Calvin

---

## Session Summary

Two major workstreams this session:

1. **V1 → V2 migration script built and executed** — 2,034 records written to
   new `ShipmentOrder` Kind, 0 errors. Migration complete.
2. **Post-migration server fixes** — stats, list, and single record endpoints
   updated to read from the new `ShipmentOrder` Kind (migrated records).

Additionally: Incoterm task engine fully designed. BL parse feature scoped.
Both documented below for next session.

---

## Migration — Complete ✅

### Script
`af-server/scripts/migrate_v1_to_v2.py`

Built by Opus. Dry-run tested twice. Live run executed successfully.

### Key Decisions Made During Migration Design

**All V1 records targeted** — old Vue TMS switched off at cutover. One-way,
one-time migration.

**Legacy drafts skipped** — V1 records with no `ShipmentOrder` entity OR where
derived V2 status would be `1001 Draft` are excluded. Dead enquiries/proposals
with no operational value.

**Draft auto-cleanup policy (V2 going forward)** — drafts older than **60 days**
soft-deleted (`trash: true`) by a scheduled cleanup job. To be built when
ShipmentOrder creation module is built.

**Key field mapping corrections** (discovered by Opus during dry run — V1 field
names differed from documentation):

| Field | Assumed Name | Actual V1 Name |
|---|---|---|
| Order type | `quotation_type` / `quotation_category` | `freight_type` + `container_load` |
| FCL containers | flat `container_size` / `container_type` | `containers[]` array with nested objects |
| LCL/Air packages | `packages[]` | `cargo_units[]` with `total_weight` / `total_cubic_meters` |
| Cargo description | `cargo_description` | `commodity` |
| Dangerous goods | `is_dangerous_goods` bool | `cargo_type.code == "DG"` nested entity |
| Parties | flat fields | nested entities (`shipper.address`, `shipper.contact_info`) |
| Booking | flat fields | `booking_info` nested entity |
| Dates | strings only | mixed `datetime` objects and strings — handled by `_safe_date_str` |

### Final Migration Counts

| Metric | Count |
|---|---|
| Total V1 Quotation records | 3,853 |
| Skipped (already V2) | 1 |
| Skipped (legacy drafts) | 1,818 |
| Migrated to ShipmentOrder Kind | **2,034** |
| Assembly errors | **0** |

**Order type breakdown:**
| Type | Count |
|---|---|
| SEA_FCL | 563 |
| SEA_LCL | 1,010 |
| AIR | 461 |

**Status breakdown:**
| Status | Label | Count |
|---|---|---|
| 2001 | Confirmed | 1 |
| 3001 | Booked | 18 |
| 3002 | In Transit | 3 |
| 5001 | Completed | 2,012 |

### Active Orders — Staff Handover List

22 live shipments requiring immediate staff attention post-cutover:

| ID | Status | Label |
|---|---|---|
| AFCQ-003829 | 3002 | In Transit |
| AFCQ-003830 | 3002 | In Transit |
| AFCQ-003863 | 3002 | In Transit |
| AFCQ-003794 | 3001 | Booked |
| AFCQ-003833 | 3001 | Booked |
| AFCQ-003837 | 3001 | Booked |
| AFCQ-003843 | 3001 | Booked |
| AFCQ-003846 | 3001 | Booked |
| AFCQ-003849 | 3001 | Booked |
| AFCQ-003850 | 3001 | Booked |
| AFCQ-003851 | 3001 | Booked |
| AFCQ-003852 | 3001 | Booked |
| AFCQ-003854 | 3001 | Booked |
| AFCQ-003855 | 3001 | Booked |
| AFCQ-003857 | 3001 | Booked |
| AFCQ-003858 | 3001 | Booked |
| AFCQ-003859 | 3001 | Booked |
| AFCQ-003860 | 3001 | Booked |
| AFCQ-003861 | 3001 | Booked |
| AFCQ-003862 | 3001 | Booked |
| AFCQ-003864 | 3001 | Booked |
| AFCQ-003842 | 2001 | Confirmed |

---

## Post-Migration Server Fixes — Complete ✅

### Problem
After migration, the platform showed incorrect stats and blank route columns
because the server endpoints only queried two sources:
- `Quotation` Kind (`data_version=2`) — new V2 records
- `ShipmentOrder` Kind (no `data_version`) — V1 legacy records

Migrated records live in a **third source**: `ShipmentOrder` Kind with
`data_version=2`. Neither endpoint knew about this.

### Fix Applied
`af-server/routers/shipments.py` updated to query all three sources:

| Source | Kind | Filter | Status type |
|---|---|---|---|
| New V2 records | `Quotation` | `data_version=2` | Direct V2 codes |
| V1 legacy (22 active) | `ShipmentOrder` | no `data_version` | V1 codes → mapped |
| Migrated records | `ShipmentOrder` | `data_version=2` | Direct V2 codes |

Three endpoints updated: `get_shipment_stats`, `list_shipments`, `get_shipment`.

### Additional Fix — To Invoice Count
`issued_invoice` on migrated records may be `False`, `0`, `None`, missing, or
`[]` depending on V1 source data. Fixed by using bare truthiness check
(`if not issued:`) instead of `bool(entity.get("issued_invoice", False))`.

Expected To Invoice count after fix: **~8 records** (consistent with pre-migration
expectation from v2.10).

### Final Platform State After Fixes
| Metric | Value |
|---|---|
| Total Orders | 2,034 |
| Active | 21 (22 less 1 Confirmed — correct) |
| Completed | 2,012 ✅ |
| To Invoice | ~8 ✅ |
| Draft | 1 (V2 test draft AF-003865) ✅ |
| Route column | Port codes visible ✅ |

---

## Incoterm Task Engine — Fully Designed (S6)

**Status:** Design complete. Prompt to be written in next session.

### Corrected Leg Sequence

Booking precedes export clearance — booking reference required by port systems
to process the export declaration.

| Level | Leg | Task Type | Nature |
|---|---|---|---|
| 1 | Origin haulage / cargo pickup | `ORIGIN_HAULAGE` | Actionable |
| 2 | Freight booking | `FREIGHT_BOOKING` | Actionable |
| 3 | Export customs clearance | `EXPORT_CLEARANCE` | Actionable — requires booking ref |
| 4 | Vessel/flight departure | — | Milestone only |
| 5 | In transit | — | Milestone only |
| 6 | Vessel/flight arrival | — | Milestone only |
| 7 | Import customs clearance | `IMPORT_CLEARANCE` | Actionable |
| 8 | Destination haulage / delivery | `DESTINATION_HAULAGE` | Actionable |

**Task dependency:** `EXPORT_CLEARANCE` blocked until `FREIGHT_BOOKING` complete
and booking reference exists on shipment.

### Incoterm Task Rules

| Incoterm | EXPORT (client is seller) | IMPORT (client is buyer) |
|---|---|---|
| EXW | ❌ No tasks | ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE, IMPORT_CLEARANCE, DESTINATION_HAULAGE |
| FCA | FREIGHT_BOOKING, EXPORT_CLEARANCE | ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE, IMPORT_CLEARANCE, DESTINATION_HAULAGE |
| FOB | ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE | FREIGHT_BOOKING, IMPORT_CLEARANCE, DESTINATION_HAULAGE |
| CFR / CIF / CNF | ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE | IMPORT_CLEARANCE, DESTINATION_HAULAGE |
| CPT / CIP | ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE | IMPORT_CLEARANCE, DESTINATION_HAULAGE |
| DAP / DPU | ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE, IMPORT_CLEARANCE, DESTINATION_HAULAGE | IMPORT_CLEARANCE, DESTINATION_HAULAGE |
| DDP | ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE, IMPORT_CLEARANCE, DESTINATION_HAULAGE | IMPORT_CLEARANCE, DESTINATION_HAULAGE |

Note: Rules are a starting point — to be refined from operational feedback.

### Task Data Model

Stored as `workflow_tasks` array on `ShipmentWorkFlow` Kind:

```python
{
    "task_id": str,               # UUID
    "task_type": str,             # ORIGIN_HAULAGE | FREIGHT_BOOKING | EXPORT_CLEARANCE
                                  # IMPORT_CLEARANCE | DESTINATION_HAULAGE
    "leg_level": int,             # 1–8 — display order
    "status": str,                # PENDING | IN_PROGRESS | COMPLETED | BLOCKED
    "assigned_to": str,           # AF | CUSTOMER | THIRD_PARTY
    "third_party_name": str | None,
    "visibility": str,            # VISIBLE | HIDDEN
    "due_date": str | None,       # ISO date
    "due_date_override": bool,    # True = manually set, False = auto-calculated
    "notes": str | None,
    "completed_at": str | None,
    "updated_by": str,
    "updated_at": str,
}
```

### Due Date Auto-Calculation

| Task | Formula |
|---|---|
| ORIGIN_HAULAGE | `cargo_ready_date` if set, else `ETD - 3 days` |
| FREIGHT_BOOKING | `ETD - 7 days` |
| EXPORT_CLEARANCE | `ETD - 2 days` |
| IMPORT_CLEARANCE | `ETA + 1 day` |
| DESTINATION_HAULAGE | `ETA + 3 days` |

Auto-recalculate non-overridden due dates when ETD/ETA change.

### Permission Matrix

| Action | AFU | AFC Admin | AFC Manager | AFC regular |
|---|---|---|---|---|
| View tasks | ✅ | ✅ | ✅ | ✅ |
| Update status / notes | ✅ | ✅ | ✅ | ❌ |
| Reassign task | ✅ | ✅ | ✅ | ❌ |
| Override due date | ✅ | ✅ | ✅ | ❌ |
| Hide / show task | ✅ only | ❌ | ❌ | ❌ |

### Three Deliverables for Opus

1. `af-server/logic/incoterm_tasks.py` — pure rules engine
2. Task endpoints in `af-server/routers/shipments.py`
   - `GET /api/v2/shipments/{id}/tasks`
   - `PATCH /api/v2/shipments/{id}/tasks/{task_id}`
3. Tasks UI on shipment detail page in `af-platform`

---

## BL Parse Feature — Scoped (Deferred)

### Key Design Decisions

| Mode | Trigger | Action | Transaction Type |
|---|---|---|---|
| `create` | Staff receives BL from overseas shipper | Creates new shipment | Always IMPORT |
| `update` | Carrier issues BL post-departure | Updates existing shipment | Always EXPORT |

**No third-party OCR needed** — Claude API (`claude-sonnet-4-6`) handles both
digital PDF text extraction and scanned image parsing natively.

**Architecture:** `POST /api/v2/shipments/parse-bl` in `af-server`. Requires
Anthropic API key in `af-server` environment (separate from platform key).

**Sequencing:** Build after incoterm task engine and shipment creation form.

---

## TODO Index

### 🔴 Next Session (immediate priority)

| Task | Notes |
|---|---|
| Incoterm task engine (S6) | Design complete — write Opus prompt at session start |
| Commit + push post-migration fixes | Opus to handle before session ends |

### ⏳ Queued

| Task | Notes |
|---|---|
| Update `AF-V2-Data-Model` → v0.5 | Kind rename, scrapped Kinds, updated entity map |
| Shipment detail — files tab | Unblocked |
| Shipment detail — V1 parties cards | Unblocked |
| Pricing Tables UI | After incoterm task engine |
| Quotations / ShipmentOrder creation module | After Pricing Tables |
| Duplicate Shipment | Needs server implementation |
| Company detail — files tab | Queued |
| BL parse feature | After shipment creation form exists |
| Draft auto-cleanup job (60 days) | After ShipmentOrder creation module |

### 🔵 Deferred

| Task | Notes |
|---|---|
| S4 — Status stage redesign | Per-stage timestamps on ShipmentWorkFlow |
| S5 — Route Node Timeline | Visual leg tracker |
| Geography module | Low priority |
| System Logs module | After V2 modules generating meaningful logs |
| CompanyUserAccount repair (54% broken) | Phase 3 |
| Supplier reference model | When pricing module scoped |
| Geocoding / Zone replacement | Much later |
| Invoicing module redesign | Future scope |
| Phase 2 — Rekey AFCQ- → AF- | After all 22 active orders close + old TMS off |

### ✅ Done This Session

| Task | |
|---|---|
| V1 → V2 migration script | ✅ |
| Migration dry run (x2) | ✅ |
| Migration live run — 2,034 records, 0 errors | ✅ |
| Post-migration stats fix | ✅ |
| Post-migration list fix (route column) | ✅ |
| Post-migration single record fix | ✅ |
| To Invoice count fix | ✅ |
| Delete AF2-000001 test record | ✅ |
| Incoterm task engine design | ✅ |
| BL parse feature scoped | ✅ |

---

## Deployment State

| Service | URL | Status |
|---|---|---|
| af-platform | https://appv2.accelefreight.com | ✅ Live |
| af-server | https://api.accelefreight.com | ✅ Live |
| af-cloud-auth-server | https://auth.accelefreight.com | ✅ Live |
| alfred.accelefreight.com | Old Vue TMS | ⚠️ To be decommissioned |

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
