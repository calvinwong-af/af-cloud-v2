# Prompt Completion Log — v3.13–v3.22

### [2026-03-04 20:00 UTC] — v3.15: Combobox Fix Sweep + BLUpdateModal Removal
- **Status:** Completed
- **Tasks:**
  - Fixed PortCombobox in BCReview.tsx: replaced useRef/useEffect outside-click with onBlur+setTimeout(150), batched POL/POD onChange to single setFormState calls
  - Fixed Combobox in StepRoute.tsx: removed wrapperRef and outside-click useEffect, added onBlur+setTimeout(150), kept keyboard nav intact
  - Deleted BLUpdateModal.tsx and cleaned up all references in page.tsx, _doc-handler.ts, and DocumentParseModal.tsx
- **Files Modified:**
  - `af-platform/src/components/shipments/_doc-parsers/BCReview.tsx`
  - `af-platform/src/components/shipments/_create-shipment/StepRoute.tsx`
  - `af-platform/src/components/shipments/BLUpdateModal.tsx` (deleted)
  - `af-platform/src/components/shipments/DocumentParseModal.tsx`
  - `af-platform/src/app/(platform)/shipments/[id]/_doc-handler.ts`
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx`

### [2026-03-04 19:30 UTC] — v3.14: Fix local signed URL signing (signBlob permission error)
- **Status:** Completed
- **Tasks:**
  - Fixed `iam.serviceAccounts.signBlob` permission error when generating signed URLs locally
  - Split signing path: local dev uses `service_account.Credentials` from key file (signs directly), Cloud Run uses IAM signBytes API via metadata-server credentials
  - Updated `/prompt` and `/prompt-push` skills to always update prompt log after processing
- **Files Modified:**
  - `af-server/routers/shipments/files.py`
  - `.claude/skills/prompt/skill.md`
  - `.claude/skills/prompt-push/SKILL.md`

### [2026-03-04 19:00 UTC] — v3.13: Fix GCS Signed URL on Cloud Run (files.py)
- **Status:** Completed
- **Tasks:**
  - Replaced bare `blob.generate_signed_url()` in `download_shipment_file` with IAM-based signing — uses `google.auth.default()` to obtain ADC credentials, refreshes them, then passes `service_account_email` + `access_token` to `generate_signed_url()` so it uses the IAM signBlob API instead of requiring a local private key
- **Files Modified:**
  - `af-server/routers/shipments/files.py`
