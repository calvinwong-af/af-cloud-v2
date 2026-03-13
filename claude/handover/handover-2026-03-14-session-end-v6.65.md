# Handover — 2026-03-14 Session End — v6.65

## Session Header
AF Dev — Session 129 | AcceleFreight v2 | v6.38 Live | v6.65 Latest | Tests v2.61 (272/286)

---

## Session Summary
Session 129 covered: migrations 052–054 applied to prod, sidebar collapse UX fixes, quotation detail scope card redesign (TLX as scope label), and the full Edit Scope Modal (v6.65).

---

## Prompts Completed This Session
- **v6.65** — Edit Scope Modal + totals bar SST consolidation (completed, log read)

## Prompt In Progress
- None — clean state

## Deploy Queue
**v6.39–v6.65 = 27 versions pending** (v6.38 live on Cloud Run)

---

## Work Done This Session

### Migrations Applied to Prod
- `052_tax_rules.sql` — tax_rules table + MY-SST seed
- `053_line_items_tax.sql` — tax columns on quotation_line_items
- `054_quotation_tlx_release.sql` — tlx_release on quotations

### Sidebar Fixes (direct MCP edits)
- Logo (LogoMark) always visible when nav collapsed — pulled out of the collapsible flex wrapper
- Expand chevron moved from footer to below header — renders as its own `shrink-0` block when `isCollapsed && !isMobileDrawer`
- **File:** `af-platform/src/components/shell/Sidebar.tsx`

### Quotation Detail — Scope Card Redesign (direct MCP edits)
- TLX checkbox removed from header card info block entirely
- TLX now shows as plain label ("Telex Release") in scope card — visible only when `tlxRelease === true`, same style as other scope items
- "Edit Scope" button added to scope card header (AFU only, sky-coloured micro-button)
- `editScopeOpen` state added to `QuotationDetail`
- Scope card always renders for AFU users (even with no assigned scope keys)
- **File:** `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx`

### v6.65 — Edit Scope Modal
- `PATCH /quotations/{ref}/scope-snapshot` endpoint added to backend
- `updateQuotationScopeSnapshotAction` added to `quotations.ts`
- `EditScopeModal.tsx` created — scope toggles (ASSIGNED/TRACKED/IGNORED) + Telex Release checkbox + save logic
- `incoterm` and `transaction_type` joined from `shipment_details` into all 3 quotation SELECT queries + `Quotation` interface
- Tax (SST) consolidated into totals bar — removed separate subtotal block, Tax (SST) now sits between Total Price and Total Cost in bar (shown when `total_tax > 0`, both views)
- `handleTlxToggle` and `setTlxReleaseAction` removed from `_components.tsx` (TLX now managed via EditScopeModal)
- **Files:** `af-server/routers/quotations.py`, `af-platform/src/app/actions/quotations.ts`, `af-platform/src/components/quotations/EditScopeModal.tsx` (new), `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx`

---

## Current State of Key Files

| File | State |
|------|-------|
| `af-server/routers/quotations.py` | v6.65 — scope-snapshot endpoint, tax engine, tlx-release endpoint |
| `af-platform/src/app/actions/quotations.ts` | v6.65 — updateQuotationScopeSnapshotAction added |
| `af-platform/src/components/quotations/EditScopeModal.tsx` | NEW — created v6.65 |
| `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx` | v6.65 — modal wired, TLX as label, totals bar updated |
| `af-platform/src/components/shell/Sidebar.tsx` | Logo always visible, expand chevron at top |

---

## Open Items / Backlog

- **Deploy batch** v6.39–v6.65 (27 versions pending against v6.38 live)
- **Geography → Tax Rules tab** — admin UI for `tax_rules` table (PENDING)
- **Manual line item tax** — apply tax when user adds manual item based on component_type + port country (PENDING)
- **`is_domestic` audit** on DG Class Charges — many rows tagged `is_domestic = true` from migration (PENDING)
- **Customs module delete support** (PENDING)
- **AF-API-Pricing.md** — needs update after quotation module stabilises (PENDING)
- **Air freight data migration** — next major workstream after quotation module (PENDING)
- **Retrofit hard FK pattern** to existing pricing tables (backlog)

---

## Session Startup Checklist (Session 130)

```
read_multiple_files:
  - claude/handover/handover-2026-03-14-session-end-v6.65.md   ← this file
  - claude/prompts/log/PROMPT-LOG-v6.61-v6.70.md               (head:30)
  - claude/tests/AF-Test-Master.md
```

Session header:
`AF Dev — Session 130 | AcceleFreight v2 | v6.38 Live | v6.65 Latest | Tests v2.61 (272/286)`
