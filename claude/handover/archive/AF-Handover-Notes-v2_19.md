# AF Platform — Handover Notes v2.19 (DRAFT)
**Date:** 28 February 2026
**Session Focus:** Shipment Files Tab + BL Parse Update Mode + BL Parser Fixes + Route Node Timeline Design + Task Model Redesign
**Prepared by:** Claude / Calvin
**Supersedes:** AF-Handover-Notes-v2_18.md
**Status:** DRAFT — rename to AF-Handover-Notes-v2_19.md at session end

---

## Version History (Summary)

| Version | Date | Summary |
|---|---|---|
| ... | ... | See v2.18 for full history |
| 2.18 | 28 Feb 2026 | BL parser ID fix. BL parse update mode designed. |
| 2.19 | 28 Feb 2026 | Files tab + BL update mode prompted. BL parser fixes (LCL cargo, carrier/agent label). Route Node Timeline designed. Task model redesigned with POL/POD, transhipments, ASSIGNED/TRACKED/IGNORED modes, timing fields. |

---

## Session Summary

Five things this session:

1. **Opus prompts prepared (2 parts)** — written to `PROMPT-PART1.md` and
   `PROMPT-PART2.md`. Ready for VS Code execution in order.

2. **BL update mode trigger corrected** — relaxed to `order_type IN
   [SEA_FCL, SEA_LCL]` only. Covers EXPORT, all IMPORT incoterms, and
   DOMESTIC sea freight (e.g. Port Klang → Kota Kinabalu confirmed via live
   test with shipment AFCQ-003794).

3. **BL parser fixes identified via live test** — LCL cargo fields missing
   from parsed response, empty containers table shown for LCL shipments,
   carrier field renamed to carrier/agent across all UI.

4. **Route Node Timeline (S5) fully designed** — pulled forward from deferred.
   Port nodes replace abstract milestones. Transhipments slot naturally
   between POL and POD. DOMESTIC sea freight confirmed as valid use case.

5. **Task model redesigned** — ASSIGNED/TRACKED/IGNORED modes. IN_TRANSIT
   removed. VESSEL_DEPARTURE/ARRIVAL renamed to POL/POD. Task timing expanded
   to scheduled_start/end + actual_start/end (ATD/ATA on execution).

---

## Prompt Files This Session

| File | Purpose | Status |
|---|---|---|
| `PROMPT-PART1.md` | Files tab + BL update mode + BL parser fixes | Ready |
| `PROMPT-PART2.md` | Route node timeline + task model redesign | Ready — run after Part 1 |

Old `PROMPT-CURRENT.md` and `PROMPT-CURRENT-PART2.md` are superseded.
Can be deleted after Part 1 is confirmed working.

---

## Correction: BL Parse Update Mode Trigger

**Previous (v2.18):** Update mode was "Always EXPORT"
**Corrected:** Triggered by `order_type`, not `transaction_type` or `incoterm`

```typescript
const showBLUpload =
  userRole === 'AFU' &&
  shipment.status >= 3001 &&
  ['SEA_FCL', 'SEA_LCL'].includes(shipment.order_type)
```

Rationale:
- EXPORT sea freight — carrier issues BL post-departure ✅
- FOB IMPORT — overseas shipper arranges freight, AF receives BL copy ✅
- CNF/CIF IMPORT — seller arranges freight, AF may still receive BL ✅
- DOMESTIC SEA — Port Klang → Kota Kinabalu (confirmed via live test) ✅
- AIR — AWB is different document, different parser, deferred ❌
- CROSS_BORDER / GROUND — no BL ❌

---

## BL Parser Fixes (from live test — AFCQ-003794)

Live test used BL: `MX/BKI/EM/2601/140` (Macrolink Express, Port Klang →
Kota Kinabalu, 2 pallets Air Dry Primer Light Grey — LCL/loose cargo).

