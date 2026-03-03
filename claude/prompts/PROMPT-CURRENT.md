# PROMPT-CURRENT — v3.15
# BCReview Port Combobox Fix (same as v3.12 BLReview fix)

## Objective
Apply the same `PortCombobox` fix from `BLReview.tsx` (v3.12) to `BCReview.tsx`.
The combobox has the same two bugs: outside-click handler fires before option selection
registers, and the two `onChange` handlers use stale closure when clearing the terminal.

---

## Root Cause

Same as BLReview (v3.12):

**Bug 1 — Outside-click closes dropdown before selection registers:**
`PortCombobox` uses `useRef` + `document.addEventListener('mousedown')` to detect
outside clicks. The `mousedown` on `document` fires before the option button's
`onMouseDown`, closing the dropdown without registering the selection.

**Bug 2 — Stale closure on terminal clear:**
The POL and POD `onChange` handlers call `update()` twice in succession (port code +
terminal clear). `update` closes over `formState` from the render, so the second call
may use a stale snapshot.

---

## Fix — BCReview.tsx only

**File:** `af-platform/src/components/shipments/_doc-parsers/BCReview.tsx`

### Change 1 — Replace PortCombobox outside-click handler

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

Remove the `useRef` import (no longer needed). Keep `useState` and remove `useEffect`.

### Change 2 — Batch POL and POD onChange into single setFormState calls

Replace the POL `onChange`:
```tsx
onChange={code => {
  const newPort = seaPorts.find(p => p.un_code === code);
  update('pol_code', code);
  if (!newPort?.has_terminals) update('pol_terminal', '');
}}
```
With:
```tsx
onChange={code => {
  setFormState({ ...formState, pol_code: code, pol_terminal: '' });
}}
```

Replace the POD `onChange`:
```tsx
onChange={code => {
  const newPort = seaPorts.find(p => p.un_code === code);
  update('pod_code', code);
  if (!newPort?.has_terminals) update('pod_terminal', '');
}}
```
With:
```tsx
onChange={code => {
  setFormState({ ...formState, pod_code: code, pod_terminal: '' });
}}
```

Note: always clear terminal on port change (same as v3.12 BLReview) — the terminal
selector's conditional render handles visibility, no need to guard on `has_terminals`.

---

## Key Constraints

- Modify **only** `BCReview.tsx` — no other files
- Do NOT change `BLReview.tsx`, `DocumentParseModal.tsx`, or any backend files
- Keep all other BCReview logic intact — containers, cargo, dates, parties sections
  are unchanged
- Python venv: `.venv` (Python 3.11) — no backend changes

---

## Files to Modify

1. `af-platform/src/components/shipments/_doc-parsers/BCReview.tsx`

---

## Test Criteria

After this change:
1. Upload a Booking Confirmation via DocumentParseModal
2. In BCReview, click the POL combobox — dropdown opens
3. Type to filter — list narrows correctly
4. Click a port option — port updates, dropdown closes
5. Click POL again and select MYPKG — terminal selector appears below POL
6. Change POL to a non-terminal port — terminal selector disappears and terminal is cleared
7. Repeat steps 2–6 for POD
8. No regression on BLReview port combobox behaviour

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
