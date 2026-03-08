# PROMPT v5.54 — Alert Counts on Dashboard + Scenario 3 (Price Review Needed)

## Context

Following v5.53 (row-level alert badges for scenarios 1 & 2), this prompt adds:

1. **Scenario 3 alert badge on rate card rows** — cost was updated more recently than the list price, meaning the list price may be stale. Requires backend to return `latest_cost_from` and `latest_list_price_from` per card.

2. **Alert counts on the pricing dashboard** — the `dashboard-summary` endpoint gains three new counters per product (fcl/lcl): `cost_exceeds_price`, `no_list_price`, `price_review_needed`. The dashboard `ActiveCard` displays them as an alert tray below the existing stats.

---

## Alert Logic Recap (all three scenarios)

| Scenario | Condition | Severity |
|---|---|---|
| 1 | Current month: `cost_total > list_total` | Critical — red |
| 2 | Current month: cost exists, list price is null | High — amber |
| 3 | Latest cost `effective_from` > latest list price `effective_from` | Medium — yellow |

Only the highest severity shows per card (1 > 2 > 3).

---

## Tasks

### 1. Backend — `af-server/routers/pricing/__init__.py` (dashboard-summary endpoint)

Add three alert count queries to the `dashboard_summary` endpoint for each product mode.

**Scenario 1 — cost exceeds price:**
Cards where the currently-effective list price rate < currently-effective best supplier cost rate (for the current month). Use `CURRENT_DATE` for effective range checks.

```sql
SELECT COUNT(DISTINCT rc.id)
FROM {card_table} rc
{joins}
WHERE rc.is_active = true {country_where}
AND EXISTS (
    -- Has a current supplier cost
    SELECT 1 FROM {rate_table} r_cost
    WHERE r_cost.rate_card_id = rc.id
      AND r_cost.supplier_id IS NOT NULL
      AND r_cost.rate_status = 'PUBLISHED'
      AND r_cost.effective_from <= CURRENT_DATE
      AND (r_cost.effective_to IS NULL OR r_cost.effective_to >= CURRENT_DATE)
)
AND EXISTS (
    -- Has a current list price
    SELECT 1 FROM {rate_table} r_price
    WHERE r_price.rate_card_id = rc.id
      AND r_price.supplier_id IS NULL
      AND r_price.rate_status = 'PUBLISHED'
      AND r_price.effective_from <= CURRENT_DATE
      AND (r_price.effective_to IS NULL OR r_price.effective_to >= CURRENT_DATE)
)
AND (
    -- Best current cost > current list price (simplified: compare any cost > any list price)
    SELECT MIN(r_cost2.cost)
    FROM {rate_table} r_cost2
    WHERE r_cost2.rate_card_id = rc.id
      AND r_cost2.supplier_id IS NOT NULL
      AND r_cost2.rate_status = 'PUBLISHED'
      AND r_cost2.effective_from <= CURRENT_DATE
      AND (r_cost2.effective_to IS NULL OR r_cost2.effective_to >= CURRENT_DATE)
      AND r_cost2.cost IS NOT NULL
) > (
    SELECT r_price2.list_price
    FROM {rate_table} r_price2
    WHERE r_price2.rate_card_id = rc.id
      AND r_price2.supplier_id IS NULL
      AND r_price2.rate_status = 'PUBLISHED'
      AND r_price2.effective_from <= CURRENT_DATE
      AND (r_price2.effective_to IS NULL OR r_price2.effective_to >= CURRENT_DATE)
    ORDER BY r_price2.effective_from DESC
    LIMIT 1
)
```

**Scenario 2 — cost but no list price:**
```sql
SELECT COUNT(DISTINCT rc.id)
FROM {card_table} rc
{joins}
WHERE rc.is_active = true {country_where}
AND EXISTS (
    SELECT 1 FROM {rate_table} r
    WHERE r.rate_card_id = rc.id
      AND r.supplier_id IS NOT NULL
      AND r.rate_status = 'PUBLISHED'
      AND r.effective_from <= CURRENT_DATE
      AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
      AND r.cost IS NOT NULL
)
AND NOT EXISTS (
    SELECT 1 FROM {rate_table} r
    WHERE r.rate_card_id = rc.id
      AND r.supplier_id IS NULL
      AND r.rate_status = 'PUBLISHED'
      AND r.effective_from <= CURRENT_DATE
      AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
      AND r.list_price IS NOT NULL
)
```