### Fix 1 — LCL cargo fields
Parser correctly returned no containers (LCL shipment has none). But the
`ParsedBLResponse` model had no `cargo_items` field, so pallet/weight/CBM
data was lost. Fix: add `cargo_items` list to parsed response and update
the Claude API prompt to extract loose cargo details.

### Fix 2 — Empty containers table
UI rendered an empty containers table for LCL shipments, making it appear
the parser failed. Fix: containers table hidden when `containers` is null
or empty; replaced by cargo summary section when `cargo_items` present.

### Fix 3 — Carrier / Agent label
The party issuing a BL is not always the shipping line — it may be an NVOCC,
co-loader, or freight forwarder acting as agent (Macrolink Express in the
live test is an example). Field renamed to `carrier_agent` in data going
forward. Display label = "Carrier / Agent" across all UI touchpoints.
Old `booking.carrier` field preserved for V1 backward compatibility.
Read pattern: `booking.carrier_agent ?? booking.carrier`.

---

## Route Node Timeline — Full Design (S5 — Pulled Forward)

### Core Principle
The shipment route is a sequence of port nodes. Transit between nodes is
implicit — no explicit task needed. Each port node carries its own timing.

### Route Node Data Model
New `route_nodes` array on Quotation entity (defaults to `[]`):

```python
{
    "port_un_code":   str,           # e.g. "MYPKG", "SGSIN", "NLRTM"
    "port_name":      str,           # denormalised for display
    "sequence":       int,           # 1=ORIGIN, 2..N-1=TRANSHIP, N=DESTINATION
    "role":           str,           # ORIGIN | TRANSHIP | DESTINATION
    "scheduled_eta":  str | None,    # ORIGIN always None
    "actual_eta":     str | None,    # ATA on execution
    "scheduled_etd":  str | None,    # DESTINATION always None
    "actual_etd":     str | None,    # ATD on execution
}
```

Flat `etd`/`eta` on shipment entity remain as fast-read aliases:
- `etd` = ORIGIN node `scheduled_etd`
- `eta` = DESTINATION node `scheduled_eta`
Kept in sync whenever route nodes are updated.

### Transhipment Ports
Staff add/remove transhipment nodes at any point in lifecycle.
Each transhipment has independent ETA/ATA + ETD/ATD.

Example:
```
[POL: MYPKG] → [TRANSHIP: SGSIN] → [TRANSHIP: AEJEA] → [POD: NLRTM]
  ETD/ATD        ETA/ATA+ETD/ATD     ETA/ATA+ETD/ATD      ETA/ATA
```

### Applicability
- SEA_FCL / SEA_LCL — port nodes are seaports
- AIR — port nodes are airports (same model, same terms)
- CROSS_BORDER / GROUND — route nodes not applicable

---

## Task Model — Revised Design

### Revised Leg Sequence

| Level | Task Type | Display Name | Default Mode |
|---|---|---|---|
| 1 | `ORIGIN_HAULAGE` | Origin Haulage / Pickup | ASSIGNED |
| 2 | `FREIGHT_BOOKING` | Freight Booking | ASSIGNED |
| 3 | `EXPORT_CLEARANCE` | Export Customs Clearance | ASSIGNED |
| 4 | `POL` | Port of Loading | TRACKED |
| 5 | `POD` | Port of Discharge | TRACKED |
| 6 | `IMPORT_CLEARANCE` | Import Customs Clearance | ASSIGNED |
| 7 | `DESTINATION_HAULAGE` | Destination Haulage / Delivery | ASSIGNED |

IN_TRANSIT removed. Transhipments visible in route node timeline only.

### Task Mode
| Mode | Meaning | Customer Visible |
|---|---|---|
| `ASSIGNED` | AF owns and executes | Yes (when visibility = VISIBLE) |
| `TRACKED` | Third party executes, AF monitors | Yes (when visibility = VISIBLE) |
| `IGNORED` | Not applicable | Never |

Mode mutable by AFU + AFC Admin/Manager at any point in lifecycle.

