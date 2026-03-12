## Prompt Log — v6.31 to v6.40

### [2026-03-12 16:00 UTC] — v6.33: Quotation Module — Frontend (Create Quotation Modal)
- **Status:** Completed
- **Tasks:**
  1. Created server action `af-platform/src/app/actions/quotations.ts` — `createQuotationAction` (POST) and `listQuotationsAction` (GET), with types `Quotation`, `CreateQuotationPayload`, `QuotationTransportDetail`. Follows ground-transport.ts auth pattern.
  2. Created modal `af-platform/src/components/shipments/CreateQuotationModal.tsx` — 3-step modal (Scope Confirmation → Transport Details → Review & Confirm). Uses INCOTERM_TASK_RULES for eligible scope keys, segmented ASSIGNED/TRACKED/IGNORED buttons, vehicle type dropdown filtered by order type, FCL container size → default vehicle mapping, address inputs, notes textarea. Saves scope + creates quotation on submit.
  3. Wired into `page.tsx` — added `showCreateQuotation`/`latestQuotationRef` state, "Create Quotation" button in tab bar actions (sky blue, AFU-only, non-cancelled), containerSizes helper using `Array.from(new Set(...))` (pg8000-safe), modal render, and dismissible success banner showing quotation ref.
- **Files Modified:** `af-platform/src/app/actions/quotations.ts` (new), `af-platform/src/components/shipments/CreateQuotationModal.tsx` (new), `af-platform/src/app/(platform)/shipments/[id]/page.tsx`
- **Notes:** Lint passes clean. Used `Array.from(new Set())` instead of `[...new Set()]` to avoid TS downlevelIteration build error. Transport step only renders when first_mile or last_mile is ASSIGNED.

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
