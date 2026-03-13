## Prompt Log — v6.81 to v6.90

### [2026-03-15 09:00 UTC] — v6.81: Enriched Quotation Summary Card
- **Status:** Completed
- **Tasks:**
  - A: Extended `GET /quotations/{ref}` single-get query with `sd.cargo_ready_date`, `sd.type_details`, `o.cargo`; added enrichment to response after `_serialise_quotation` (list queries unchanged)
  - B: Extended `Quotation` interface with `cargo_ready_date`, `type_details`, `cargo` fields
  - C: Replaced flat scope card with two-column "Shipment Overview" card in `_components.tsx`:
    - Left column: scope flags with mode badges, area names under ASSIGNED haulage legs (fetched from GT orders), TLX release
    - Right column: incoterm, transaction type, shipment type, container summary (FCL/LCL/AIR), DG class badge, route, cargo ready date
  - Added `fetchTransportOrderByTaskAction` import and GT order area fetching in useEffect
  - Added helper functions: `buildContainerSummary`, `formatDateShort`, `SummaryRow` component
- **Files Modified:**
  - `af-server/routers/quotations.py`
  - `af-platform/src/app/actions/quotations.ts`
  - `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx`
- **Notes:** py_compile and ESLint clean. List queries unchanged — only single GET enriched.
