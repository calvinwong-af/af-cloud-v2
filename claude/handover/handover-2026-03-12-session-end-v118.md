# Handover — 2026-03-12 — Session 111 End — v6.18 Prompt Ready

## Session Header
AF Dev — Session 111 | AcceleFreight v2 | v6.17 Live | v6.18 Prompt Ready | Tests v2.61 (272/286)

---

## What Was Done This Session

### v6.16 — Delete Button in Edit Modals (confirmed complete on entry)
All three rate modals now have a delete path. DRAFT rates: single click deletes. PUBLISHED rates: inline red confirmation block appears first. `onDelete` + `isLatestRate` props wired from all three expanded panels. Fully complete.

### v6.17 — Air O/D Grouping + Remove Legacy Inline Delete Buttons ✅ COMPLETE
**Part A:** `_air-rate-list.tsx` restructured into two-level hierarchy:
- O/D group header rows (collapsed by default) — shows origin→dest, airline count, alert indicator
- Airline sub-rows beneath (only when group expanded) — shows airline code + DG class, time series cells

**Part B:** Legacy inline Delete buttons removed from DRAFT branches in all three expanded panels. DRAFT branch now shows only Edit button. Delete is accessible via the Edit modal (v6.16). Removed unused `confirmDeleteId` + panel-level `handleDelete` from FCL/LCL and air panels. Haulage kept `confirmDeleteId` (still used by DGF section). Unused `dangerBtnClass` also removed from FCL/LCL and air.

### Inline Delete Bug Identified (screenshot review)
Post-v6.17 screenshot confirmed that the old inline Delete button on supplier rows was the pre-v6.16 DRAFT-only delete — no dialog, no explanation. Confirmed this was removed by v6.17 Part B.

### v6.18 — Air Rate List: Aggregated Cells + Supplier Label + Sparkline Fix (PROMPT READY)
Four issues diagnosed from screenshot review:

1. **Sparkline misalignment** — expanded panel uses `220px` identity pane; rate list uses `280px`. Fix: bump expanded panel to `280px`.
2. **O/D group row: aggregated list price** — group header cells are empty. Fix: compute lowest `p100_list_price` across all cards in group per month (frontend only, in `groups` useMemo).
3. **Airline sub-row cost** — already correct. `p100_cost` in time series is already the lowest supplier cost (`min()` across `active_supplier_costs` in backend). No change needed.
4. **Supplier label** — no supplier_id in time series. Backend fix: add one `DISTINCT ON ... ORDER BY p100_cost ASC` query to `list_air_rate_cards` to return `latest_cost_supplier_id` per card. Frontend: show company name label on current month cell only.

---

## Active Prompt

**File:** `claude/prompts/PROMPT-CURRENT.md`
**Version:** v6.18

### Files to be modified by v6.18:
| File | Change |
|---|---|
| `af-server/routers/pricing/air.py` | Add `latest_cost_supplier_id` via new `DISTINCT ON` query |
| `af-platform/src/app/actions/pricing.ts` | Add `latest_cost_supplier_id?: string \| null` to `AirRateCard` type |
| `af-platform/src/app/(platform)/pricing/air/_air-expanded-panel.tsx` | Change `220px` → `280px` (identity pane + totalWidth) |
| `af-platform/src/app/(platform)/pricing/air/_air-rate-list.tsx` | Add `monthListPrices` to ODGroup, populate O/D header cells, add supplier label on current month |

---

## Key File Locations

| Area | Path |
|---|---|
| Air rate list | `af-platform/src/app/(platform)/pricing/air/_air-rate-list.tsx` |
| Air expanded panel | `af-platform/src/app/(platform)/pricing/air/_air-expanded-panel.tsx` |
| Air backend | `af-server/routers/pricing/air.py` |
| Pricing actions (TS types) | `af-platform/src/app/actions/pricing.ts` |
| Sparkline | `af-platform/src/app/(platform)/pricing/_sparkline.tsx` |
| FCL/LCL expanded panel | `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx` |
| Haulage expanded panel | `af-platform/src/app/(platform)/pricing/haulage/_haulage-expanded-panel.tsx` |
| Prompt log | `claude/prompts/log/PROMPT-LOG-v6.11-v6.20.md` |
| Active prompt | `claude/prompts/PROMPT-CURRENT.md` |

---

## Architecture Notes (for next session)

- `p100_cost` in air time series = lowest supplier cost, already correct (backend `min()` pattern)
- `latest_cost_supplier_id` is NEW — will be added by v6.18 backend change
- All three expanded panels now have identity pane at `280px` after v6.18 (air was `220px`, now fixed)
- Identity pane width must match between rate list and expanded panel for sparkline alignment

---

## Backlog

| Item | Status |
|---|---|
| v6.18 — Air aggregated cells + supplier label + sparkline fix | ⏳ PENDING — prompt ready |
| Quotation module | ⏳ Next major workstream after air freight UI stabilises |
| TD-02: drop deprecated flat surcharge columns | Deferred |
| UI-17: per-user country preference | Deferred (schema migration needed) |
| Gen transport + cross-border | No data, deferred |
| Retrofit hard FK to existing pricing tables | Backlog |

---

## Test Status
**v2.61 — 272/286 passing** — no test changes this session (pricing UI work only, no new test series created).

---

## Session Startup Instructions (Next Session)
```
Read files:
- claude/handover/handover-2026-03-12-session-end-v118.md
- claude/tests/AF-Test-Master.md
- claude/prompts/log/PROMPT-LOG-v6.11-v6.20.md (tail:10)
- claude/prompts/PROMPT-CURRENT.md
```

Display session header:
**AF Dev — Session 112 | AcceleFreight v2 | v6.17 Live | v6.18 Prompt Ready | Tests v2.61 (272/286)**
