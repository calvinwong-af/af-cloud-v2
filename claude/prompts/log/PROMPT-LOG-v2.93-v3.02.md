# Prompt Completion Log — v2.93–v3.02

### [2026-03-04 04:00 UTC] — v2.93: Read File Again — Doc-Type Routing
- **Status:** Completed
- **Tasks:**
  - Added `reparseDocumentFileAction` server action — downloads file from GCS, routes to correct parse endpoint based on doc type (BL → `/parse-bl`, AWB/BC → `/ai/parse-document` with hint)
  - Added `docTypeFromTags` helper to derive doc type from file tags
  - Rewrote `handleReparse` to accept full file object, determine doc type from tags, and dispatch to correct modal (BL → BLUpdateModal, AWB/BC → new DocApplyModal)
  - Added `DocApplyModal` component — displays parsed AWB/BC fields in a review list with "Use This Data" button that calls `applyAWBAction` or `applyBookingConfirmationAction`
  - Added new state variables for AWB/BC parsed data and modal visibility
  - Updated button call from `handleReparse(file.file_id)` to `handleReparse(file)`
- **Files Modified:**
  - `af-platform/src/app/actions/shipments-files.ts`
  - `af-platform/src/components/shipments/ShipmentFilesTab.tsx`

### [2026-03-04 05:30 UTC] — v2.96: Reparse Modal UI + RouteCard Pencil Icon Fix
- **Status:** Completed
- **Tasks:**
  - Fix 1: Replaced custom `DocApplyModal` with `DocumentParseModal` in pre-populated mode — added `initialDocType` and `initialParsedData` props to `DocumentParseModal`, added `useEffect` for AWB form pre-fill on mount, replaced state/render in `ShipmentFilesTab`, deleted `DocApplyModal` component
  - Fix 2: Fixed RouteCard pencil icon positioning — replaced hardcoded `style` margins with Tailwind flex alignment (`flex items-center h-full pl-1`/`pr-1`)
- **Files Modified:**
  - `af-platform/src/components/shipments/DocumentParseModal.tsx`
  - `af-platform/src/components/shipments/ShipmentFilesTab.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`

### [2026-03-04 06:00 UTC] — v2.97: Pencil Icon Inline Positioning + DocumentParseModal Token Refresh
- **Status:** Completed
- **Tasks:**
  - Fix 1: Moved pencil edit buttons from absolute positioning into inline PortPair props (`originAction`/`destAction`), rendered beside port codes via flex layout; removed `<div className="relative">` wrapper in RouteCard
  - Fix 2: Added `refreshSessionCookie()` call at start of `handleAnalyse` in DocumentParseModal to prevent token expiry on long parse calls
- **Files Modified:**
  - `af-platform/src/components/shared/PortPair.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`
  - `af-platform/src/components/shipments/DocumentParseModal.tsx`

### [2026-03-04 06:30 UTC] — v2.98: Standardise Document Parser Interface — BL, AWB, BC
- **Status:** Completed
- **Tasks:**
  - Fix 1: Rebuilt `BLReview.tsx` — replaced raw key/value dump with sectioned editable form (Carrier & Vessel, Ports, Shipper, Consignee, Notify Party, Containers table, Cargo Summary table) matching AWBReview pattern
  - Fix 2: Rebuilt `BCReview.tsx` — replaced raw key/value dump with sectioned editable form (Booking, Vessel & Voyage, Ports & Dates, Cargo, Containers table, Other Parties) matching AWBReview pattern
  - Fix 3: Verified `refreshSessionCookie()` already present in `handleAnalyse` (added in v2.97)
  - Fix 4: Routed BL reparse through `DocumentParseModal` instead of `BLUpdateModal` — updated `reparseInitialData` type to include BL, updated handleReparse BL branch, added BL case to onResult handler building FormData for `updateShipmentFromBLAction`, removed BLUpdateModal render block and unused state
- **Files Modified:**
  - `af-platform/src/components/shipments/_doc-parsers/BLReview.tsx`
  - `af-platform/src/components/shipments/_doc-parsers/BCReview.tsx`
  - `af-platform/src/components/shipments/ShipmentFilesTab.tsx`
  - `af-platform/src/components/shipments/DocumentParseModal.tsx`

### [2026-03-04 07:00 UTC] — v2.99: BL Upload File Save Fix
- **Status:** Completed
- **Tasks:**
  - Added `setPendingBLFile` param to `createDocResultHandler` and stored uploaded file in BL branch
  - Added `pendingBLFile` state to `page.tsx`, passed to doc handler
  - Updated BLUpdateModal `onSuccess` to save `pendingBLFile` via `uploadShipmentFileAction` with `['bl']` tag and refresh files list
  - Clear `pendingBLFile` on both `onSuccess` and `onClose` paths
