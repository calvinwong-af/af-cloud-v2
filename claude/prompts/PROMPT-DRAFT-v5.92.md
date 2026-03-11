# PROMPT-DRAFT — v5.92: Geo-matching — Nearest Area Auto-Suggestion

## Context

This prompt adds automatic area suggestion when a user enters a delivery address in
`AddressInput`. After Google Places resolves an address to lat/lng, the frontend calls
a new backend endpoint that returns the nearest areas by Haversine distance. The user
sees the top suggestion pre-selected in the zone selector, which they can confirm or
override.

This prompt depends on v5.91 being completed first.

**Three parts:**
1. DB migration — add `lat`/`lng` to `areas` table
2. Backend — batch geocode script to populate coordinates + nearest-area endpoint
3. Frontend — auto-suggest area after address resolves in `AddressInput`

---

## Task A — Migration 035: Add lat/lng to areas

Create `af-server/migrations/035_areas_lat_lng.sql`:

```sql
-- Migration 035: Add lat/lng columns to areas for geo-matching
ALTER TABLE areas
    ADD COLUMN IF NOT EXISTS lat NUMERIC(10, 7) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS lng NUMERIC(10, 7) DEFAULT NULL;

-- Index for spatial queries (optional but useful for large area sets)
CREATE INDEX IF NOT EXISTS idx_areas_lat_lng ON areas (lat, lng)
    WHERE lat IS NOT NULL AND lng IS NOT NULL;
```

**Do NOT apply this migration** — Calvin to run manually.

---

## Task B — Geocode script: populate area coordinates

Create `af-server/scripts/geocode_areas.py`:

This script fetches all areas with NULL lat/lng, geocodes them via Google Geocoding API
using `area_name + state_code` as the search string, and writes the results back to the DB.

```python
"""
scripts/geocode_areas.py — Populate lat/lng for areas with NULL coordinates.

Usage:
    python scripts/geocode_areas.py [--dry-run] [--limit N]

Requires:
    - GOOGLE_MAPS_API_KEY in environment or .env.local
    - DB connection via AUTH_PROXY (localhost:5432)
    - Migration 035 applied first
"""

import argparse
import os
import time
import httpx
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv(".env.local")

DB_URL = os.environ["DATABASE_URL"]
GOOGLE_API_KEY = os.environ["GOOGLE_MAPS_API_KEY"]
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"


def geocode(area_name: str, state_code: str) -> tuple[float, float] | None:
    """Geocode area_name + state context. Returns (lat, lng) or None."""
    # Use state_code to provide country context (e.g. MY-SGR → Malaysia)
    country_code = state_code.split("-")[0]
    query = f"{area_name}, {country_code}"
    try:
        resp = httpx.get(GEOCODE_URL, params={"address": query, "key": GOOGLE_API_KEY}, timeout=10)
        data = resp.json()
        if data.get("status") == "OK" and data.get("results"):
            loc = data["results"][0]["geometry"]["location"]
            return float(loc["lat"]), float(loc["lng"])
    except Exception as e:
        print(f"  [ERROR] {area_name}: {e}")
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print results without writing to DB")
    parser.add_argument("--limit", type=int, default=None, help="Max areas to process")
    args = parser.parse_args()

    engine = create_engine(DB_URL)
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT area_id, area_name, state_code
            FROM areas
            WHERE lat IS NULL OR lng IS NULL
            ORDER BY area_id
        """)).fetchall()

    if args.limit:
        rows = rows[:args.limit]

    print(f"Areas to geocode: {len(rows)}")
    results = []

    for area_id, area_name, state_code in rows:
        coords = geocode(area_name, state_code)
        if coords:
            lat, lng = coords
            print(f"  ✓ [{area_id}] {area_name} ({state_code}) → {lat}, {lng}")
            results.append((area_id, lat, lng))
        else:
            print(f"  ✗ [{area_id}] {area_name} ({state_code}) → no result")
        time.sleep(0.1)  # Respect API rate limit

    print(f"\nGeocoded: {len(results)}/{len(rows)}")

    if args.dry_run:
        print("Dry run — no DB writes.")
        return

    if not results:
        print("Nothing to write.")
        return

    with engine.connect() as conn:
        for area_id, lat, lng in results:
            conn.execute(text("""
                UPDATE areas SET lat = :lat, lng = :lng WHERE area_id = :id
            """), {"lat": lat, "lng": lng, "id": area_id})
        conn.commit()

    print(f"Updated {len(results)} area rows.")


if __name__ == "__main__":
    main()
```

