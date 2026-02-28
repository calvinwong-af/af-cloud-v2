# PROMPT — Dashboard AFC KPI Cards Redesign
**Session:** v2.25 (continued)
**Date:** 01 Mar 2026
**Priority:** UI correctness

---

## Context

The AFC dashboard KPI cards have three issues after the previous fix:
1. "My Company" card label is redundant and not needed
2. "To Invoice" must be hidden from AFC users — billing status is internal
3. The company name card wraps awkwardly for long names and sits in the wrong slot

Read `AF-Coding-Standards.md` and `CLAUDE.md` before starting.

---

## Change — `af-platform/src/app/(platform)/dashboard/page.tsx`

### AFC KPI card layout (replace current implementation)

For AFC users, show exactly 4 cards:
1. **Total Shipments** — `shipmentStats.total`, default color (unchanged)
2. **Active Shipments** — `shipmentStats.active`, sky color (unchanged)
3. **Completed** — `shipmentStats.completed`, green color (replaces To Invoice)
4. **Company** — company identity card (replaces Total Companies)

For AFU users, keep the existing 4 cards unchanged:
1. Total Shipments
2. Active Shipments
3. Total Companies
4. To Invoice

### Company card design

Do NOT use `KpiCard` for the company card — the standard KpiCard layout
(large bold number + small label) doesn't suit a company name. Build a matching
custom card inline in the dashboard page instead.

The card must match the exact same outer shell as KpiCard:
```
bg-white rounded-xl border border-[var(--border)] p-4
```

Internal layout:
- Top: icon container — same size and style as KpiCard (`w-9 h-9 rounded-lg`),
  use `Building2` icon, purple color (`text-purple-600 bg-purple-50`)
- Body (mt-3):
  - Company name: `text-base font-semibold text-[var(--text)] leading-tight`
    — truncate with `truncate` class, max one line
  - Company ID below: `text-xs font-mono text-[var(--text-muted)] mt-0.5`
- No label row — the icon and the ID are sufficient context
- Loading state: two skeleton lines matching KpiCard pulse style

Use `company_name` for the name and `company_id` for the ID subline.
Both come from `getCurrentUserProfileAction()` which already returns them.
If `company_name` is null, show `company_id` in the name position.

### Completed shipments card

Use the existing `shipmentStats.completed` value.
- Icon: `CheckCircle2` from lucide-react (already imported as `PackageCheck` —
  replace with `CheckCircle2` or keep `PackageCheck`, whichever is cleaner)
- Label: `"Completed"`
- Color: `"green"`

### Grid

Keep `grid-cols-2 lg:grid-cols-4 gap-4` — same grid for both AFU and AFC.
The 4th slot for AFC is the custom company card; for AFU it remains the To Invoice KpiCard.

---

## Verification checklist

- [ ] AFC dashboard: 4 cards — Total Shipments, Active, Completed, Company
- [ ] AFC Company card: shows company name truncated to one line + company ID below
- [ ] AFC Company card: no "My Company" label anywhere
- [ ] AFC dashboard: "To Invoice" card not present
- [ ] AFU dashboard: unchanged — Total Shipments, Active, Total Companies, To Invoice
- [ ] Loading state renders skeleton correctly for company card
- [ ] Long company names truncate rather than wrap
- [ ] `npm run lint` passes
