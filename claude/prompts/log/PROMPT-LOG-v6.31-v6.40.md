## Prompt Log — v6.31 to v6.40

### [2026-03-13 11:30 UTC] — v6.40: Quotation Detail Frontend + Currency Fix
- **Status:** Completed
- **Tasks:**
  1. Pre-task: Fixed currency resolution in `POST /quotations` — now queries `companies.preferred_currency` via JOIN on `orders`, falls back to `'MYR'`.
  2. Task 1: Added 5 new types (`QuotationLineItem`, `LineItemTotals`, `CalculateResult`, `ManualLineItemPayload`, `LineItemUpdatePayload`) and 5 new server actions (`calculateQuotationAction`, `listLineItemsAction`, `addManualLineItemAction`, `updateLineItemAction`, `deleteLineItemAction`) to `actions/quotations.ts`. Added `scope_changed` and `currency` fields to `Quotation` interface.
  3. Task 2: Full rewrite of `_components.tsx` — pricing table grouped by component_type with section headers, Calculate Pricing button with spinner, scope-changed amber banner, collapsible warnings panel, inline edit rows, delete with confirm, manual line item form, totals bar with margin color coding.
- **Files Modified:** `af-server/routers/quotations.py`, `af-platform/src/app/actions/quotations.ts`, `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx`
- **Notes:** py_compile and lint both pass clean. Container widened from `max-w-3xl` to `max-w-5xl`. Component type label map covers all 10 types + fallback title-case.

### [2026-03-13 10:30 UTC] — v6.39: Quotation Pricing Engine (Backend)
- **Status:** Completed
- **Tasks:**
  1. Updated `POST /quotations` to populate `currency` field (default `'MYR'` — no preferred_currency column exists yet).
  2. Added `POST /quotations/{ref}/calculate` — full pricing engine that resolves rates from all pricing tables (FCL, LCL, air freight, local charges, customs, haulage, ground transport) and writes `quotation_line_items` rows. Deletes non-manual items before re-inserting. Returns line items + warnings.
  3. Added `GET /quotations/{ref}/line-items` — returns all line items with computed effective prices/costs, margin %, and totals summary.
  4. Added `PATCH /quotations/{ref}/line-items/{id}` — manual edit, auto-sets `is_manual_override = TRUE`.
  5. Added `POST /quotations/{ref}/line-items` — add manual line item with `sort_order = 99`.
  6. Added `DELETE /quotations/{ref}/line-items/{id}` — hard delete.
  7. Added currency conversion helper `_get_conversion_factor` using `currency_rates` table.
  8. Rate resolution helpers: `_resolve_fcl_freight`, `_resolve_lcl_freight`, `_resolve_air_freight`, `_resolve_local_charges`, `_resolve_customs`, `_resolve_haulage` (with rebate + depot gate fee), `_resolve_ground_transport`.
- **Files Modified:** `af-server/routers/quotations.py`
- **Notes:** py_compile passes. Scope keys `first_mile`/`last_mile` mapped to export/import haulage/transport. `customs_rates` uses `port_code` not `country_code`. No `preferred_currency` column exists on companies — defaulted to MYR. Air freight uses separate list price tables (`air_list_price_rate_cards`/`air_list_price_rates`).

### [2026-03-13 09:00 UTC] — v6.38: Quotation Module — UI Polish + Nav Fix + Quotation Detail Page
- **Status:** Completed
- **Tasks:**
  1. Moved Quotations nav item from SYSTEM section to OPERATIONS section (after Haulage) in Sidebar.tsx.
  2. Widened Create Quotation Modal from `max-w-lg` to `max-w-2xl`. Replaced container summary pill with full-width info bar below heading.
  3. Created quotation detail page: server component `quotations/[ref]/page.tsx`, client component `quotations/[ref]/_components.tsx` with header (ref, status badge, revision, shipment link, dates), scope snapshot card, transport details card, notes card.
  4. Updated quotation list ref links from `/shipments/{id}` to `/quotations/{ref}`.
  5. Added `getQuotationAction` to `actions/quotations.ts` — calls `GET /api/v2/quotations/{ref}`.
- **Files Modified:** `af-platform/src/components/shell/Sidebar.tsx`, `af-platform/src/components/shipments/CreateQuotationModal.tsx`, `af-platform/src/app/(platform)/quotations/[ref]/page.tsx` (new), `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx` (new), `af-platform/src/app/(platform)/quotations/_components.tsx`, `af-platform/src/app/actions/quotations.ts`
- **Notes:** Lint passes clean. No backend changes needed — `GET /api/v2/quotations/{ref}` already exists.

