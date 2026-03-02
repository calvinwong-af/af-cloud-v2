# PROMPT-CURRENT — v2.70 — DOC-PARSE UX fixes + AWB redesign

## Overview
Several issues identified during live testing of the Upload Document feature across both the New Shipment modal (BLUploadTab) and the existing shipment detail page (DocumentParseModal). This prompt addresses all of them.

---

## Fix 1 — Doc type badge: use full label, not abbreviation

**Files:** `BLUploadTab.tsx`, `DocumentParseModal.tsx`

The badge currently shows `BL`, `BC`, `AWB`. Replace with full human-readable labels:

| doc_type value | Badge label |
|---|---|
| BL | Bill of Lading |
| BOOKING_CONFIRMATION | Booking Confirmation |
| AWB | Air Waybill |
| UNKNOWN | Unknown Document |

Apply consistently in both the New Shipment modal success banner and the DocumentParseModal header.

---

## Fix 2 — Initial Status wrong for Booking Confirmations (DP-21)

**Root cause:** The New Shipment modal calls the legacy `/parse-bl` endpoint which hardcodes `doc_type: "BL"` — even when the uploaded document is a Booking Confirmation. So `isBookingConfirmation` is always false and the status override never fires.

**Fix:** The `/parse-bl` endpoint must run a classification step before extraction, similar to `/api/v2/ai/parse-document` in `ai.py`.

### Backend — `af-server/routers/shipments.py` — `parse_bl` endpoint

Add a classification step using the same `_CLASSIFY_PROMPT` from `ai.py` before extraction. The extraction prompts (`_BC_EXTRACTION_PROMPT`, `_AWB_EXTRACTION_PROMPT`) already exist in `ai.py` — import or copy them into `shipments.py`. Choose extraction prompt based on classified `doc_type`, then return `doc_type` in the response.

For BC responses, map BC fields to the shape the frontend expects:
- `booking_reference` -> `waybill_number`
- `etd` -> `on_board_date` (used by `_determine_initial_status`)
- `pol_code` / `pol_name` -> `port_of_loading`
- `pod_code` / `pod_name` -> `port_of_discharge`

For BC: `_determine_initial_status` must return `STATUS_BOOKING_CONFIRMED` (3002) regardless of ETD — a booking confirmation means the vessel has not yet departed by definition.

### Frontend — no changes needed
The existing `effectiveStatus` override in `BLUploadTab.tsx` and `CreateShipmentModal.tsx` already handles this correctly once `doc_type` is returned accurately from the server.

---

## Fix 3 — AWB uploaded via New Shipment modal processed as BL

**Observed:** Uploading an AWB via the New Shipment modal shows sea freight fields (Origin Port, Destination Port, terminal selector, ETD). Should detect AWB and show air-specific fields.

**Fix:** Once Fix 2 is in place, `doc_type` will correctly return `"AWB"`. The frontend must branch on `doc_type` in `BLUploadTab.tsx`:

- `doc_type === "AWB"` — render AWB form: Origin Airport / Dest Airport (from airports list, port_type='AIR'), Flight Number, Flight Date, MAWB/HAWB numbers
- `doc_type === "BL"` or `"BOOKING_CONFIRMATION"` — render existing sea freight form

Add AWB fields to `BLFormState`:
```typescript
originIata: string;
destIata: string;
flightNumber: string;
flightDate: string;
mawbNumber: string;
hawbNumber: string;
awbType: string; // DIRECT | HOUSE | MASTER
pieces: string;
chargeableWeightKg: string;
```

When Confirm & Create is clicked for an AWB, set `order_type: 'AIR'` in the create payload.

---

## Fix 4 — Address text sanitisation

**Observed:** Parsed addresses have broken line breaks, e.g. "GERMANY" split as "ERMANY" on new line.

**Fix:** Apply sanitisation when pre-filling any address field from parsed data:
```typescript
const sanitiseAddress = (raw: string | null): string => {
  if (!raw) return '';
  return raw
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};
```

Apply in both `BLUploadTab.tsx` and `DocumentParseModal.tsx`.

---

## Fix 5 — AWB result view in DocumentParseModal (existing shipment detail page)

**File:** `af-platform/src/components/shipments/DocumentParseModal.tsx`

Redesign AWB result view from a plain key-value table to match the BL parser UX — grouped editable sections.

### Sections
1. **Document header** (read-only) — "Air Waybill" full label, AWB type badge (DIRECT/HOUSE/MASTER), confidence pill
2. **Route & Dates** — Origin Airport / Dest Airport dropdowns (from airports list), Flight Number, Flight Date
3. **AWB Numbers** — MAWB Number (always shown), HAWB Number (only when `awb_type === 'HOUSE'`)
4. **Shipper** — Name, Address
5. **Consignee** — Name, Address
6. **Cargo** — Description, Pieces, Gross Weight (kg), Chargeable Weight (kg)

### Design rules (match BL tab)
- Pre-filled fields: `bg-[#f0f7ff] border-[#93c5fd] font-medium`
- Section labels: `text-xs font-semibold text-[var(--text-mid)] mb-2`
- Field labels: `text-xs font-medium text-[var(--text-mid)] mb-1`
- Input base: `w-full px-3 py-2 text-sm border rounded-lg`
- All fields editable

Add `AWBFormState` interface. `Use This Data` passes `awbFormState` values (not raw parsed data) to `applyAWBAction`.

---

## Fix 6 — "Not this company" — company ownership assignment

**Observed:** When a company match is suggested and user clicks "Not this company", there is no fallback to assign company ownership. Companies can own a shipment even if they are not the shipper or consignee on the document.

**Fix:** When "Not this company" is clicked, show a company search/select widget so the user can:
1. Search and assign a different company as the shipment owner
2. Or proceed with no company assigned (leave blank, assign later)

Apply in both `BLUploadTab.tsx` and `DocumentParseModal.tsx`.

The company owner field maps to `company_id` on the shipment — separate from `parties.consignee.company_id`. Label clearly in the UI as "Customer / Shipment Owner", not "Consignee".

---

## API contract — specific checks for this prompt

- `parseBLAction` in `shipments-write.ts` must pass `doc_type` through from server response — confirm not stripped
- `ParseBLResult` interface must include `doc_type?: string`
- `AWBFormState` fields must all be covered by `applyAWBAction` payload
- AWB create flow must send `order_type: 'AIR'`

---

## Standing instruction — API contract alignment

**For every change implemented in this prompt (and all future prompts), Opus must verify and update the full API contract across all three layers:**

1. **Backend response** (`af-server`) — does the endpoint return the new/changed field?
2. **Server action** (`af-platform/src/app/actions/`) — does the action correctly pass or forward the field?
3. **Frontend type/interface** (`af-platform/src/lib/types.ts` or local interface) — is the TypeScript type updated to include the field?

If any layer is out of sync with the others, fix it as part of the same change. Do not leave mismatches between what the server sends and what the frontend expects.

This has caused repeated bugs where frontend logic relied on fields that were never returned by the backend. Treat API contract consistency as a hard requirement, not an afterthought.
