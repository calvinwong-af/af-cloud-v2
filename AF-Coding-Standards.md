# AcceleFreight — Coding Standards & Common Pitfalls

**Read this file before starting any server or platform work.**
This document captures recurring implementation mistakes observed across sessions. Following these standards avoids repeated debugging cycles.

---

## 1. FastAPI — Tab / Enum Parameter Validation

**Rule:** Any endpoint that accepts a `tab` or similar string parameter with a fixed set of allowed values MUST declare it as a `Literal` type or `Enum`. Every valid value must be explicitly listed.

**Verify before finishing:** Open the endpoint and confirm every tab value used by the platform (`all`, `active`, `draft`, `completed`, `to_invoice`, `cancelled`) is present in the allowed values list. Missing values cause silent fallthrough — FastAPI may reject or default the parameter without raising an error.

**Wrong:**
```python
async def list_shipments(tab: str = "active"):
    if tab == "active":
        ...
    elif tab == "completed":
        ...
    # to_invoice silently falls through — returns empty
```

**Correct:**
```python
from typing import Literal

async def list_shipments(
    tab: Literal["all", "active", "draft", "completed", "to_invoice", "cancelled"] = "active"
):
    ...
```

**Never return empty silently** for an unrecognised tab value. If a tab value is unhandled, raise HTTP 400:
```python
raise HTTPException(status_code=400, detail=f"Unrecognised tab value: {tab}")
```

---

## 2. V1 Data — Source of Truth Rules

**Rule:** V1 records have data split across multiple Datastore Kinds. Always read from the correct Kind for each field.

| Field | Correct Source | Never Use |
|---|---|---|
| Operational status | `ShipmentOrder.status` | `Quotation.status` |
| `issued_invoice` | `ShipmentOrder.issued_invoice` | `Quotation.issued_invoice` |
| Route (origin/dest ports) | `ShipmentOrder.origin_port_un_code` / `destination_port_un_code` | Quotation freight sub-kinds |
| Incoterm | `Quotation.incoterm_code` | ShipmentOrder |
| Company | `ShipmentOrder.company_id` | — |

**V1 status mapping (ShipmentOrder.status → V2 status code, v2.18):**
| V1 | V2 |
|---|---|
| `100` | `2001` Confirmed |
| `110` | `3002` Booking Confirmed |
| `4110` | `4001` Departed |
| `10000` | `5001` Completed |
| anything >= 110 and < 10000 (not 4110) | `3002` Booking Confirmed |

**Reverse mapping (V2 → V1) for status writes:**
| V2 | V1 |
|---|---|
| `2001` | `100` |
| `3002` | `110` |
| `4001` | `4110` |
| `5001` | `10000` |
| `-1` | `-1` |

---

## 3. V1 Data — Field Type Coercion

**Rule:** V1 records have inconsistently typed fields. Always coerce before comparison.

| Field | Issue | Fix |
|---|---|---|
| `issued_invoice` | Stored as `bool`, `int` (0/1), or missing | `bool(record.get("issued_invoice", False))` |
| `has_shipment` | May be missing entirely | `record.get("has_shipment", False) == True` |
| `tax_charge` / `duty_charge` on `PortShipmentTasks` | Mixed int/float/string | `parseFloat()` (JS) / `float()` (Python) |
| `account_type` on `UserIAM` | May be missing for pre-V2 users | Always provide default |

---

## 4. Datastore — Filter Syntax

**Rule:** Always use the `PropertyFilter` keyword argument form. Positional argument form is deprecated and generates warnings.

**Wrong:**
```python
query.add_filter("status", "=", 10000)
query.add_filter("trash", "=", False)
```

**Correct:**
```python
from google.cloud.datastore.query import PropertyFilter

query.add_filter(filter=PropertyFilter("status", "=", 10000))
query.add_filter(filter=PropertyFilter("trash", "=", False))
```

---

## 5. Datastore — Batch Fetching

**Rule:** When joining across Kinds (e.g. fetching `Quotation` records to enrich `ShipmentOrder` results), always batch-fetch by entity Key objects — never by string IDs in a loop.

**Wrong (N+1):**
```python
for record in shipment_orders:
    quotation = client.get(client.key("Quotation", record["quotation_id"]))
```

**Correct (batch):**
```python
keys = [client.key("Quotation", r["quotation_id"]) for r in shipment_orders]
quotations = get_multi_chunked(client, keys)
quotation_map = {q.key.name: q for q in quotations if q}
```

---

## 6. Datastore — Batch Fetch Key Limit

**Rule:** Datastore `get_multi` has a hard limit of 1000 keys per call. Always use `get_multi_chunked` from `core/datastore.py` instead of `client.get_multi` directly when the key list may exceed 1000 items.

