# Handover — 2026-03-13 — Session End — v6.37

## AF Dev — Session 119 | AcceleFreight v2 | v6.37 Live | v6.38 Prompt Ready | Tests v2.61 (272/286)

---

## Session Summary

Quotation module debugging and incremental UX polish. No new Opus prompts run this session — all changes were direct MCP edits (small surgical fixes).

---

## Changes Made This Session (Direct MCP Edits)

### Fix 1 — Quotation 422 / Pydantic validation error
**Files:** `af-server/routers/quotations.py`, `af-platform/src/app/actions/quotations.ts`

**Backend:**
- `TransportDetail.vehicle_type_id` changed from `str` to `Optional[str] = None` (FCL sends null)
- Validator now skips when value is `None`
- Added `area_id: Optional[int] = None` to `TransportDetail` (was missing — would have caused a second 422)

**Frontend:**
- Added `extractErrorMessage()` helper in `quotations.ts` — handles Pydantic's array error format `[{loc, msg, type}]`
- All three action functions now use it. Previously, the raw array was returned as `error` string and React crashed trying to render an object.

### Fix 2 — Container summary display in modal
**Files:** `af-platform/src/app/(platform)/shipments/[id]/page.tsx`, `af-platform/src/components/shipments/CreateQuotationModal.tsx`

**page.tsx:**
- Added `containerSummary: string | null` computed var — tallies `quantity` per normalised container size from `ContainerDetail[]`
- Format: `"2 × 20ft, 1 × 40HC"`. Null for non-FCL.
- Passed as new `containerSummary` prop to `CreateQuotationModal`

**CreateQuotationModal.tsx:**
- Added `containerSummary?: string | null` to props interface
- **Step 1:** Summary pill displayed top-right next to "Confirm Scope" heading
- **Step 2:** Dedicated "Containers" row in review card between Shipment and Scope
- **Step 2 transport:** Inline mono tag on each assigned leg row

---

## Pending Items / Next Session Prompt (v6.38)

Write to `PROMPT-CURRENT.md` at session start.

### v6.38 — Quotation Module — UI Polish + Nav Fix + Quotation Detail Page

This is a combined prompt covering 4 items:

---

**PART 1 — Sidebar: Move Quotations nav under Operations, below Haulage**

File: `af-platform/src/components/shell/Sidebar.tsx`

The `Quotations` nav item is currently in the SYSTEM section. Move it to the OPERATIONS section, positioned after the Haulage entry (which links to `/pricing/haulage` or similar). Do not change icon or href.

---

**PART 2 — Create Quotation Modal: Widen + Container Display**

File: `af-platform/src/components/shipments/CreateQuotationModal.tsx`

The current modal max-width is `max-w-lg`. The container summary pill `"5 × 20ft"` looks cramped and ambiguous alongside the "Confirm Scope" heading. Two changes:

1. Increase modal width from `max-w-lg` to `max-w-2xl`
2. Replace the small pill in the Step 1 heading row with a more prominent display. Design intent: show container count + sizes as a small info bar below the "Confirm Scope" heading, full width, light gray background, e.g.:
   ```
   Containers   [  5 × 20ft  ]
   ```
   Style: `text-xs`, `bg-gray-50 border border-gray-200 rounded-lg px-3 py-2`, flex row with label left, value right in mono font. Only shown for FCL (when `containerSummary` is non-null). Keep the existing Step 2 "Containers" row in the review card as-is.

---

**PART 3 — Quotation Detail Page**

Currently clicking a quotation ref in the `/quotations` list navigates to the shipment page, not a quotation-specific page. We need a dedicated quotation detail page.

Create the following:

**New file: `af-platform/src/app/(platform)/quotations/[ref]/page.tsx`**
Server component shell, passes `ref` param to client component.

**New file: `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx`**
Client component `QuotationDetail`. On mount, calls `getQuotationAction(ref)` (see Part 4). Renders:

Layout: single column, max-w-3xl, standard `p-6 space-y-5` pattern.

**Header card** (`bg-white border rounded-xl p-5`):
- Left: quotation ref in `font-mono text-xl font-semibold`, status badge (DRAFT=gray, SENT=sky, ACCEPTED=green, REJECTED=red, EXPIRED=amber), revision chip `Rev. N` in small gray mono pill
- Right: shipment ID in mono linking to `/shipments/{shipment_id}`, created date, created by

**Scope card** (titled "Scope Snapshot"):
- Table/list of scope keys → mode badges (ASSIGNED=sky, TRACKED=amber, IGNORED=gray)
- Container summary if present (FCL)

**Transport card** (titled "Transport Details") — only if transport_details non-empty:
- Each leg: leg label (First Mile / Last Mile), area name (if area_id — resolve by calling a geography lookup or just show area_id for now as a TODO), address if present

**Notes card** — only if notes non-null/non-empty

**Actions row** (AFU only, status=DRAFT):
- "Mark as Sent" button — placeholder, no backend yet, just a disabled button with tooltip "Coming soon"

**New file: `af-platform/src/app/actions/quotations.ts`** — add `getQuotationAction(ref: string)`:
```typescript
export async function getQuotationAction(ref: string): Promise<{ success: true; data: Quotation } | { success: false; error: string }>
```
Calls `GET /api/v2/quotations/{ref}`.

**Update: `af-platform/src/app/(platform)/quotations/_components.tsx`**
Change the quotation ref link in the list from `href={/shipments/${q.shipment_id}}` to `href={/quotations/${q.quotation_ref}}`.

---

**PART 4 — No backend changes needed**
The `GET /api/v2/quotations/{quotation_ref}` endpoint already exists in `af-server/routers/quotations.py`.

---

## Open TODOs (Backlog)

- [ ] Quotation detail page: resolve `area_id` → area name (needs geography lookup or join in backend)
- [ ] Quotation status transitions: Mark as Sent, Accept, Reject (backend + frontend)
- [ ] Quotation pricing / cost calculation workstream (major — deferred)
- [ ] Modal size / container display — addressed in v6.38 Part 2
- [ ] Retrofit hard FK pattern to existing pricing tables (backlog)
- [ ] Air freight data migration (next major workstream after quotation stabilises)

---

## Architecture Notes — Quotation Object

The `quotations` table (migration 046) stores:
- `quotation_ref` — AFQ-XXXXXXXX (8-digit seq)
- `shipment_id` FK → `orders(order_id)`
- `revision` — integer, increments per shipment
- `status` — DRAFT / SENT / ACCEPTED / REJECTED / EXPIRED
- `scope_snapshot` — JSONB: `{first_mile: 'ASSIGNED', export_clearance: 'ASSIGNED', ...}`
- `transport_details` — JSONB array: `[{leg, vehicle_type_id, address, area_id}]`
- `notes` — optional text
- `created_by` — email

No line items, no pricing yet. That is a separate workstream.

---

## File Index (This Session)

| File | Change |
|------|--------|
| `af-server/routers/quotations.py` | vehicle_type_id Optional, area_id added to Pydantic model |
| `af-platform/src/app/actions/quotations.ts` | extractErrorMessage helper, all 3 actions updated |
| `af-platform/src/app/(platform)/shipments/[id]/page.tsx` | containerSummary computed var, passed to modal |
| `af-platform/src/components/shipments/CreateQuotationModal.tsx` | containerSummary prop + display in Step 1 and Step 2 |

---

## Test Status

No new tests this session. Tests remain at v2.61 — 272/286 passing.
A QT (Quotation) test series should be created once the detail page and status flow are stable.