- **Files Modified:**
  - `af-platform/src/app/(platform)/shipments/[id]/_doc-handler.ts`
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`

### [2026-03-04 07:30 UTC] — v3.00: BL + BC Form Pre-fill Fix (Upload Path)
- **Status:** Completed
- **Tasks:**
  - Added `parseBLDocumentAction` server action — converts base64 to Blob, POSTs to `/parse-bl` endpoint, extracts `parsed` object from response
  - Updated `handleAnalyse` in `DocumentParseModal` — when classified as BL, makes second call to `parseBLDocumentAction` for richer BL-specific extraction instead of using generic AI parse data
  - BC pre-fill verified: `parsedData` is passed directly as `formState` to BCReview, fields match `ParsedBCData` keys from `/ai/parse-document` extraction prompt — no additional mapping needed
- **Files Modified:**
  - `af-platform/src/app/actions/shipments-files.ts`
  - `af-platform/src/components/shipments/DocumentParseModal.tsx`

### [2026-03-04 08:00 UTC] — v3.01: BL Reparse Empty Fields + BC Upload Parse Error
- **Status:** Completed
- **Tasks:**
  - Bug 1: Added `useEffect` in DocumentParseModal for BL/BC reparse pre-fill — unwraps `/parse-bl` response's nested `parsed` property if present, sets `parsedData` correctly for BLReview/BCReview
  - Bug 2: Increased Claude API timeout from 30s to 60s in `_call_claude_async` for longer BC documents
  - Bug 2: Added timeout error detection to `sanitiseErrorMessage` — surfaces "timed out" / 503 errors with user-friendly message
- **Files Modified:**
  - `af-server/routers/ai.py`
  - `af-platform/src/components/shipments/DocumentParseModal.tsx`

---

## Bugs Identified — Session 14 (pending prompts)

### BUG-01: BC Apply — Status Not Auto-Advancing to Booking Confirmed
- **Observed:** After applying BC on AF-003843, status stays "Booking Pending" instead of advancing to "Booking Confirmed" (3002).
- **Fix:** In `apply_booking_confirmation` (`doc_apply.py`), add `status = STATUS_BOOKING_CONFIRMED` to the UPDATE. Import `STATUS_BOOKING_CONFIRMED` from constants (already imported).

### BUG-02: BC Apply — Containers Not Written to Shipment
- **Observed:** BCReview shows containers (40FF ×2, 20ST ×1) but shipment has no container data after apply.
- **Root Cause:** `apply_booking_confirmation` receives `containers` in request body but never writes to DB.
- **Fix:** In `apply_booking_confirmation` (`doc_apply.py`), write `body.containers` into `type_details` JSONB under a `containers` key, matching `apply_awb` pattern.

### BUG-03: Files Tab — "Unauthorised" Badge on Files (Recurring)
- **Observed:** BC file on AF-003843 shows "Unauthorised" badge. Same issue seen on AWB/BL files in prior sessions.
- **Root Cause:** Unknown — either GCS signed URL auth failing (403) or AF server auth check on file download endpoint.
- **Fix:** Investigate `af-server/routers/shipments/files.py` — check signed URL generation vs visibility flag vs auth middleware.

---

### [2026-03-04 08:30 UTC] — v3.02: BC Apply Fixes (Status + Containers)
- **Status:** Completed
- **Tasks:**
  - Bug 1: Added `status = STATUS_BOOKING_CONFIRMED` (3002) to `apply_booking_confirmation` UPDATE — status now auto-advances on BC apply
  - Bug 2: Added containers merge into `type_details` JSONB — maps BC `size` → `container_size` with quantity, matching standard container object shape
  - Updated SELECT to include `type_details` column for reading existing data before merge
- **Files Modified:**
  - `af-server/routers/shipments/doc_apply.py`

### [Session 15] — TODO-BC-01: BCReview POL/POD — Plain Text Instead of Port Combobox
- **Status:** TODO
- **Observed:** BCReview POL/POD fields render as plain text inputs showing raw parsed strings (e.g. `— PORT KLANG`, `— LOS ANGELES, CA`). AWBReview uses a searchable port combobox (CODE — Name format). BC fields must use the same combobox component for consistency and to ensure a valid port code is written on apply.
- **Root Cause:** BCReview `pol_name`/`pod_name` fields are plain `<input>` elements; they need to use the same `PortCombobox` (or equivalent) component used in AWBReview with `pol_code`/`pod_code` as the committed value.
- **Impact:** User cannot select/correct port on BC apply; wrong or missing port code may be written to shipment.
- **Fix:** Replace POL/POD plain inputs in `BCReview.tsx` with port combobox components matching AWBReview pattern. Ensure `pol_code`/`pod_code` values are submitted on apply, not the display name strings.
- **File:** `af-platform/src/components/shipments/_doc-parsers/BCReview.tsx`
- **Priority:** Medium — blocks clean BC apply flow

---

### [Session 14] — v3.03: Incoterm-Aware Status Logic + EXW Export Block
- **Status:** Draft written — in PROMPT-DRAFT-v3.03.md, run after v3.02
- **Scope:**
  - Add `_is_booking_relevant(incoterm, transaction_type)` helper
  - Auto-advance status on BL/AWB apply based on incoterm classification
  - Hard block EXW export in UI incoterm dropdown
- **Files to Modify:**
  - `af-server/routers/shipments/_helpers.py`
  - `af-server/routers/shipments/bl.py`
  - `af-server/routers/shipments/doc_apply.py`
  - Frontend incoterm dropdown component
