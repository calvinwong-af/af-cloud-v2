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