```python
from core.datastore import get_multi_chunked

# Wrong — crashes with >1000 keys
entities = client.get_multi(keys)

# Correct — fetches in 500-key chunks
entities = get_multi_chunked(client, keys)
```

The helper excludes `None` values (missing keys) automatically.

---

## 7. Timestamps — Parsing and Writing

**Rule:** Timestamps in Datastore come in multiple formats depending on whether they were written by V1 or V2. Never use a hardcoded `strptime` format. Always use the robust `parse_timestamp` utility.

**V1 format:** `'2024-03-15 10:22:05'` — no timezone, no microseconds
**V2 format:** `'2026-02-27T05:02:31.499440+00:00'` — ISO 8601 with timezone and microseconds

**Server side — add to `af-server/core/datastore.py`:**
```python
from datetime import datetime, timezone

def parse_timestamp(value) -> datetime | None:
    """Parse timestamp strings in any format stored in Datastore."""
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        pass
    try:
        return datetime.strptime(str(value), '%Y-%m-%d %H:%M:%S')
    except ValueError:
        pass
    try:
        return datetime.strptime(str(value), '%Y-%m-%d %H:%M:%S.%f')
    except ValueError:
        pass
    return None
```

**Never use:** `datetime.strptime(value, '%Y-%m-%d %H:%M:%S')` directly — crashes on V2 timestamps.

**Writing timestamps:** Always use timezone-aware UTC:
```python
from datetime import datetime, timezone
datetime.now(timezone.utc).isoformat()
```

**Platform side (TypeScript):** Use `new Date(value)` which handles ISO 8601 natively:
```typescript
function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}
```

**Never use** manual format parsing or `split`/`replace` hacks on timestamp strings in TypeScript.

---

## 8. Status Writes — Atomicity Rule

**Rule:** Status changes and `status_history` appends must happen in the same request handler on the server. Never split them across client and server.

The correct flow in `af-server/routers/shipments.py`:
1. Read current status from correct Kind (V1: `ShipmentOrder`, V2: `Quotation`)
2. Validate transition is allowed
3. Write new status to correct Kind
4. Read `ShipmentWorkFlow` for this shipment ID
5. Append to `status_history` array
6. Write `ShipmentWorkFlow` back
7. Return success

If step 3 fails, do not execute steps 4–6.

**Never** handle `status_history` in `af-platform/src/lib/shipments-write.ts` — that belongs on the server only.

---

## 9. Status Code Mapping — UI (Platform)

**Rule:** Status code → UI label/icon mapping must be explicit and exhaustive. Never derive from array index or step position.

```typescript
const STATUS_MAP: Record<number, { label: string; icon: string }> = {
  1001: { label: 'Draft',              icon: 'draft' },
  1002: { label: 'Pending Review',     icon: 'draft' },
  2001: { label: 'Confirmed',          icon: 'confirmed' },
  3001: { label: 'Booking Pending',    icon: 'booking' },
  3002: { label: 'Booking Confirmed',  icon: 'booked' },
  4001: { label: 'Departed',           icon: 'departed' },
  4002: { label: 'Arrived',            icon: 'arrived' },
  5001: { label: 'Completed',          icon: 'completed' },
  [-1]: { label: 'Cancelled',          icon: 'cancelled' },
}
```

**Node grouping** — first digit defines the node: 1xxx Pre-op, 2xxx Confirmed, 3xxx Booking, 4xxx In Transit, 5xxx Completed. Use `status // 1000` (Python) or `Math.floor(status / 1000)` (TS) to determine which node is active.

**Exception is now a flag**, not a status code. The `exception` field on the shipment contains `{ flagged, raised_at, raised_by, notes }`.

If a status code is not in the map, log a warning — never silently render a default/wrong icon.

---

## 10. Platform State Management — List Pages

**Rule:** When switching tabs on a list page, the list state must only be cleared **once** when the tab value changes — not on every render or on every effect re-run.

Common mistake: a `useEffect` with the tab in its dependency array both clears the list AND fetches. If anything causes a re-render mid-fetch, the clear runs again and wipes the results.

**Correct pattern:**
```typescript
useEffect(() => {
  setShipments([])       // clear only on tab change
  setLoading(true)
  fetchList(currentTab).then(result => {
    setShipments(result.shipments)
    setLoading(false)
  })
}, [currentTab])         // only re-runs when tab actually changes
```

When debugging a list that "flashes and disappears", add a stack trace log to every `setShipments([])` call to find the culprit:
```typescript
console.log('[DEBUG] list cleared at:', new Error().stack)
```

---

## 11. Auth — ADC Expiry (Local Dev)

**Rule:** `af-platform` uses Application Default Credentials (ADC) to access Datastore directly for operations not yet moved to `af-server`. These expire periodically.

