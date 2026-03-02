# Prompt Completion Log — v2.63–v2.72

### [2026-03-03 02:30 UTC] — BL-28: Container schema merge on BL update
- **Status:** Completed
- **Tasks:**
  - PART 1: Backend merge — BL-parsed containers merged into existing type_details rows preserving container_size/quantity
  - PART 2: Frontend — TypeDetailsCard renders BL-enriched container_number/seal_number fields alongside legacy arrays
  - Extended ContainerDetail interface with optional BL fields
  - Footer hint conditionally hidden when container numbers are assigned
- **Files Modified:**
  - `af-server/routers/shipments.py` — container merge logic in update_from_bl
  - `af-platform/src/app/(platform)/shipments/[id]/page.tsx` — TypeDetailsCard container row rendering
  - `af-platform/src/lib/types.ts` — ContainerDetail interface extended
