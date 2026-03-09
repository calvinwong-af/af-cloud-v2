# AcceleFreight v2 — Session End Handover
**Session:** 64
**Date:** 2026-03-09
**Live version:** v5.22
**Last prompt executed:** v5.50
**No pending prompts**
**Tests:** v2.61 — 272/286 (unchanged this session — no test-impacting changes)

---

## What Was Done This Session

### 1. v5.49 — Edit Published Rates + Sparkline End-Date Markers

**Edit Published Rates:**
- Added "Edit" button to PUBLISHED rate rows (both List Price and Supplier rows) in `_expanded-panel.tsx`
- Sits alongside existing "Update" and "Set end date" buttons
- Reuses existing `edit` modal mode — no new modal state, no backend changes
- Allows in-place correction of a published rate without creating a superseding node

**Sparkline End-Date Markers:**
- `buildEndDateMap` helper in `_expanded-panel.tsx` — maps `month_key → RateDetail` for rates with non-null `effective_to`
- `CostSparkline` gains `endDateMap` + `onNodeClick` props
- Amber downward tick + diamond rendered on months where a rate ends
- Click opens edit modal pre-populated with that rate's values
- Tooltip shows "Ends [date] · Click to edit"

**Files Modified:** `_expanded-panel.tsx`, `_sparkline.tsx`

---

### 2. v5.50 — Sparkline Start-Date Markers

- `buildStartDateMap` helper — mirrors `buildEndDateMap`, keyed on `effective_from`
- Migration floor guard: rates with `effective_from` at or before Jan 2024 excluded (seed/carry-forward records — start date not meaningful)
- `CostSparkline` gains `startDateMap` prop
- Amber **upward** tick + diamond rendered above dot on months where a rate starts — symmetric to end-date marker
- Click opens edit modal for that rate (end-date takes click priority if both markers coincide)
- Tooltip shows "Starts [date] · Click to edit"

**Files Modified:** `_expanded-panel.tsx`, `_sparkline.tsx`

---

### 3. Backlog — PR-01 Added

Surcharge model clarification logged as **PR-01** in `AF-Backlog.md`. To be reviewed when starting the Quotation module.

**Decision captured:**
- Surcharges on supplier records = cost burden (absorbed or passed through)
- Surcharges on list price records = ambiguous, needs design decision
- Customer quote back-calculation model agreed: quoted total (list price) − supplier surcharges = net freight shown to customer, with surcharges itemised separately

---

## Current State

### Pricing Module — Expanded Panel Button Layout
| Rate Status | Buttons shown |
|---|---|
| PUBLISHED | Update · Edit · Set end date |
| DRAFT | Edit · Delete |

### Sparkline Markers
| Marker | Direction | Colour | Click behaviour |
|---|---|---|---|
| Start-date | Upward tick + diamond above dot | Amber `#f59e0b` | Opens edit modal for that rate |
| End-date | Downward tick + diamond below dot | Amber `#f59e0b` | Opens edit modal for that rate |

### Migration Status (unchanged)
| Migration | Local | Prod |
|---|---|---|
| 018 — surcharges JSONB | ✅ | ⚠️ Pending — must run before deploying v5.38+ |
| 019 — inverted date fix (Part 1 only) | ✅ | ⚠️ Pending — safe to run |

---

## Pending This Session — UI Standardisation

Calvin noted there are UI updates to standardise on the pricing module before considering it complete. These were not scoped this session — to be picked up next session. Nature of changes TBD.

---

## Key File Locations
| File | Notes |
|---|---|
| `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx` | Edit button + start/end date map builders |
| `af-platform/src/app/(platform)/pricing/_sparkline.tsx` | Start + end date markers, onNodeClick |
| `claude/other/AF-Backlog.md` | PR-01 added |
| `claude/prompts/PROMPT-CURRENT.md` | No pending prompt |
| `claude/tests/AF-Test-Master.md` | v2.61 — 272/286 |