**Symptom:** `invalid_grant` / `invalid_rapt` error in the Next.js console.

**Fix:**
```powershell
gcloud auth application-default login
```
Then restart the `af-platform` dev server. This is a local dev issue only — Cloud Run uses the service account automatically.

**Long-term:** Once all Datastore reads/writes move through `af-server`, `af-platform` will no longer need ADC and this error class disappears.

---

## 12. Server Actions — Null Safety & Error Handling

**Rule:** Every Next.js Server Action call in a client component MUST be wrapped in try/catch and must guard against the result being `undefined` or `null`.

**Why:** When a Server Action throws an unhandled exception, Next.js returns `undefined` to the client. The minified error `Cannot read properties of undefined (reading 'payload')` in `core.js` is the symptom. This crashes the entire page.

**Server Action side (in `app/actions/*.ts`):**
- Every action must have a top-level try/catch that returns a structured `{ success: false, error: string }` on any failure
- Never let an exception propagate out of a Server Action — Next.js converts unhandled throws to `undefined`
- Guard `process.env.AF_SERVER_URL` — if missing, return error instead of crashing `new URL()`
- Every code path must return a structured result object — never `undefined`, `null`, or a bare `throw`

**Wrong:**
```typescript
export async function myAction(): Promise<Result> {
  const session = await verifySessionAndRole([...]);
  // If verifySessionAndRole throws → action returns undefined → client crashes
  const res = await fetch(url); // If url is undefined → throws → undefined
  return { success: true, data: await res.json() };
}
```

**Correct:**
```typescript
export async function myAction(): Promise<Result> {
  try {
    const session = await verifySessionAndRole([...]);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) return { success: false, error: 'Server URL not configured' };

    const res = await fetch(url);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: json?.detail ?? `Server responded ${res.status}` };
    }
    return { success: true, data: await res.json() };
  } catch (err) {
    console.error('[myAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Operation failed' };
  }
}
```

**Client component side:**
- Always wrap `await someAction()` in try/catch
- Always check `if (!result)` before reading any property on the result
- Show a user-friendly error message — never let the page crash

**Wrong:**
```typescript
const result = await fetchTasksAction(id);
if (result.success) { ... } // Crashes if result is undefined
```

**Correct:**
```typescript
try {
  const result = await fetchTasksAction(id);
  if (!result) { setError('No response'); return; }
  if (result.success) { setData(result.data ?? []); }
  else { setError(result.error ?? 'Unknown error'); }
} catch (err) {
  setError('Failed to load data');
}
```

---

## 13. Verification Checklist (Required at End of Every Task)

Before marking any task complete, confirm the following by checking the actual written code:

- [ ] All FastAPI tab/enum parameters include every value the platform sends
- [ ] No unhandled tab/enum values return empty silently — all fallthrough raises HTTP 400
- [ ] V1 status reads from `ShipmentOrder.status`, never `Quotation.status`
- [ ] `issued_invoice` coerced with `bool()` before any comparison
- [ ] All Datastore filters use `PropertyFilter` keyword form
- [ ] `get_multi_chunked` used instead of `client.get_multi` for all batch fetches
- [ ] Timestamps parsed with `parse_timestamp()` (server) or `new Date()` (platform) — no hardcoded strptime formats
- [ ] Timestamps written with `datetime.now(timezone.utc).isoformat()`
- [ ] Batch-fetch used for cross-Kind joins — no N+1 loops
- [ ] Status writes and `status_history` appends in the same server handler
- [ ] Status code → UI mapping is explicit and covers all 9 codes (1001, 1002, 2001, 3001, 3002, 4001, 4002, 5001, -1)
- [ ] List page state cleared only on tab change, not on re-render
- [ ] New endpoints added to the correct router and registered in `main.py` if required
- [ ] Server Actions wrapped in try/catch — every path returns structured result, never throws
- [ ] Client calls to Server Actions guarded with `if (!result)` null check and outer try/catch
- [ ] **No unused imports/variables** — run `npm run lint` in `af-platform/` before committing platform changes

---

## 14. Pre-Push — Lint Check (Platform)

**Rule:** Before committing any `af-platform` changes, run `npm run lint` (or `npm run build`) locally to catch ESLint errors. Cloud Build runs `next build` which fails on `@typescript-eslint/no-unused-vars` errors that the dev server silently ignores.

**Common cause:** Refactoring or deleting code leaves behind unused imports or constants. The dev server (`npm run dev`) does NOT surface these as errors — only `next build` does.

**Minimum check:**
```bash
cd af-platform && npm run lint
```

If lint passes locally, Cloud Build will not fail on ESLint errors.

---

*Last updated: 28 Feb 2026 — v2.18 session*
