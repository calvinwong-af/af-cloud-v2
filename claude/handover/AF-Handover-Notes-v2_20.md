# AF Platform — Handover Notes v2.20
**Date:** 28 February 2026
**Session Focus:** User Module Fixes + Task Label / IGNORED Mode Fixes + Shell Layout Debug
**Prepared by:** Claude / Calvin
**Supersedes:** AF-Handover-Notes-v2_19.md

---

## Session Summary

Testing session on localhost. Three fixes applied via MCP. Two are confirmed working, two are unconfirmed due to a suspected dev server issue.

---

## Confirmed Working ✅

### Fix 3 — Edit button on IGNORED tasks
**File:** `af-platform/src/components/shipments/ShipmentTasks.tsx`

Removed `!isIgnored` guard from the edit pencil button condition. IGNORED tasks now show the edit button, allowing staff to reassign them back to ASSIGNED or TRACKED.

```tsx
// Before
{editable && task.status !== 'COMPLETED' && !isIgnored && (

// After
{editable && task.status !== 'COMPLETED' && (
```

### Fix 4 — Task timestamps only shown when status matches
**File:** `af-platform/src/components/shipments/ShipmentTasks.tsx`

`actual_start` now only renders when status is not PENDING. `actual_end` / Completed timestamp now only renders when status is exactly COMPLETED. Prevents stale Datastore date values from showing on PENDING tasks (was showing "Completed: 28 Feb 2026" on a PENDING task for AF-003866).

---

## Unconfirmed / Still Investigating ⚠️

### Fix 1 — User table column clipping
**Files touched:**
- `af-platform/src/components/shell/PlatformShell.tsx` — changed `overflow-hidden` → `min-w-0` on column flex div; added `overflow-x-auto` to `<main>`
- `af-platform/src/components/users/UserTable.tsx` — added `max-w-full` to table wrapper div
- `af-platform/src/app/(platform)/users/page.tsx` — added `min-w-0 w-full` to root div

All three changes are confirmed present in the repo files. However the table "C" (Created) column and Actions column are still clipping in the browser after `.next` cache clear and `npm run dev` restart.

**Diagnostic added:** Console log added to `PlatformShell.tsx` — check browser DevTools Elements tab and confirm `<main>` has `overflow-x-auto` class. If not, the dev server may not be picking up the file.

**Next step:** In DevTools → Elements, inspect the `<main>` tag. If `overflow-x-auto` is absent, the hot reload is broken for that file — try a full VS Code restart or check if there's a second Next.js process running on port 3000.

### Fix 2 — Stale task display_name override
**File:** `af-platform/src/components/shipments/ShipmentTasks.tsx`

Added `STALE_LABELS` set and updated `getTaskLabel` to fall back to the label map when `display_name` is a known stale value:

```tsx
const STALE_LABELS = new Set([
  'Origin Haulage', 'Destination Ground Transportation', 'Vessel Departure', 'Vessel Arrival',
]);

function getTaskLabel(task: WorkflowTask): string {
  const stored = task.display_name;
  console.log('[getTaskLabel]', task.task_type, 'stored:', stored, 'stale:', stored ? STALE_LABELS.has(stored) : false);
  if (stored && !STALE_LABELS.has(stored)) return stored;
  return TASK_LABELS[task.task_type] || task.task_type;
}
```

Code is confirmed in the file but "Destination Haulage / Delivery" still shows as "Destination Ground Transportation" in the browser.

**Diagnostic added:** `console.log` in `getTaskLabel` — open AF-003866 Tasks tab, check browser DevTools Console for `[getTaskLabel]` lines. This will confirm:
- Whether the new code is being executed at all
- What `stored` value Datastore is actually returning for the DESTINATION_HAULAGE task
- Whether `STALE_LABELS.has(stored)` is returning true

**Remove the console.log once fix is confirmed working.**

---

## Business Context Note

**AF-003866** (MUC → KUL, Air Freight, DAP Import) — AF is the appointed customs broker only. Scope:
- Leg 6 (Import Customs Clearance) — ASSIGNED to AF ✅
- Leg 7 (Destination Haulage / Delivery) — should be IGNORED (consignee arranges own delivery)

In Malaysia, licensed customs brokers must be formally appointed by the importer to act with JKDM. System handles this via task IGNORED/ASSIGNED mode — no model change needed.

---

## PROMPT-CURRENT.md Status

Empty / reset. No pending prompts for VS Code.

---

## Outstanding Work

### Queued (unblocked)
- Shipment detail — V1 parties cards
- Company detail — files tab
- Duplicate Shipment (needs server endpoint)
- Pricing Tables UI

### Deferred
- AWB parser (Air Waybill)
- Status stage redesign (superseded by task timing model)
- Geography module
- System Logs module
- CompanyUserAccount repair (Phase 3)
- Invoicing module redesign
- Phase 2 — Rekey AFCQ- → AF- (after all 22 active V1 orders close)

---

## Deployment

| Service | URL | Status |
|---|---|---|
| af-platform | https://appv2.accelefreight.com | ✅ Live |
| af-server | https://api.accelefreight.com | ✅ Live |
| af-cloud-auth-server | https://auth.accelefreight.com | ✅ Live |
| alfred.accelefreight.com | Old Vue TMS | ⚠️ To be decommissioned |

**Redeployment command** (run from `af-cloud-v2` root):
```powershell
gcloud builds submit --config af-platform/cloudbuild.yaml --substitutions "_FIREBASE_API_KEY=AIzaSyCWE9is9x8J5enCk4Pwx9AAF0gr7wjkNY4,_FIREBASE_AUTH_DOMAIN=cloud-accele-freight.firebaseapp.com,_FIREBASE_PROJECT_ID=cloud-accele-freight,_FIREBASE_STORAGE_BUCKET=cloud-accele-freight.firebasestorage.app,_FIREBASE_MESSAGING_SENDER_ID=667020632236,_FIREBASE_APP_ID=1:667020632236:web:2d9793159856965983ff09"
```

---

## Working Method

- **Claude AI (Sonnet 4.6)** — design, rationale, small MCP fixes, handover files
- **VS Code (Opus 4.6)** — complex code via Claude Code plugin
- **Prompt files** — `PROMPT-CURRENT.md` in repo root (+ numbered variants)
- **Handover files** — written to repo root only when prompted
