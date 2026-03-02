# AF Handover Notes — v2.37
**Date:** 03 March 2026
**Test List Version:** v2.47
**Session Focus:** Document Parser Feature (DOC-PARSE) — airport seed, unified parse endpoint, BC/AWB support, live testing, defect logging

---

## Session Summary

This session designed and implemented the full Document Parser feature (DOC-PARSE), extending the platform's existing BL parsing capability to handle Air Waybills (AWB) and Booking Confirmations (BC). All 5 prompt series were executed by Opus. Airport reference data was seeded, schema migrations applied, and initial live testing performed against a real CMA CGM Booking Confirmation PDF.

---

## Completed This Session

### 1. Airport Seed (DP-01 YES)
- `af-server/scripts/seed_airports.py` — 97 airports seeded with `port_type='AIR'`, IATA codes as `un_code`
- Reuses existing `ports` table with zero schema changes
- Run: `python -m scripts.seed_airports`
- Immediate effect: AF-003866 (MUC to KUL) now resolves airport names in RouteCard tooltips
  - MUC — "Munich Airport, Germany" (DP-03 YES)
  - KUL — "Kuala Lumpur International Airport, Malaysia" (DP-02 YES)

### 2. Schema Migration
- `af-server/scripts/add_document_parse_columns.py` — 4 new columns added to `shipments` table:
  - `booking_reference VARCHAR`
  - `hawb_number VARCHAR`
  - `mawb_number VARCHAR`
  - `awb_type VARCHAR`
- Run: `python -m scripts.add_document_parse_columns`

### 3. Backend — /ai/parse-document Endpoint (Prompt 2)
- `af-server/routers/ai.py` — new file
- POST /api/v2/ai/parse-document
- Two-step Claude API flow: classify (BL / AWB / BOOKING_CONFIRMATION / UNKNOWN) then extract per schema
- Registered in `main.py` under `/api/v2/ai`
- Model: `claude-sonnet-4-6`
- `ANTHROPIC_API_KEY` read from environment — must be set in `.env.local`

### 4. Backend — Apply Endpoints (Prompt 5)
- POST /api/v2/shipments/{id}/apply-booking-confirmation
- POST /api/v2/shipments/{id}/apply-awb
- Both endpoints write to PostgreSQL + Datastore (dual-write pattern)
- BC writes: `booking_reference`, `vessel_name`, `voyage_number`, port codes, route node timings (ETD/ETA)
- AWB writes: `hawb_number`, `mawb_number`, `awb_type`, parties, airport codes, flight details

### 5. Frontend — DocumentParseModal + Actions (Prompts 3 and 4)
- `af-platform/src/components/shipments/DocumentParseModal.tsx` — new unified upload/parse modal
- `af-platform/src/app/actions/shipments-files.ts` — `parseDocumentAction()` + full TypeScript types
- `af-platform/src/app/actions/shipments-write.ts` — `applyBookingConfirmationAction()`, `applyAWBAction()`
- `af-platform/src/lib/types.ts` — ShipmentOrder extended with new fields
- Shipment detail page: "Upload BL" button replaced with "Upload Document" (AFU only, status >= 2001, all order types)

---

## Live Testing Results

### Test: CMA CGM BC — AYN1317670 (MYPKG to USLAX)
Uploaded via New Shipment modal — Upload BL tab.

**Parsed correctly:**
- POL: PORT KLANG matched to MYPKG, Westports terminal pre-selected
- POD: LOS ANGELES matched to USLAX
- ETD: 20/02/2026
- Carrier: CMA CGM MALAYSIA SDN BHD
- Waybill/BL No.: AYN1317670
- Vessel: CMA CGM LEO
- Voyage: 1TUH4E1MA
- Cargo: Machines and apparatus specifi (Electronic Goods)
- Weight: 22,430 kg
- Containers: 40FF, 40FF, 20ST (3 rows)

**Defects found — logged as DP-19 to DP-23:**

| # | Issue | Root Cause |
|---|-------|-----------|
| DP-19 | Tab label still says "Upload BL" | BLUploadTab.tsx tab label not updated |
| DP-20 | Drop zone text still says "Drop your Bill of Lading here" | Same file — copy not updated |
| DP-21 | Initial status shows 4001 Departed (should be 3002 Booking Confirmed for BC) | `_determine_initial_status()` uses `on_board_date` — BC has no on_board_date, ETD date in past triggers wrong logic |
| DP-22 | Shipment Type (order_type / transaction_type / incoterm) shown as read-only badges | BLUploadTab.tsx renders static badges with "adjustable after creation" note |
| DP-23 | transaction_type defaults to IMPORT — should default to EXPORT for BC | BL parser hardcodes IMPORT; BC documents are almost always export |