**Scenario 3 — cost newer than list price:**
```sql
SELECT COUNT(DISTINCT rc.id)
FROM {card_table} rc
{joins}
WHERE rc.is_active = true {country_where}
AND (
    SELECT MAX(r_cost.effective_from)
    FROM {rate_table} r_cost
    WHERE r_cost.rate_card_id = rc.id
      AND r_cost.supplier_id IS NOT NULL
      AND r_cost.rate_status = 'PUBLISHED'
) > (
    SELECT MAX(r_price.effective_from)
    FROM {rate_table} r_price
    WHERE r_price.rate_card_id = rc.id
      AND r_price.supplier_id IS NULL
      AND r_price.rate_status = 'PUBLISHED'
)
-- Exclude cards already counted in scenario 1 or 2 to avoid double-counting
AND NOT EXISTS (
    SELECT 1 FROM {rate_table} r
    WHERE r.rate_card_id = rc.id
      AND r.supplier_id IS NOT NULL
      AND r.rate_status = 'PUBLISHED'
      AND r.effective_from <= CURRENT_DATE
      AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
      AND r.cost IS NOT NULL
    HAVING MIN(r.cost) > (
        SELECT r2.list_price FROM {rate_table} r2
        WHERE r2.rate_card_id = rc.id AND r2.supplier_id IS NULL
          AND r2.rate_status = 'PUBLISHED'
        ORDER BY r2.effective_from DESC LIMIT 1
    )
)
```

Note: the scenario 3 exclusion of scenario 1/2 cards is optional — if the SQL is too complex, it's acceptable to allow overlap in counts. Simplify if needed.

Add the three counts to the result dict:
```python
result[mode] = {
    "total_cards": total_cards,
    "last_updated": last_updated,
    "expiring_soon": expiring_soon,
    "cost_exceeds_price": cost_exceeds_price,   # int
    "no_list_price": no_list_price,             # int
    "price_review_needed": price_review_needed, # int
}
```

### 2. Backend — `af-server/routers/pricing/fcl.py` and `lcl.py`

Add `latest_cost_from` and `latest_list_price_from` to the rate card list response. These are needed by the frontend to detect scenario 3 per card.

**In `list_fcl_rate_cards` and `list_lcl_rate_cards`**, after building the `cards` list, run a single batch query to fetch the latest effective_from per supplier type per card:

```sql
SELECT
    rate_card_id,
    MAX(CASE WHEN supplier_id IS NULL THEN effective_from END) AS latest_list_price_from,
    MAX(CASE WHEN supplier_id IS NOT NULL AND rate_status = 'PUBLISHED' THEN effective_from END) AS latest_cost_from
FROM {rate_table}
WHERE rate_card_id = ANY(:ids)
  AND rate_status IN ('PUBLISHED', 'DRAFT')
GROUP BY rate_card_id
```

Build a map `{ card_id: { latest_list_price_from, latest_cost_from } }` and patch onto each card dict:
```python
for c in cards:
    meta = date_meta_map.get(c["id"], {})
    c["latest_list_price_from"] = str(meta["latest_list_price_from"]) if meta.get("latest_list_price_from") else None
    c["latest_cost_from"] = str(meta["latest_cost_from"]) if meta.get("latest_cost_from") else None
```

Also patch onto the single-card detail response in `get_fcl_rate_card` / `get_lcl_rate_card` (single query, no batching needed):
```sql
SELECT
    MAX(CASE WHEN supplier_id IS NULL THEN effective_from END),
    MAX(CASE WHEN supplier_id IS NOT NULL AND rate_status = 'PUBLISHED' THEN effective_from END)
FROM {rate_table}
WHERE rate_card_id = :id
```

### 3. Frontend — `af-platform/src/app/actions/pricing.ts`

**`DashboardComponentSummary` interface** — add three new fields:
```typescript
export interface DashboardComponentSummary {
  total_cards: number;
  last_updated: string | null;
  expiring_soon: number;
  cost_exceeds_price: number;
  no_list_price: number;
  price_review_needed: number;
}
```

**`RateCard` interface** — add two new fields:
```typescript
latest_list_price_from: string | null;
latest_cost_from: string | null;
```

### 4. Frontend — `af-platform/src/app/(platform)/pricing/_helpers.ts`

