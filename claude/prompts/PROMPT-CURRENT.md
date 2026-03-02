# PROMPT-CURRENT — v2.82
**Date:** 03 March 2026
**Status:** READY — pass to Opus in VS Code

---

## Context

v2.81 is complete — 327 users migrated to PostgreSQL, `users` table live in
production, `_build_claims()` in af-server now reads from PostgreSQL.

This prompt fixes the production shipments list being empty (401 from af-server),
migrates `verifySessionAndRole` in af-platform away from Datastore entirely, and
cleans up all debugging code added during the investigation session. It also
fixes 7 existing bugs and adds DG feature work.

---

## Background — What Broke and Why

After v2.81 deployed, the shipments list showed empty in production. Investigation
revealed:

1. `GOOGLE_CLOUD_PROJECT_ID` was missing from `cloudbuild.yaml` — af-platform's
   Datastore client failed to initialise. **Workaround applied:** added env var
   to `cloudbuild.yaml`.

2. `AF_SERVER_URL` was pointing to `https://api.accelefreight.com` which caused
   an HTTP→HTTPS redirect that stripped the `Authorization` header. **Workaround
   applied:** changed to direct Cloud Run URL
   `https://af-server-667020632236.asia-northeast1.run.app`.

3. Root cause: `verifySessionAndRole` in `af-platform/src/lib/auth-server.ts`
   still reads `UserIAM` and `CompanyUserAccount` from Datastore. Now that
   af-server has a working `GET /users/me` endpoint (from v2.81), the platform
   should delegate auth to af-server entirely.

**This prompt resolves all three issues properly.**

---

## Priority 1 — Migrate `verifySessionAndRole` to PostgreSQL (via af-server)

### Current behaviour
`af-platform/src/lib/auth-server.ts` — `verifySessionAndRole()`:
1. Verifies Firebase ID token using Firebase Admin SDK (keep this)
2. Reads `UserIAM[uid]` from Datastore — **REPLACE**
3. Reads `CompanyUserAccount[uid]` from Datastore — **REPLACE**

### Target behaviour
After verifying the Firebase token, call `GET /api/v2/users/me` on af-server
(which already does the PostgreSQL lookup) to get role, account_type,
valid_access, and company_id.

```typescript
// After Firebase token verification:
const uid = decodedToken.uid;
const email = decodedToken.email ?? '';

const serverUrl = process.env.AF_SERVER_URL;
if (!serverUrl) return INVALID_SESSION;

const meRes = await fetch(`${serverUrl}/api/v2/users/me`, {
  headers: { Authorization: `Bearer ${idToken}` },
  cache: 'no-store',
});

if (!meRes.ok) return INVALID_SESSION;

const meJson = await meRes.json();
const user = meJson.data ?? meJson;  // handle both response shapes

const role = user.role as string ?? null;
const accountType = user.account_type as AccountType ?? 'AFU';
const validAccess = user.valid_access ?? false;

if (!validAccess) return INVALID_SESSION;
if (!allowedRoles.includes(role)) return INVALID_SESSION;

const companyId = (user.company_id as string | null) ?? null;
```

### Rules
- Keep the Firebase token verification step — it validates the token signature
- Remove all Datastore imports from `auth-server.ts`
- `getDatastore()` must no longer be called from `auth-server.ts`
- `logAction()` at the bottom of `auth-server.ts` still uses Datastore — leave
  it unchanged for now (separate migration)

---

## Priority 2 — Fix `cloudbuild.yaml` — restore `AF_SERVER_URL` to public domain

The workaround changed `AF_SERVER_URL` to the internal Cloud Run URL. Now that
`verifySessionAndRole` no longer hits Datastore (removing the need for
`GOOGLE_CLOUD_PROJECT_ID`), restore `AF_SERVER_URL` to the public domain and
clean up:

```yaml
- AF_SERVER_URL=https://api.accelefreight.com
```

Remove `GOOGLE_CLOUD_PROJECT_ID` from `--set-env-vars` in `cloudbuild.yaml`.
It is no longer needed by af-platform (Datastore is no longer called from
auth-server hot path).

**Note:** `GOOGLE_CLOUD_PROJECT_ID` may still be needed if `logAction()` is
called — leave it in for now as a safety net if `logAction` is still
active. Only remove it if `logAction` Datastore calls are also removed.
Actually — leave `GOOGLE_CLOUD_PROJECT_ID` in `cloudbuild.yaml` since
`logAction()` still writes to Datastore. Just fix `AF_SERVER_URL` back to
`https://api.accelefreight.com`.

---

## Priority 3 — Remove all debugging code added during investigation

The following temporary console logs and debugging additions must be removed:

### `af-platform/src/lib/auth-server.ts`
Remove all `console.log` / `console.error` lines added during debugging:
- `'[verifySessionAndRole] No af-session cookie found'`
- `'[verifySessionAndRole] Token verified for uid:'`
- `'[verifySessionAndRole] No UserIAM entity found for uid:'`
- `'[verifySessionAndRole] valid_access=false for uid:'`
- `'[verifySessionAndRole] role:'`
- `'[verifySessionAndRole] Role ... not in allowedRoles'`
- `'[verifySessionAndRole] SUCCESS — companyId:'`