### [2026-03-13 08:00 UTC] — v6.37: Quotation Modal — Merge Steps + Remove FCL Vehicle Type + Animated Expand
- **Status:** Completed
- **Tasks:**
  1. Collapsed 3-step modal to 2 steps — scope + transport combined (step 1) → review (step 2). Removed `hasTransportStep`, `totalSteps`, `isTransportStep`, `isReviewStep` variables.
  2. Added inline animated transport detail expansion with CSS `max-height`/`opacity` transition when leg toggled to ASSIGNED. Left border visual connector (`border-l-2 border-sky-100`).
  3. Removed separate Step 2 transport render block — now redundant.
  4. FCL: hidden vehicle type from both input form and review summary. `canGoNext` skips vehicle validation for SEA_FCL.
  5. FCL: sends `null` for `vehicle_type_id` in payload. Updated `QuotationTransportDetail.vehicle_type_id` type to `string | null`.
  6. Always includes `'wildcard'` in container sizes passed to `fetchHaulageAreasAction` so wildcard rate card areas are never hidden.
- **Files Modified:** `af-platform/src/components/shipments/CreateQuotationModal.tsx`, `af-platform/src/app/actions/quotations.ts`
- **Notes:** Lint and py_compile pass clean. Used `Array.from(new Set())` for wildcard append to avoid TS downlevelIteration issue.

### [2026-03-13 07:00 UTC] — v6.36: Quotation Modal — Haulage Area Fixes + Combobox + Multiline Address
- **Status:** Completed
- **Tasks:**
  1. Part 1: New backend endpoint `GET /api/v2/geography/haulage-areas` — returns areas with active haulage rate cards for a port, optionally filtered by container sizes via JOIN on `haulage_rate_cards`.
  2. Part 2: New server action `fetchHaulageAreasAction` in `geography.ts` with `HaulageArea` interface. Calls the new endpoint with port and optional container sizes.
  3. Part 3a: Replaced `fetchAreasAction`/`Area` with `fetchHaulageAreasAction`/`HaulageArea` in modal. Passes `containerSizes` to area fetches.
  4. Part 3b: Replaced plain `<select>` with typeable combobox — text input with filtered dropdown, `onMouseDown` for selection, `onBlur` with setTimeout for close, case-insensitive search on area_name/area_code.
  5. Part 3c: Replaced address `<input>` with `<textarea rows={3}>` with resize-none.
  6. Part 3d: Removed address from `canGoNext()` validation — address is now optional.
  7. Part 3e: Updated review step — area name on own line, address below with `whitespace-pre-wrap`.
- **Files Modified:** `af-server/routers/geography.py`, `af-platform/src/app/actions/geography.ts`, `af-platform/src/components/shipments/CreateQuotationModal.tsx`
- **Notes:** Both lint and py_compile pass clean. No migration needed — haulage_rate_cards table already exists.

### [2026-03-13 06:00 UTC] — v6.35: Quotation Modal — Area Selection + Button Reorder + Modal Visibility Fix
- **Status:** Completed
- **Tasks:**
  1. Part 1: Reordered tab bar buttons — "Create Quotation" now left of "Configure Scope" in `page.tsx`.
  2. Part 2: Modal visibility — replaced all `var(--card/border/surface/text/text-muted/text-mid)` CSS vars with explicit gray/white classes (`bg-white`, `border-gray-200`, `text-gray-900`, `text-gray-500`, etc.) for solid rendering against backdrop.
  3. Part 3: Area selection — added `areasByLeg`/`areasLoading` state, `fetchAreasAction` calls on scope load and ASSIGNED toggle, area dropdown between vehicle type and address in transport step, area validation in `canGoNext`, area name in review summary.
  4. Part 4: Added `area_id: number | null` to `QuotationTransportDetail` type in `quotations.ts`.
  5. Part 5: Wired `originPortCode`/`destinationPortCode` props from `page.tsx` to `CreateQuotationModal`.
  6. Bonus: Added `AFU-STAFF` to `fetchAreasAction` role list in `geography.ts` — was missing, would block area fetch for non-admin staff.
- **Files Modified:** `page.tsx` (shipments/[id]), `CreateQuotationModal.tsx`, `quotations.ts` (actions), `geography.ts` (actions)
- **Notes:** Lint passes clean. No backend changes — `area_id` stored transparently in JSONB.

### [2026-03-12 16:30 UTC] — v6.34: Quotations Page + Nav Link
- **Status:** Completed
- **Tasks:**
  1. Added `Quotations` nav item (`FileText` icon, `/quotations`) to SYSTEM section in Sidebar.tsx, positioned before Geography. Imported `FileText` from lucide-react.
  2. Created server component `quotations/page.tsx` with header + `QuotationsList` client component.
  3. Created `quotations/_components.tsx` — `QuotationsList` fetches all quotations on mount, renders table with Ref (monospace, links to shipment), Shipment (truncated), Status (color badges), Revision, Created date, Created By. Includes skeleton loading (5 rows), empty state, error state.
  4. Added `listAllQuotationsAction` to `actions/quotations.ts` — GET without shipment_id filter.
  5. Made `shipment_id` optional in backend `GET /quotations` — omitted returns all quotations ordered by `created_at DESC LIMIT 200`. Added `Query` import.