### Task Timing
```python
{
    "scheduled_start": str | None,   # original planned start
    "scheduled_end":   str | None,   # original planned end / due date
    "actual_start":    str | None,   # ATD — set when IN_PROGRESS
    "actual_end":      str | None,   # ATA — set when COMPLETED
}
```

### Permission Matrix (Updated)

| Action | AFU | AFC Admin | AFC Manager | AFC regular |
|---|---|---|---|---|
| View tasks | ✅ | ✅ | ✅ | ✅ |
| Update status / notes | ✅ | ✅ | ✅ | ❌ |
| Change task mode | ✅ | ✅ | ✅ | ❌ |
| Set actual_start / actual_end | ✅ | ✅ | ✅ | ❌ |
| Reassign task | ✅ | ✅ | ✅ | ❌ |
| Override scheduled dates | ✅ | ✅ | ✅ | ❌ |
| Add/remove transhipment port | ✅ | ✅ | ✅ | ❌ |
| Toggle task visibility | AFU only | ❌ | ❌ | ❌ |
| Set task IGNORED | AFU only | ❌ | ❌ | ❌ |

---

## Known Issue — Task Naming (AF-003866)

Task card shows "Destination Ground Transportation" instead of display label
"Destination Haulage / Delivery". The `display_name` field mapping was not
applied in the UI render.

AF-003866 is an AIR shipment — task engine was not scoped for AIR in v2.17.
Presence of partial tasks on this record needs investigation. Part 2 prompt
instructs Opus to read the ShipmentWorkFlow entity directly before touching
any task code.

---

## Test Checklist — PROMPT-PART1.md

### Files Tab
- [ ] Files tab appears on shipment detail page for a V2 shipment (AF-)
- [ ] Files tab appears on shipment detail page for a V1 shipment (AFCQ-)
- [ ] Empty state shown when no files exist
- [ ] Upload a PDF file — appears in list with correct name, size, tags
- [ ] Upload a non-PDF file (image, doc) — correct file icon shown
- [ ] File size displays correctly ("123 KB" / "1.2 MB")
- [ ] Clicking file name opens download in new tab (signed GCS URL)
- [ ] Tag editor opens, tags can be changed and saved
- [ ] Visibility toggle works (AFU only — eye icon toggles state)
- [ ] Delete button soft-deletes file (disappears from list, trash=true in Datastore)
- [ ] AFC regular user cannot see visibility toggle or delete button
- [ ] AFC regular user cannot see files where visibility=false
- [ ] Upload button hidden for AFC regular user
- [ ] Max 20MB file validation fires on oversized file

### BL Update Mode
- [ ] "Upload BL" button visible on SEA_FCL shipment at status >= 3001 (AFU)
- [ ] "Upload BL" button visible on SEA_LCL shipment at status >= 3001 (AFU)
- [ ] "Upload BL" button visible on DOMESTIC SEA_LCL shipment (e.g. PKG→KK)
- [ ] "Upload BL" button NOT visible on AIR shipment
- [ ] "Upload BL" button NOT visible for AFC role users
- [ ] "Upload BL" button NOT visible on shipment with status < 3001
- [ ] BL PDF upload triggers parse — parsed fields pre-fill the form
- [ ] FCL shipment: containers table shown with parsed container data
- [ ] LCL shipment: containers table hidden, cargo summary shown instead
- [ ] Field label shows "Carrier / Agent" (not "Carrier")
- [ ] "Update Shipment" saves data — booking fields updated on shipment detail
- [ ] BL PDF auto-saved to Files tab with tag "bl" after update

### BL Create Mode (regression check)
- [ ] Create new shipment via BL upload still works (FCL)
- [ ] Create new shipment via BL upload works for LCL (cargo summary shown)
- [ ] "Carrier / Agent" label shown in create mode preview form
- [ ] BL PDF auto-saved to Files tab with tag "bl" after creation
- [ ] Shipment ID generated correctly (not AF-000001)

---

## Test Checklist — PROMPT-PART2.md