Keep only the existing `console.error('[verifySessionAndRole] Auth error:', err)`
in the catch block.

### `af-platform/src/app/actions/shipments.ts`
Remove the two temporary debug logs added to `getShipmentListAction`:
- `console.log('[getShipmentListAction] calling:', url.toString())`
- `console.log('[getShipmentListAction] token present:', ...)`

---

## Bug Fixes

### Bug 1 — File size showing NaN KB in Files tab
Files tab shows `NaN KB` for uploaded file sizes.
Find where file size is rendered — likely dividing by 1024 on a null/undefined
value. Add a null guard: `size ? (size / 1024).toFixed(1) + ' KB' : 'Unknown'`.

### Bug 2 — Files tab badge not pre-populated on page load
The files count badge on the Files tab shows 0 until the tab is clicked.
The file count should be fetched/set when the shipment detail page loads,
not lazily on tab activation.

### Bug 3 — DP-48: AWB diff not shown on Parties card after BL parse apply
After applying a parsed BL document via DocumentParseModal, the Parties card
does not show the diff for AWB number changes.
Investigate the `applyParsedData` flow and ensure AWB/HAWB fields are included
in the diff computation.

### Bug 4 — Company/Shipment Owner renders twice in DocumentParseModal
The Company or Shipment Owner section appears duplicated in the
DocumentParseModal UI. Find and remove the duplicate render.

### Bug 5 — MYPKG_N still exists as standalone port row in `ports` table
`MYPKG_N` (Port Klang North Port) was meant to be represented only as a
terminal under `MYPKG`, not as its own port row. Run a one-time SQL migration:

```sql
DELETE FROM ports WHERE un_code = 'MYPKG_N';
```

Add this to a migration script or run directly. Also verify no shipment records
reference `MYPKG_N` as `origin_port` or `destination_port` — if they do,
update them to `MYPKG` with `terminal_id = 'MYPKG_N'`.

### Bug 6 — DG indicator missing in shipment detail Overview tab
The Overview tab should show a DG (Dangerous Goods) badge/indicator when
`cargo.is_dg` is true. Add a visible DG indicator to the Overview tab cargo
section.

### Bug 7 — DG edit toggle + description field in detail page
Add a DG edit capability to the shipment detail page:
- Toggle `is_dg` boolean on the cargo section
- Text field for `dg_description` when `is_dg` is true
- Saves via `PATCH /api/v2/shipments/{id}` with `{ cargo: { ...existing, is_dg, dg_description } }`

---

## DG Feature — List badge

The shipments list should show a DG badge in the TYPE column when
`cargo_is_dg` is true. The SQL query in `af-server/core/db_queries.py`
already selects `(s.cargo->>'is_dg')::boolean AS cargo_is_dg`. Verify this
is included in the response and ensure `ShipmentOrderTable.tsx` renders it
correctly.

The `cargo_is_dg` field was added to the SQL in a previous session but the
badge is not showing — investigate and fix.

---

## Files to Create / Modify

| File | Action |
|---|---|
| `af-platform/src/lib/auth-server.ts` | MODIFY — replace Datastore with af-server `/users/me` call, remove debug logs |
| `af-platform/src/app/actions/shipments.ts` | MODIFY — remove debug logs from `getShipmentListAction` |
| `af-platform/cloudbuild.yaml` | MODIFY — restore `AF_SERVER_URL=https://api.accelefreight.com` |
| `af-server/core/db_queries.py` | VERIFY — `cargo_is_dg` present in list query |
| `af-platform/src/components/shipments/ShipmentOrderTable.tsx` | MODIFY — DG badge in list |
| `af-platform/src/app/(platform)/shipments/[id]/page.tsx` | MODIFY — DG indicator + edit, files badge fix, AWB diff fix |
| `af-platform/src/components/shipments/DocumentParseModal.tsx` | MODIFY — remove duplicate Company render |

---

## Verification Steps

1. `npm run dev` — zero TypeScript errors
2. Log in to production — shipments list loads correctly with all shipments
3. Nav header shows correct user name
4. Files tab badge shows correct count on page load
5. DG shipment shows DG badge in list and indicator in detail
6. DocumentParseModal — no duplicate Company/Owner section
7. `af-platform/src/lib/auth-server.ts` — zero imports from `datastore` or `datastore-query`
8. Cloud Run logs — no `GOOGLE_CLOUD_PROJECT_ID` errors, no 401s on shipments list

---

## Notes

- `logAction()` in `auth-server.ts` still writes to Datastore — do not remove it
  in this prompt. It will be migrated in a dedicated logging migration (v2.83+).
- After this prompt, `auth-server.ts` will have zero Datastore calls in the
  hot path (`verifySessionAndRole`), only in the non-critical logging path.
- The Datastore dependency in af-platform is now limited to `logAction()` only.