- **Files Modified:** `af-platform/src/components/shell/Sidebar.tsx`, `af-platform/src/app/(platform)/quotations/page.tsx` (new), `af-platform/src/app/(platform)/quotations/_components.tsx` (new), `af-platform/src/app/actions/quotations.ts`, `af-server/routers/quotations.py`
- **Notes:** Lint passes clean after removing unused Loader2 import. py_compile passes.

### [2026-03-12 16:00 UTC] — v6.33: Quotation Module — Frontend (Create Quotation Modal)
- **Status:** Completed
- **Tasks:**
  1. Created server action `af-platform/src/app/actions/quotations.ts` — `createQuotationAction` (POST) and `listQuotationsAction` (GET), with types `Quotation`, `CreateQuotationPayload`, `QuotationTransportDetail`. Follows ground-transport.ts auth pattern.
  2. Created modal `af-platform/src/components/shipments/CreateQuotationModal.tsx` — 3-step modal (Scope Confirmation → Transport Details → Review & Confirm). Uses INCOTERM_TASK_RULES for eligible scope keys, segmented ASSIGNED/TRACKED/IGNORED buttons, vehicle type dropdown filtered by order type, FCL container size → default vehicle mapping, address inputs, notes textarea. Saves scope + creates quotation on submit.
  3. Wired into `page.tsx` — added `showCreateQuotation`/`latestQuotationRef` state, "Create Quotation" button in tab bar actions (sky blue, AFU-only, non-cancelled), containerSizes helper using `Array.from(new Set(...))` (pg8000-safe), modal render, and dismissible success banner showing quotation ref.
- **Files Modified:** `af-platform/src/app/actions/quotations.ts` (new), `af-platform/src/components/shipments/CreateQuotationModal.tsx` (new), `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
- **Notes:** Lint passes clean. Used `Array.from(new Set())` instead of `[...new Set()]` to avoid TS downlevelIteration build error. Transport step only renders when first_mile or last_mile is ASSIGNED.

### [2026-03-12 15:30 UTC] — v6.32: Quotation Module — Backend Foundation (Migration + API)
- **Status:** Completed
- **Tasks:**
  1. Created migration `af-server/migrations/039_quotations.sql` — `quotations` table with UUID PK, `quotation_ref` (AFQ- + 8-digit seq), FK to `orders`, JSONB `scope_snapshot` + `transport_details`, indexes, `updated_at` trigger, and sequence.
  2. Created router `af-server/routers/quotations.py` — 3 endpoints: `POST /quotations` (create with revision tracking, vehicle type validation, JSONB bindparam for pg8000), `GET /quotations?shipment_id=` (list by shipment, revision DESC), `GET /quotations/{quotation_ref}` (single).
  3. Registered router in `main.py` under `/api/v2` prefix.
- **Files Modified:** `af-server/migrations/039_quotations.sql` (new), `af-server/routers/quotations.py` (new), `af-server/main.py`
- **Notes:** All files pass py_compile. Uses `CAST(:param AS jsonb)` + `bindparam(type_=String())` pattern for pg8000 Cloud Run compat. No line items/pricing — deferred per prompt.

### [2026-03-12 15:00 UTC] — v6.31: Shipment Status — Remove 5001 from Pipeline + Auto-complete on End
- **Status:** Completed
- **Tasks:**
  1. Removed `5001` from `STATUS_PATH_A` and `STATUS_PATH_B` in `lib/types.ts` — `4002` (Arrived) is now the terminal pipeline node.
  2. Removed `5001` special case from `handleFutureNodeClick` — only `-1` (Cancel) now triggers confirmation dialog.
  3. Added auto-complete logic in `executeStatusChange` — when status advances to `4002`, automatically calls `updateCompletedFlagAction(quotation_id, true)` if not already completed.
  4. Removed `currentStatus !== 5001` guard from "Mark Complete" button visibility — now shows for all statuses >= `3002`.
- **Files Modified:** `af-platform/src/lib/types.ts`, `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`
- **Notes:** SQL data fix (`UPDATE orders SET completed = TRUE WHERE status = 'completed' AND completed = FALSE`) needs to be run manually against prod — not executed here. `5001` retained in `ShipmentOrderStatus` type, labels, and colors for legacy display of historical records.