---

## Task C — Backend: nearest-area endpoint

File: `af-server/routers/ground_transport.py`

Add this endpoint. It uses the Haversine formula in SQL to find the nearest areas by
straight-line distance from a given lat/lng. Only returns areas with coordinates set.

Add after the vehicle-types endpoint:

```python
@router.get("/areas/nearest")
async def get_nearest_areas(
    lat: float = Query(...),
    lng: float = Query(...),
    limit: int = Query(default=3, ge=1, le=10),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """
    Return the nearest areas to a given lat/lng using Haversine distance.
    Only returns areas with coordinates. Used for automatic area suggestion
    after address geocoding in the frontend.
    """
    rows = conn.execute(text("""
        SELECT
            area_id,
            area_code,
            area_name,
            state_code,
            lat,
            lng,
            -- Haversine formula (result in km)
            (
                6371 * acos(
                    LEAST(1.0, cos(radians(:lat)) * cos(radians(lat::float))
                    * cos(radians(lng::float) - radians(:lng))
                    + sin(radians(:lat)) * sin(radians(lat::float)))
                )
            ) AS distance_km
        FROM areas
        WHERE lat IS NOT NULL AND lng IS NOT NULL AND is_active = TRUE
        ORDER BY distance_km ASC
        LIMIT :limit
    """), {"lat": lat, "lng": lng, "limit": limit}).fetchall()

    return {
        "status": "OK",
        "data": [
            {
                "area_id": r[0],
                "area_code": r[1],
                "area_name": r[2],
                "state_code": r[3],
                "lat": float(r[4]),
                "lng": float(r[5]),
                "distance_km": round(float(r[6]), 2),
            }
            for r in rows
        ],
    }
```

---

## Task D — TypeScript: add `fetchNearestAreasAction`

File: `af-platform/src/app/actions/ground-transport.ts`

Add type and action:

```typescript
export interface NearestAreaResult {
  area_id: number;
  area_code: string;
  area_name: string;
  state_code: string;
  lat: number;
  lng: number;
  distance_km: number;
}

export async function fetchNearestAreasAction(
  lat: number,
  lng: number,
  limit: number = 3,
): Promise<{ success: true; data: NearestAreaResult[] } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const auth = await getAuthHeaders();
    if (!auth) return { success: false, error: 'No session token or server URL' };

    const url = new URL('/api/v2/ground-transport/areas/nearest', auth.serverUrl);
    url.searchParams.set('lat', lat.toString());
    url.searchParams.set('lng', lng.toString());
    url.searchParams.set('limit', limit.toString());

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: json?.detail ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data ?? [] };
  } catch (err) {
    console.error('[fetchNearestAreasAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to fetch nearest areas' };
  }
}
```

---

## Task E — Frontend: auto-suggest area in `AddressInput`

File: `af-platform/src/components/ground-transport/AddressInput.tsx`

After a successful address resolve in `handleSuggestionSelect` (where lat/lng are set),
automatically call `fetchNearestAreasAction` and surface the top suggestion.

**Design:**
- Show a small suggestion banner below the address input when a nearest area is found:
  ```
  📍 Nearest zone: Shah Alam Industrial  (2.3 km away)  [Use this]  [Dismiss]
  ```