**Confirm & Create NOT yet executed** — user held off pending fixes to DP-19 through DP-23.

---

## Pending Fixes — Next Prompt

All 5 defects target `BLUploadTab.tsx` primarily. Changes required:

**Copy/label changes:**
1. Tab label: "Upload BL" to "Upload Document"
2. Drop zone: "Drop your Bill of Lading here — PDF or image" to "Drop your shipping document here — PDF or image"
3. Success banner: "BL parsed successfully" to "Document parsed successfully"
4. Parsing spinner: "Parsing Bill of Lading..." to "Analysing document..."
5. "Waybill / BL No." label to "Booking Ref / BL No."

**Shipment Type — inline dropdowns (replaces static badges):**
- `order_type`: SEA FCL / SEA LCL / AIR
- `transaction_type`: IMPORT / EXPORT
- `incoterm_code`: EXW, FOB, CNF, CIF, DAP, DDP, FCA, CPT, CIP, DAT, DPU, FAS, CFR
- All three must be added to `BLFormState` and wired into `CreateFromBLRequest`

**Status logic:**
- If `parsedResult.initial_status === 4001` AND `parsed.on_board_date` is null/empty — override to 3002
- BC documents never have an on_board_date (vessel not departed yet at time of booking)

**Default values by doc type:**
- BC upload: default `transaction_type` to EXPORT
- BL upload: keep IMPORT default (existing behaviour)

**BLFormState additions needed:**
```
orderType: string        // 'SEA_FCL' | 'SEA_LCL' | 'AIR'
transactionType: string  // 'IMPORT' | 'EXPORT'
incotermCode: string     // incoterm string
```

Wire these into the `CreateFromBLRequest` assembly (find in NewShipmentModal or shipments-write.ts).

**Key file already read this session:** `BLUploadTab.tsx` — full content available in session context.
**File still needed:** wherever `CreateFromBLRequest` is assembled — likely NewShipmentModal or new shipment page.

---

## Environment State

- `af-server/.env.local` — `ANTHROPIC_API_KEY` added this session (new key from console.anthropic.com)
- Cloud SQL Auth Proxy must be running (`tools\start-proxy.bat`)
- No production deployment this session
- Local af-server and af-platform both operational

---

## Current Data State

### PostgreSQL — ports table
- 17 SEA ports (seed_port_terminals.py)
- 97 AIR airports (seed_airports.py — added this session)
- Total: 114 records

### PostgreSQL — shipments table
- 4 new columns added: `booking_reference`, `hawb_number`, `mawb_number`, `awb_type`
- All NULL for existing records — will populate on document upload

---

## Test List Status — v2.47

| Series | Status |
|--------|--------|
| DP-01 | YES — airports seeded |
| DP-02 | YES — KUL tooltip confirmed |
| DP-03 | YES — MUC tooltip confirmed |
| DP-04 to DP-18 | PENDING — parse + apply endpoints not yet tested end-to-end |
| DP-19 to DP-23 | PENDING — defects to fix before Confirm & Create |
| All prior series (PT, BL, PG, etc.) | Unchanged — all YES |

---

## Files Modified This Session

| File | Change |
|------|--------|
| `af-server/scripts/seed_airports.py` | New |
| `af-server/scripts/add_document_parse_columns.py` | New |
| `af-server/routers/ai.py` | New |
| `af-server/main.py` | Registered ai router |
| `af-server/routers/shipments.py` | apply-booking-confirmation + apply-awb endpoints added |
| `af-platform/src/components/shipments/DocumentParseModal.tsx` | New |
| `af-platform/src/app/actions/shipments-files.ts` | parseDocumentAction + types |
| `af-platform/src/app/actions/shipments-write.ts` | applyBookingConfirmationAction + applyAWBAction |
| `af-platform/src/lib/types.ts` | booking_reference, hawb_number, mawb_number, awb_type |
| `af-platform/src/app/(platform)/shipments/[id]/page.tsx` | Upload Document button + modal wiring |

---

## Recommended Next Steps

1. Fix DP-19 to DP-23 — one prompt targeting BLUploadTab.tsx + status/default logic
2. Test Confirm & Create — upload AYN1317670 BC again, verify shipment created correctly
3. Test DP-04 to DP-18 — parse endpoint, apply-bc, apply-awb on existing shipments
4. Deploy — push DOC-PARSE feature to production once DP series passes

---

## File Paths Reference

- Handover: `claude/handover/`
- Test list: `claude/tests/AF-Test-List.md`
- Prompt current: `claude/prompts/PROMPT-CURRENT.md`
- Prompt log: `claude/prompts/log/PROMPT-LOG-v2.63-v2.72.md`