### Task Display Names
- [ ] "Origin Haulage / Pickup" shown (not "Origin Haulage")
- [ ] "Freight Booking" shown
- [ ] "Export Customs Clearance" shown
- [ ] "Port of Loading" shown (not "Vessel Departure")
- [ ] "Port of Discharge" shown (not "Vessel Arrival")
- [ ] "Import Customs Clearance" shown
- [ ] "Destination Haulage / Delivery" shown (not "Destination Ground Transportation")
- [ ] Old V1 tasks with legacy names display gracefully (no crash)

### Task Mode
- [ ] New shipment created — POL and POD default to TRACKED mode
- [ ] New shipment created — other tasks default to ASSIGNED mode
- [ ] Staff can change task mode to TRACKED (AFU)
- [ ] Staff can change task mode to IGNORED — task greys out / hides
- [ ] Staff can change task mode back from IGNORED
- [ ] BLOCKED status not available when mode = TRACKED
- [ ] AFC regular cannot change task mode

### Task Timing
- [ ] Scheduled start/end fields visible and editable on task card (AFU)
- [ ] Moving task to IN_PROGRESS prompts for actual_start
- [ ] Moving task to COMPLETED prompts for actual_end
- [ ] Deviation indicator shown when actual differs from scheduled
- [ ] completed_at still populated on COMPLETED (backward compat)

### Route Node Timeline
- [ ] Route node timeline renders on shipment detail for V2 shipment
- [ ] ORIGIN port shown with ETD
- [ ] DESTINATION port shown with ETA
- [ ] Timeline renders correctly for V1 shipment (derived from port codes)
- [ ] Staff can add a transhipment port between POL and POD
- [ ] Transhipment port shows ETA/ETD fields
- [ ] Staff can remove a transhipment port
- [ ] Sequence auto-reorders after add/remove
- [ ] Updating ORIGIN scheduled_etd syncs shipment-level `etd` field
- [ ] Updating DESTINATION scheduled_eta syncs shipment-level `eta` field
- [ ] Actual times (ATD/ATA) shown prominently when set, scheduled shown smaller
- [ ] Deviation indicator (⚠) shown when actual ≠ scheduled
- [ ] AFC regular sees timeline read-only (no edit controls)
- [ ] V1 shipments: route nodes read-only (no save to Datastore)

### AF-003866 Bug
- [ ] AF-003866 task display names corrected
- [ ] Console / server logs show investigation result for AIR shipment tasks
- [ ] No crash or regression on AF-003866 shipment detail page

---

## TODO Index

### 🔴 Execute Next (prompts ready)
| Task | File | Notes |
|---|---|---|
| Run PROMPT-PART1.md in VS Code (Opus) | `PROMPT-PART1.md` | Files tab + BL update + parser fixes |
| Run PROMPT-PART2.md in VS Code (Opus) | `PROMPT-PART2.md` | Route nodes + task redesign — after Part 1 |
| Verify Cloud Build fired from last commit | — | Check Cloud Run deployment |

### ⏳ Queued (unblocked)
| Task | Notes |
|---|---|
| Shipment detail — V1 parties cards | Unblocked |
| Company detail — files tab | Unblocked |
| Duplicate Shipment | Needs server endpoint |
| Pricing Tables UI | S6 dependency cleared |

### ⏳ Queued (blocked)
| Task | Blocked on |
|---|---|
| Quotations / ShipmentOrder creation module | Pricing Tables first |
| Draft auto-cleanup job | After creation module |

### 🔵 Deferred
| Task | Notes |
|---|---|
| AWB parser (Air Waybill) | Equivalent of BL parser for AIR shipments |
| S4 — Status stage redesign | Superseded by new task timing model |
| Geography module | Low priority |
| System Logs module | After V2 modules generating meaningful logs |
| CompanyUserAccount repair | Phase 3 |
| Invoicing module redesign | Future scope |
| Phase 2 — Rekey AFCQ- → AF- | After all 22 active V1 orders close |

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
- **Prompt files** — `PROMPT-PART1.md` and `PROMPT-PART2.md`, overwritten each session
- **Handover index** — next will be v2.20
