# Prompt Completion Log — v3.03–v3.12

### [2026-03-04 10:00 UTC] — v3.03: Incoterm-Aware Status Logic + EXW Export Block
- **Status:** Completed
- **Tasks:**
  - Change 1: Added `_BOOKING_NOT_RELEVANT` set and `_is_booking_relevant()` helper to `_helpers.py`
  - Change 2: Added incoterm-aware status auto-advance to BL apply (`bl.py`) — reads `incoterm_code` + `transaction_type`, advances to 3002 or uses `_determine_initial_status(etd)` based on booking relevance
  - Change 3: Added incoterm-aware status auto-advance to AWB apply (`doc_apply.py`) — same pattern using `flight_date`
  - Change 4: EXW export hard block in frontend — filtered EXW from incoterm options when `transactionType === 'EXPORT'` in both `StepRoute.tsx` (Combobox) and `BLManualFields.tsx` (native select), auto-clears EXW on transaction type switch
- **Files Modified:**
  - `af-server/routers/shipments/_helpers.py`
  - `af-server/routers/shipments/bl.py`
  - `af-server/routers/shipments/doc_apply.py`
  - `af-platform/src/components/shipments/_create-shipment/StepRoute.tsx`
  - `af-platform/src/components/shipments/_bl-upload/BLManualFields.tsx`
  - `af-platform/src/components/shipments/CreateShipmentModal.tsx`

### [2026-03-04 11:00 UTC] — v3.04: Incoterm Edit on Shipment Details + Badge Consistency
- **Status:** Completed
- **Tasks:**
  - Change 1: Added `PATCH /{shipment_id}/incoterm` endpoint to `core.py` — AFU only, updates incoterm_code column
  - Change 2: Added `updateIncotermAction` server action to `shipments-write.ts` following `updateShipmentPortAction` pattern
  - Change 3: Added `IncotermEditModal` component to `_components.tsx` — select dropdown with EXW export block, wired into RouteCard via pencil icon; disabled for Completed/Cancelled shipments
  - Change 4: Replaced plain grey incoterm pill in `PortPair.tsx` with colour-coded `IncotermPill` component matching `INCOTERM_COLORS` from `ShipmentOrderTable.tsx`, added `onEditIncoterm` prop + pencil button
- **Files Modified:**
  - `af-server/routers/shipments/core.py`
  - `af-platform/src/app/actions/shipments-write.ts`
  - `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`
  - `af-platform/src/components/shared/PortPair.tsx`

### [2026-03-04 12:00 UTC] — v3.05: Port Combobox Fix — BLReview + BCReview
- **Status:** Completed
- **Tasks:**
  - Change 1: Added searchable `PortCombobox` to `BLReview.tsx` — sea ports only, introduces `pol_code`/`pod_code` formState keys, shows parsed label hint with amber "not matched" warning
  - Change 2: Replaced readOnly POL/POD inputs in `BCReview.tsx` with searchable `PortCombobox` — same pattern as BLReview, parsed name shown as hint
  - Change 3: Added port validation guard in `DocumentParseModal.tsx` — blocks apply for BL/BC if `pol_code` or `pod_code` missing, shows inline error message
- **Files Modified:**
  - `af-platform/src/components/shipments/_doc-parsers/BLReview.tsx`
  - `af-platform/src/components/shipments/_doc-parsers/BCReview.tsx`
  - `af-platform/src/components/shipments/DocumentParseModal.tsx`

### [2026-03-03 14:30 UTC] — v3.06: Port Code Resolution at Parse Time (BL + BC)
- **Status:** Completed
- **Tasks:**
  - Added DB dependency (`get_db`) and `_match_port_un_code` import to `ai.py` parse-document endpoint
  - Added port name → UN code resolution after Claude extraction for BL (`port_of_loading`/`port_of_discharge` → `pol_code`/`pod_code`)
  - Added fallback port resolution for BC (`pol_name`/`pod_name` → `pol_code`/`pod_code` when Claude doesn't return codes)
  - AWB unchanged (uses IATA codes directly)
- **Files Modified:**
  - `af-server/routers/ai.py`