**Extend `getAlertLevel`** to accept the two new date fields and detect scenario 3:

```typescript
export function getAlertLevel(
  timeSeries: RateCard['time_series'],
  latestCostFrom?: string | null,
  latestListPriceFrom?: string | null,
): AlertLevel {
  // ... existing scenario 1 & 2 logic unchanged ...

  // Scenario 3: cost updated more recently than list price
  if (
    latestCostFrom != null &&
    latestListPriceFrom != null &&
    latestCostFrom > latestListPriceFrom
  ) return 'price_review_needed';

  return null;
}

// Update the type:
export type AlertLevel = 'cost_exceeds_price' | 'no_list_price' | 'price_review_needed' | null;
```

### 5. Frontend — `af-platform/src/app/(platform)/pricing/_rate-list.tsx`

**Pass new fields to `getAlertLevel`:**
```tsx
const alertLevel = getAlertLevel(card.time_series, card.latest_cost_from, card.latest_list_price_from);
```

**Add scenario 3 badge** in the chip row (after existing two alert badges):
```tsx
{alertLevel === 'price_review_needed' && (
  <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 font-medium">
    Price review needed
  </span>
)}
```

**Add scenario 3 cell tint** for current month:
```tsx
// In month cell className — add alongside existing scenario 1 & 2 checks:
isCurrentMonth && alertLevel === 'price_review_needed' ? 'bg-yellow-50/60' : ''
```

### 6. Frontend — `af-platform/src/app/(platform)/pricing/_dashboard.tsx`

**`ActiveCard` component** — update the `stats` prop type to include the new alert count fields, then render an alert tray below the existing "cards need attention / up to date" section.

Update the `stats` prop type:
```typescript
stats: {
  total_cards: number;
  last_updated: string | null;
  expiring_soon: number;
  cost_exceeds_price: number;
  no_list_price: number;
  price_review_needed: number;
} | null;
```

**Alert tray** — render below the `expiring_soon` line, only when any alert count > 0:

```tsx
{(stats.cost_exceeds_price > 0 || stats.no_list_price > 0 || stats.price_review_needed > 0) && (
  <div className="mt-2 pt-2 border-t border-[var(--border)] space-y-1">
    {stats.cost_exceeds_price > 0 && (
      <div className="text-[11px] font-medium text-red-600 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
        {stats.cost_exceeds_price} cost{stats.cost_exceeds_price > 1 ? 's exceed' : ' exceeds'} price
      </div>
    )}
    {stats.no_list_price > 0 && (
      <div className="text-[11px] font-medium text-amber-600 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
        {stats.no_list_price} unpriced
      </div>
    )}
    {stats.price_review_needed > 0 && (
      <div className="text-[11px] font-medium text-yellow-600 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0" />
        {stats.price_review_needed} need price review
      </div>
    )}
  </div>
)}
```

When all alert counts are 0, show nothing (the existing "Up to date" or "cards need attention" message from `expiring_soon` remains).

## Files to Modify

| File | Change |
|---|---|
| `af-server/routers/pricing/__init__.py` | Add 3 alert count queries to `dashboard_summary` |
| `af-server/routers/pricing/fcl.py` | Add `latest_list_price_from` + `latest_cost_from` to list and detail responses |
| `af-server/routers/pricing/lcl.py` | Same as fcl.py |
| `af-platform/src/app/actions/pricing.ts` | Extend `DashboardComponentSummary` + `RateCard` interfaces |
| `af-platform/src/app/(platform)/pricing/_helpers.ts` | Extend `getAlertLevel` + `AlertLevel` type for scenario 3 |
| `af-platform/src/app/(platform)/pricing/_rate-list.tsx` | Pass date fields to `getAlertLevel`; add scenario 3 badge + cell tint |
| `af-platform/src/app/(platform)/pricing/_dashboard.tsx` | Render alert tray in `ActiveCard` |

## Verification

1. Dashboard shows alert tray with correct counts per product when alerts exist
2. Dashboard shows no alert tray when all counts are 0
3. Rate card row shows "Price review needed" yellow badge when cost was updated after list price, and neither scenario 1 nor 2 applies
4. Scenario 1 badge still takes priority over scenario 3 on the same card
5. Scenario 2 badge still takes priority over scenario 3 on the same card
6. Current month cell shows yellow tint for scenario 3 cards
7. Country filter on dashboard correctly scopes alert counts
