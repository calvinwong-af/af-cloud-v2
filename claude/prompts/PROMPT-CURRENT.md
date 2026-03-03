# PROMPT-CURRENT — v3.11
# BL Reparse Port Resolution — UI-15 + UI-16

## Objective
Two related fixes to make the "Read File" reparse flow for BL documents resolve ports correctly
and allow the user to apply the data without being blocked by missing port codes.

---

## Background

The `reparseDocumentFileAction` in `shipments-files.ts` handles "Read File" on the Files tab.
For BL documents it calls the `/api/v2/shipments/parse-bl` endpoint, which returns:
```json
{ "parsed": { ...fields... }, "origin_un_code": "MYPKG", "destination_un_code": "MYBKI" }
```

However, `reparseDocumentFileAction` currently returns `{ success: true, docType: 'BL', data: parseJson }`
where `parseJson` is the raw response — it does NOT unwrap `parsed` or inject `pol_code`/`pod_code`
into the data object.

This means `reparseInitialData.data` in `ShipmentFilesTab` is the raw `/parse-bl` response wrapper,
not the flat parsed fields that `BLReview` and `DocumentParseModal` expect.

In `DocumentParseModal`, the `useEffect` for BL reparse attempts to unwrap:
```tsx
if (data.parsed && typeof data.parsed === 'object' && !Array.isArray(data.parsed)) {
  setParsedData(data.parsed as Record<string, unknown>);
}
```
This correctly unwraps the `parsed` object — but `pol_code`/`pod_code` are still missing because
they live on the outer response (`origin_un_code`/`destination_un_code`), not inside `parsed`.

Additionally, the `onResult` BL handler in `ShipmentFilesTab` builds FormData manually using
`blData.port_of_loading` → `bl_port_of_loading` / `blData.port_of_discharge` → `bl_port_of_discharge`
(raw string fields). These are different from `pol_code`/`pod_code` which the apply validation
guard requires before allowing submission.

---

## Fix 1 — Inject pol_code/pod_code in reparseDocumentFileAction (UI-16)

**File:** `af-platform/src/app/actions/shipments-files.ts`

In `reparseDocumentFileAction`, in the BL branch, after receiving `parseJson` from `/parse-bl`,
apply the same injection logic that `parseBLDocumentAction` already uses:

Current code:
```typescript
const parseJson = await parseRes.json();
return { success: true, docType: 'BL', data: parseJson };
```

Replace with:
```typescript
const parseJson = await parseRes.json();
// Inject resolved port codes into the parsed object — same pattern as parseBLDocumentAction
const parsed = (parseJson.parsed && typeof parseJson.parsed === 'object')
  ? { ...parseJson.parsed }
  : { ...parseJson };
if (parseJson.origin_un_code) parsed.pol_code = parseJson.origin_un_code;
if (parseJson.destination_un_code) parsed.pod_code = parseJson.destination_un_code;
// Return the flat parsed object (not the wrapper) so DocumentParseModal useEffect
// does not need to unwrap — parsedData will have pol_code/pod_code at the top level
return { success: true, docType: 'BL', data: parsed };
```

---

## Fix 2 — Send pol_code/pod_code from reparse onResult handler (UI-15)

**File:** `af-platform/src/components/shipments/ShipmentFilesTab.tsx`

In the `onResult` callback passed to the reparse `DocumentParseModal`, in the BL branch,
`blData` now has `pol_code` and `pod_code` (after Fix 1). Update the FormData builder to
send `pol_code`/`pod_code` instead of the raw port name strings:

Current code (remove these two lines):
```typescript
if (blData.port_of_loading) formData.append('bl_port_of_loading', String(blData.port_of_loading));
if (blData.port_of_discharge) formData.append('bl_port_of_discharge', String(blData.port_of_discharge));
```

Replace with:
```typescript
if (blData.pol_code) formData.append('pol_code', String(blData.pol_code));
if (blData.pod_code) formData.append('pod_code', String(blData.pod_code));
if (blData.pol_terminal) formData.append('origin_terminal', String(blData.pol_terminal));
if (blData.pod_terminal) formData.append('dest_terminal', String(blData.pod_terminal));
```

Also add the v3.10 fields that are missing from the reparse handler (for consistency with the
fresh upload `_doc-handler.ts` BL apply path). Add these alongside the existing fields:
```typescript
if (blData.cargo_description) formData.append('cargo_description', String(blData.cargo_description));
if (blData.total_weight_kg)   formData.append('total_weight_kg',   String(blData.total_weight_kg));
if (blData.lcl_container_number) formData.append('lcl_container_number', String(blData.lcl_container_number));
if (blData.lcl_seal_number)      formData.append('lcl_seal_number',      String(blData.lcl_seal_number));
```

---

## Fix 3 — Remove stale useEffect unwrap in DocumentParseModal (cleanup)

**File:** `af-platform/src/components/shipments/DocumentParseModal.tsx`

After Fix 1, `reparseDocumentFileAction` returns a flat parsed object with `pol_code`/`pod_code`
already injected. The `useEffect` that unwraps `data.parsed` is now redundant and should be
simplified to avoid double-processing:

Current:
```tsx
useEffect(() => {
  if ((initialDocType === 'BL' || initialDocType === 'BOOKING_CONFIRMATION') && initialParsedData) {
    const data = initialParsedData;
    if (data.parsed && typeof data.parsed === 'object' && !Array.isArray(data.parsed)) {
      setParsedData(data.parsed as Record<string, unknown>);
    } else {
      setParsedData(data);
    }
  }
}, [initialDocType]);
```

Replace with:
```tsx
useEffect(() => {
  if ((initialDocType === 'BL' || initialDocType === 'BOOKING_CONFIRMATION') && initialParsedData) {
    setParsedData(initialParsedData);
  }
}, [initialDocType]);
```

The unwrap logic is now handled upstream in `reparseDocumentFileAction` (Fix 1).
`initialParsedData` will always be a flat object with all keys at the top level.

---

## Key Constraints

- Do NOT change `parseBLDocumentAction` — it already injects `pol_code`/`pod_code` correctly
- Do NOT change `_doc-handler.ts` — the fresh upload BL apply path is working correctly
- Do NOT change `BLReview.tsx` — the combobox and port resolution UI is correct
- The reparse flow (`reparseDocumentFileAction` + `ShipmentFilesTab` `onResult`) must mirror
  the fresh upload flow (`parseBLDocumentAction` + `_doc-handler.ts`) in terms of data shape
  and FormData fields sent to `updateShipmentFromBLAction`
- Python venv: `.venv` (Python 3.11) — no backend changes needed for these fixes

---

## Files to Modify

1. `af-platform/src/app/actions/shipments-files.ts` — Fix 1 (inject pol_code/pod_code in reparse)
2. `af-platform/src/components/shipments/ShipmentFilesTab.tsx` — Fix 2 (send pol_code/pod_code in FormData)
3. `af-platform/src/components/shipments/DocumentParseModal.tsx` — Fix 3 (simplify useEffect)

---

## Test Criteria

After these changes, trigger "Read File" on an existing BL document:
1. BLReview opens with POL and POD pre-selected (MYPKG, MYBKI etc.) — no amber "not matched" warning
2. User can click "Use This Data" without being blocked by port validation error
3. Port codes are sent to the backend correctly (verify in network tab or server logs)
4. Terminal selector appears for MYPKG if that port has terminals
5. Reparse apply updates the shipment route card with correct ports
