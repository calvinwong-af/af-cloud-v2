# PROMPT-CURRENT — v3.15
# Combobox Fix Sweep + BLUpdateModal Removal

## Objective
Three things in one pass:
1. Fix `PortCombobox` in `BCReview.tsx` — same `onBlur` fix applied to BLReview in v3.12
2. Fix `Combobox` in `StepRoute.tsx` — same outside-click bug, keep keyboard nav intact
3. Remove `BLUpdateModal.tsx` entirely and clean up all references

---

## Root Cause (Combobox bug — applies to both BCReview + StepRoute)

Both components use `useRef` + `document.addEventListener('mousedown')` to detect
outside clicks. The `mousedown` on `document` fires before the option's `onMouseDown`,
closing the dropdown without registering the selection.

Fix: replace with `onBlur` + `setTimeout(150)` on the input. The 150ms delay lets the
option's `onMouseDown` fire before the blur closes the dropdown.

---

## Change 1 — BCReview.tsx: Fix PortCombobox

**File:** `af-platform/src/components/shipments/_doc-parsers/BCReview.tsx`

Replace the entire `PortCombobox` function. Remove `useRef`, `useEffect`, and
`document.addEventListener`. Replace with `onBlur` + `setTimeout(150)`:

```tsx
function PortCombobox({
  value, onChange, options, placeholder, className,
}: {
  value: string;
  onChange: (code: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selectedLabel = options.find(o => o.value === value)?.label ?? '';
  const displayText = open ? query : selectedLabel;
  const filtered = open
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        o.value.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 30)
    : [];

  return (
    <div className="relative">
      <input
        type="text"
        value={displayText}
        placeholder={placeholder ?? 'Search...'}
        className={className}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={e => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => { setOpen(false); setQuery(''); }, 150)}
        onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setQuery(''); } }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-[var(--border)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(o => (
            <button
              key={o.value}
              type="button"
              onMouseDown={e => { e.preventDefault(); onChange(o.value); setOpen(false); setQuery(''); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--sky-mist)] ${o.value === value ? 'bg-[var(--sky-mist)] font-medium' : ''}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

Remove `useRef` from the import line. Remove `useEffect` from the import line.

Also batch the POL and POD `onChange` handlers into single `setFormState` calls
to prevent stale closure on terminal clear:

```tsx
// POL onChange — replace:
onChange={code => {
  const newPort = seaPorts.find(p => p.un_code === code);
  update('pol_code', code);
  if (!newPort?.has_terminals) update('pol_terminal', '');
}}
// With:
onChange={code => {
  setFormState({ ...formState, pol_code: code, pol_terminal: '' });
}}