- "Use this" calls `onChange` with the suggested `area_id` and switches display to show
  the area name (same as if the user had selected it in zone mode)
- "Dismiss" hides the banner without changing the area
- If the current `value.area_id` is already set (user pre-selected a zone), skip the
  suggestion entirely — don't overwrite an explicit user selection
- Only suggest if the nearest result is within **50 km** — beyond that, the match is
  likely meaningless and should be silently suppressed

**Implementation steps:**

1. Add state variables in `AddressInput`:
   ```typescript
   const [nearestSuggestion, setNearestSuggestion] = useState<NearestAreaResult | null>(null);
   ```

2. Import `fetchNearestAreasAction` and `NearestAreaResult` from ground-transport actions.

3. In `handleSuggestionSelect`, after successfully setting lat/lng, add:
   ```typescript
   // Only suggest if no area already assigned
   if (!value.area_id) {
     try {
       const nearestRes = await fetchNearestAreasAction(geo.lat!, geo.lng!, 1);
       if (nearestRes.success && nearestRes.data.length > 0) {
         const nearest = nearestRes.data[0];
         if (nearest.distance_km <= 50) {
           setNearestSuggestion(nearest);
         }
       }
     } catch { /* silent — suggestion is best-effort */ }
   }
   ```

4. Clear `nearestSuggestion` when:
   - User clicks "Dismiss"
   - User clears the address (X button)
   - User manually selects a zone (mode switch to zone, or area already set)

5. Render the suggestion banner inside the `mode === 'address'` block, below the
   address message line:
   ```tsx
   {nearestSuggestion && !value.area_id && (
     <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-xs">
       <span className="text-indigo-700 flex-1">
         📍 Nearest zone: <span className="font-semibold">{nearestSuggestion.area_name}</span>
         <span className="text-indigo-500 ml-1">({nearestSuggestion.distance_km} km)</span>
       </span>
       <button
         type="button"
         onClick={() => {
           onChange({ ...value, area_id: nearestSuggestion.area_id });
           setNearestSuggestion(null);
         }}
         className="px-2 py-0.5 rounded bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
       >
         Use
       </button>
       <button
         type="button"
         onClick={() => setNearestSuggestion(null)}
         className="px-2 py-0.5 rounded text-indigo-500 hover:text-indigo-700 transition-colors"
       >
         Dismiss
       </button>
     </div>
   )}
   ```

---

## Verification

After completing all tasks:
1. Migration 035 SQL file created (NOT applied)
2. `geocode_areas.py` script created and importable (test with `--dry-run --limit 5`)
3. `GET /api/v2/ground-transport/areas/nearest?lat=3.1&lng=101.6&limit=3` returns nearest
   areas with `distance_km` field
4. In `AddressInput`, typing and selecting a Google Places address triggers the nearest-area
   call and shows the suggestion banner when a result within 50 km is found
5. "Use" button sets `area_id` on the parent value and dismisses the banner
6. "Dismiss" hides the banner; area_id remains null
7. No suggestion shown if `value.area_id` is already set before address resolution

---

## Important Notes

- **Migration 035 must be applied before the nearest-area endpoint will return results**
- **`geocode_areas.py` must be run (against prod via Auth Proxy) after migration 035**
  to populate coordinates. Until then, the endpoint returns an empty array — this is safe,
  the suggestion banner simply won't appear.
- The geocode script will consume Google API quota (~1 call per area). With ~594 areas,
  expect ~594 geocoding calls. At $0.005/call this is ~$3 USD total.
- Run the script with `--dry-run` first to verify output before committing to DB writes.

---

## Files to Create/Modify

- `af-server/migrations/035_areas_lat_lng.sql` (new)
- `af-server/scripts/geocode_areas.py` (new)
- `af-server/routers/ground_transport.py` (add nearest endpoint)
- `af-platform/src/app/actions/ground-transport.ts` (add type + action)
- `af-platform/src/components/ground-transport/AddressInput.tsx` (suggestion banner)
