# PROMPT-CURRENT — v2.83 (Debug: Shipments List Empty)
**Date:** 03 March 2026
**Status:** READY — pass to Opus in VS Code

---

## Problem Statement

The shipments list shows "No shipment orders found" on both the `/shipments` page
and the `/dashboard` page, despite the stats cards correctly showing 18 active
shipments and 2,034 total. This has persisted through multiple deployments.

Stats work → af-server is up and PostgreSQL is accessible.
List returns 200 with empty payload → auth is silently failing inside the list action.

---

## What Has Been Tried

1. **v2.82** — Rewrote `verifySessionAndRole` in `af-platform/src/lib/auth-server.ts`
   to call `GET /api/v2/users/me` on af-server (PostgreSQL) instead of Datastore.
   Stats started working. List still empty.

2. **redirect_slashes fix** — `GET /` on the shipments router was causing a
   trailing-slash redirect that stripped the Authorization header.
   Fixed with `redirect_slashes=False` on both the sub-router and `main.py`.
   Server starts cleanly. List still empty.

3. **Network tab evidence** — `shipments` fetch returns HTTP 200 with ~0.1 KB
   (empty payload). This means the server action reaches af-server and gets a
   200, but af-server returns `{"shipments":[],"next_cursor":null,"total":0}`.

---

## Root Cause Hypothesis

`verifySessionAndRole` in `af-platform/src/lib/auth-server.ts` calls
`GET /api/v2/users/me` on af-server. If that call returns non-OK (403, 401, 404),
`verifySessionAndRole` returns `INVALID_SESSION` and `getShipmentListAction`
silently returns empty — **no error is logged to the browser console**.

The stats action (`fetchShipmentOrderStatsAction`) also calls `verifySessionAndRole`
with the same roles. **Stats work.** So `verifySessionAndRole` is passing for stats.

This means the issue is NOT in `verifySessionAndRole` itself.

**New hypothesis:** The `getShipmentListAction` call to af-server is succeeding
(200) but af-server's `list_shipments` query is returning 0 rows. Possible causes:

1. The `tab` parameter value is being received incorrectly by af-server
   (e.g. whitespace, encoding issue, or the query param is missing entirely).
2. The `list_shipments` SQL WHERE clause is filtering out all rows.
3. The `_tab_where` function in `db_queries.py` is not matching any statuses.

---

## Key Files

### af-platform (Next.js)
- `af-platform/src/lib/auth-server.ts` — `verifySessionAndRole`
- `af-platform/src/app/actions/shipments.ts` — `getShipmentListAction`,
  `fetchDashboardShipmentsAction`, `fetchShipmentOrderStatsAction`
- `af-platform/src/app/(platform)/shipments/page.tsx` — shipments list page

### af-server (FastAPI)
- `af-server/routers/shipments/core.py` — `list_shipments` endpoint, `GET /`
- `af-server/core/db_queries.py` — `list_shipments()`, `_tab_where()`
- `af-server/core/auth.py` — `require_auth`, `_build_claims`

---

## Requested Debugging Steps

### Step 1 — Add temporary logging to af-server list endpoint

In `af-server/routers/shipments/core.py`, add logging to `list_shipments`:

```python
@router.get("/")
async def list_shipments(...):
    logger.info(f"[list] tab='{tab}' company_id='{effective_company_id}' offset={offset} limit={limit}")
    logger.info(f"[list] claims uid='{claims.uid}' role='{claims.role}' account_type='{claims.account_type}'")
    # ... existing code ...
    logger.info(f"[list] total={total} items={len(items)}")
```

### Step 2 — Add temporary logging to af-platform action

In `af-platform/src/app/actions/shipments.ts`, add to `getShipmentListAction`:

```typescript
console.log('[getShipmentListAction] session valid:', session.valid, 'role:', session.role);
console.log('[getShipmentListAction] url:', url.toString());
console.log('[getShipmentListAction] res.status:', res.status);
console.log('[getShipmentListAction] json:', JSON.stringify(json));
```

### Step 3 — Verify tab parameter encoding

The URL built in `getShipmentListAction` is:
```typescript
const url = new URL('/api/v2/shipments', process.env.AF_SERVER_URL);
url.searchParams.set('tab', tab);
```

Verify the actual URL string being sent. `url.searchParams.set` should encode
correctly but confirm there is no trailing whitespace or encoding issue in `tab`.

### Step 4 — Check db_queries directly

Run a direct SQL check against the production database to verify data exists:
```sql
SELECT status, COUNT(*) FROM shipments WHERE trash = FALSE GROUP BY status ORDER BY status;
```

Active statuses are: 2001, 3001, 3002, 4001, 4002
This will confirm whether the data issue is in the DB or the application layer.

---

## Expected Outcome

After debugging, implement the actual fix (which is likely one of):
- A tab parameter encoding/transmission issue
- A WHERE clause mismatch between status values in DB vs `_tab_where()`
- A secondary auth issue specific to the list endpoint (different from stats)

Clean up all temporary logging after fix is confirmed working.

---

## Additional Context

- Stats endpoint (`/api/v2/shipments/stats`) works correctly → DB connection is fine
- `redirect_slashes=False` is now set on both the sub-router and `main.py` FastAPI app
- Production URL: `https://api.accelefreight.com`
- The `verifySessionAndRole` rewrite (v2.82) is confirmed working for other actions
- User shown in bottom-left as "User / AF Admin" — nav header auth is working
