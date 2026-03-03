# PROMPT-CURRENT — v2.92 (Files Tab Fixes + Diagnostic Log Cleanup)
**Date:** 03 March 2026
**Status:** READY — pass to Opus in VS Code

---

## Context

Three small cleanup and fix tasks following v2.90/v2.91 completion.
Two files tab improvements and one diagnostic log cleanup.

---

## Issue 1 — Uploader Shows "Unknown"

### Symptom
The file row meta line shows: `Unknown · 03 Mar 2026`
The uploader email should appear instead of "Unknown".

### Root Cause
`_file_row_to_dict` in `_helpers.py` returns raw DB columns. The DB stores
the uploader in `uploaded_by_email` and `uploaded_by_uid`, but the frontend
`ShipmentFile` type expects a field called `user`. The mapping is never made,
so `file.user` is `undefined` on the frontend.

### Fix — `af-server/routers/shipments/_helpers.py`
In `_file_row_to_dict`, after the existing `file_tags` handling block, add:

```python
d["user"] = d.get("uploaded_by_email") or d.get("uploaded_by_uid") or "Unknown"
```

---

## Issue 2 — "Read File Again" Only Shows for BL Files

### Symptom
The "Read file again" button only appears on files tagged `bl`.
It should also appear on files tagged `awb` and `bc`.

### Root Cause
In `ShipmentFilesTab.tsx`, the button condition hardcodes `bl`:
```tsx
{isAFU(userRole) && (file.file_tags ?? []).includes('bl') && (
```

### Fix — `af-platform/src/components/shipments/ShipmentFilesTab.tsx`
Add a module-level constant near the other tag constants at the top of the file:
```tsx
const PARSED_DOC_TAGS = new Set(['bl', 'awb', 'bc']);
```

Update the button condition to:
```tsx
{isAFU(userRole) && (file.file_tags ?? []).some(t => PARSED_DOC_TAGS.has(t)) && (
```

**Important:** Do NOT refactor `handleReparse` — it currently calls
`reparseBlFileAction` for all doc types. This is acceptable for now;
AWB/BC specific reparse flows are a future prompt.

---

## Issue 3 — Diagnostic Console Logs Cleanup

### Symptom
`console.info` diagnostic logs added during v2.90 debugging are still in
`_doc-handler.ts`. These were temporary and should be removed now that
file saving is confirmed working.

### Fix — `af-platform/src/app/(platform)/shipments/[id]/_doc-handler.ts`
Remove the two `console.info` diagnostic lines:
```ts
console.info('[DocumentParse] BC file save: name=%s size=%d type=%s', ...)
console.info('[DocumentParse] AWB file save: name=%s size=%d type=%s', ...)
```

Keep all `console.error` lines — these are genuinely useful for failure
diagnostics and should remain.

### Fix — `af-server/routers/shipments/doc_apply.py`
Update the module docstring at the top of the file. The comment currently
says the frontend calls `/save-document-file` after apply — this is outdated
since v2.90 switched to calling `/files` directly. Update to:

```python
"""
routers/shipments/doc_apply.py

Document apply endpoints: apply booking confirmation, apply AWB,
save document file.

File saving contract for document apply operations:
  - PATCH /bl                         → saves file inline (within the handler itself)
  - POST /apply-awb                   → frontend calls POST /files after success
  - POST /apply-booking-confirmation  → frontend calls POST /files after success

Note: /save-document-file endpoint is retained for compatibility but is no
longer called by the frontend as of v2.90.
"""
```

---

## Files to Modify

| File | Change |
|---|---|
| `af-server/routers/shipments/_helpers.py` | Add `user` field mapping in `_file_row_to_dict` |
| `af-platform/src/components/shipments/ShipmentFilesTab.tsx` | Expand "Read file again" tag condition |
| `af-platform/src/app/(platform)/shipments/[id]/_doc-handler.ts` | Remove `console.info` diagnostic logs |
| `af-server/routers/shipments/doc_apply.py` | Update module docstring only |

## Files to Read First

| File | Reason |
|---|---|
| `af-server/routers/shipments/_helpers.py` | Locate `_file_row_to_dict` before modifying |
| `af-platform/src/components/shipments/ShipmentFilesTab.tsx` | Locate button condition and tag constants |
| `af-platform/src/app/(platform)/shipments/[id]/_doc-handler.ts` | Locate the console.info lines to remove |

---

## Coding Standards Reminders
- Read files before modifying — do not assume current state
- `PARSED_DOC_TAGS` must be a module-level `const`, not inline
- Run `npm run lint` in `af-platform/` before committing
- No unused imports after edits

---

## Expected Outcome After v2.92
1. File rows show uploader email instead of "Unknown"
2. "Read file again" button visible on AWB and BC files as well as BL
3. No `console.info` diagnostic logs remaining in `_doc-handler.ts`
4. `doc_apply.py` docstring reflects current file saving contract