// POD onChange — replace:
onChange={code => {
  const newPort = seaPorts.find(p => p.un_code === code);
  update('pod_code', code);
  if (!newPort?.has_terminals) update('pod_terminal', '');
}}
// With:
onChange={code => {
  setFormState({ ...formState, pod_code: code, pod_terminal: '' });
}}
```

---

## Change 2 — StepRoute.tsx: Fix Combobox outside-click handler

**File:** `af-platform/src/components/shipments/_create-shipment/StepRoute.tsx`

The `Combobox` component has keyboard nav (arrow keys, Enter, Escape) — keep all of
that intact. Only replace the outside-click mechanism.

In the `Combobox` function:
- Remove the `useEffect` that adds `document.addEventListener('mousedown', handle)`
- Remove the `ref` and `ref={ref}` on the wrapper `<div>`
- Add `onBlur` to the `<input>` that defers closing:

```tsx
onBlur={() => setTimeout(() => { setOpen(false); setHighlighted(-1); }, 150)}
```

The `onMouseDown` on each list item already has `e.preventDefault()` which prevents
the input from losing focus before the selection fires — this is correct, keep it.

Remove `useRef` from the import if `ref` / `wrapperRef` are the only uses. Keep
`listRef` (used for scroll-into-view on keyboard highlight) — only remove `wrapperRef`.

Do NOT change the keyboard nav logic (ArrowDown, ArrowUp, Enter, Escape, Tab handlers).
Do NOT change the `useEffect` that syncs `query` when `value` changes — keep that.
Do NOT change the `useEffect` that scrolls highlighted item into view — keep that.

---

## Change 3 — Delete BLUpdateModal + clean up references

### 3a. Delete the file
`af-platform/src/components/shipments/BLUpdateModal.tsx` — delete entirely.

### 3b. Clean up `_doc-handler.ts`
**File:** `af-platform/src/app/(platform)/shipments/[id]/_doc-handler.ts`

- Remove: `import type { ParsedBL } from '@/components/shipments/BLUpdateModal';`
- Remove `setDocParseBLData`, `setShowBLModal`, `setPendingBLFile` from the `params`
  type and destructure — they are no longer used
- The BL branch already applies directly via `updateShipmentFromBLAction` — no logic
  changes needed, just the type cleanup

### 3c. Clean up `page.tsx`
**File:** `af-platform/src/app/(platform)/shipments/[id]/page.tsx`

Remove:
- `import BLUpdateModal from '@/components/shipments/BLUpdateModal';`
- `import type { ParsedBL } from '@/components/shipments/BLUpdateModal';`
- State declarations: `showBLModal`, `docParseBLData`, `pendingBLFile`
- The `setShowBLModal`, `setDocParseBLData`, `setPendingBLFile` props passed into
  `createDocResultHandler`
- The entire `{/* BL Update modal */}` render block at the bottom
- The `uploadShipmentFileAction` import IF it is only used inside the now-removed
  BLUpdateModal `onSuccess` block — check before removing

---

## Key Constraints

- Do NOT change `BLReview.tsx` — already fixed in v3.12
- Do NOT change `DocumentParseModal.tsx` or any backend files
- Do NOT change `BLUploadTab.tsx` — unrelated to this prompt
- `StepRoute.tsx`: keep keyboard nav, keep both `useEffect` hooks, only remove
  `wrapperRef` and the outside-click `useEffect`
- Python venv: `.venv` (Python 3.11) — no backend changes
- Run `npm run build` or `tsc --noEmit` after changes to confirm no type errors

---

## Files to Modify / Delete

1. `af-platform/src/components/shipments/_doc-parsers/BCReview.tsx` — fix PortCombobox
2. `af-platform/src/components/shipments/_create-shipment/StepRoute.tsx` — fix Combobox
3. `af-platform/src/components/shipments/BLUpdateModal.tsx` — DELETE
4. `af-platform/src/app/(platform)/shipments/[id]/_doc-handler.ts` — remove ParsedBL import + stale params
5. `af-platform/src/app/(platform)/shipments/[id]/page.tsx` — remove dead state + import + modal block

---

## Test Criteria

1. **BCReview port combobox** — upload a BC, click POL, type to filter, select a port — updates correctly; select MYPKG — terminal selector appears; switch to non-terminal port — terminal clears
2. **StepRoute port combobox** — open Create Shipment, go to Route step, click Origin Port, type to filter, click option — updates correctly; keyboard arrow nav still works
3. **BLUpdateModal removed** — `npm run build` passes with no missing import errors; no reference to BLUpdateModal remains in the codebase
4. **Upload Document flow** — upload a BL via the Upload Document button, apply — shipment updates correctly (BLUpdateModal was not in this path anyway)
5. No regression on BLReview combobox or any other combobox

---

# ARCHIVED — v3.13
# Fix GCS Signed URL on Cloud Run (files.py)

## Problem

The `/api/v2/shipments/{shipment_id}/files/{file_id}/download` endpoint fails in
production (Cloud Run) with a 500 error. The frontend displays "Failed to get file URL"
because no `detail` is returned.

Root cause: `blob.generate_signed_url()` requires a service account private key. On
Cloud Run the default credential is a Compute Engine metadata token — no private key
is available locally — so the call throws an exception at runtime.

This breaks:
- File download (clicking filename or download button)
- "Read file again" (reparse) for BL, AWB, BC documents

---

## Fix — files.py only

**File:** `af-server/routers/shipments/files.py`

Replace the signed URL generation block in `download_shipment_file` with the
IAM-based signing approach, which works on Cloud Run without a private key.

### Current code (to replace)

```python
from google.cloud import storage as gcs_storage
from datetime import timedelta
gcs_client = gcs_storage.Client(project="cloud-accele-freight")
bucket = gcs_client.bucket(FILES_BUCKET_NAME)
blob = bucket.blob(file_location)

signed_url = blob.generate_signed_url(
    version="v4",
    expiration=timedelta(minutes=15),
    method="GET",
)

return {"download_url": signed_url}
```

### Replacement code

```python
import google.auth
import google.auth.transport.requests
from google.cloud import storage as gcs_storage
from datetime import timedelta

# Obtain application default credentials (works on Cloud Run via metadata server)
credentials, project = google.auth.default(
    scopes=["https://www.googleapis.com/auth/cloud-platform"]
)
auth_request = google.auth.transport.requests.Request()
credentials.refresh(auth_request)

gcs_client = gcs_storage.Client(project="cloud-accele-freight", credentials=credentials)
bucket = gcs_client.bucket(FILES_BUCKET_NAME)
blob = bucket.blob(file_location)

signed_url = blob.generate_signed_url(
    version="v4",
    expiration=timedelta(minutes=15),
    method="GET",
    service_account_email=credentials.service_account_email,
    access_token=credentials.token,
)

return {"download_url": signed_url}
```

---

## Key Constraints

- Modify **only** `download_shipment_file` in `files.py` — no other functions
- Do NOT change `_helpers.py`, `__init__.py`, or any other file
- The `google-auth` and `google-cloud-storage` packages are already installed — no
  new dependencies needed
- Keep all existing auth checks, NotFoundError guards, and visibility logic intact
- Python venv: `.venv` (Python 3.11)

---

## Files to Modify

1. `af-server/routers/shipments/files.py` — `download_shipment_file` function only

---

## Test Criteria

After this change:
1. Local dev: clicking a file name or download button opens the file in a new tab
2. Production (Cloud Run): same — no "Failed to get file URL" error
3. "Read file again" (reparse) on a BL/AWB/BC file opens DocumentParseModal successfully
4. No regression on file upload, tag edit, visibility toggle, or delete
