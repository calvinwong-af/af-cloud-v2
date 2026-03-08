# AcceleFreight v2 — Session End Handover
**Session:** 59
**Date:** 2026-03-08
**Live version:** v5.22
**Last prompt executed:** v5.39 (Pricing Rate Edit Modal + Sparkline Tooltip Improvements)
**Tests:** v2.61 — 272/286

---

## What Was Done This Session

### 1. v5.39: Pricing Rate Edit Modal + Sparkline Tooltip Improvements (RESOLVED — Opus)

**Motivation:** Three UX issues identified on the pricing rate cards page:
1. Sparkline SVG hover label was clipping at left/right edges of the SVG viewport
2. Hover tooltip only showed the single freight value — no surcharge breakdown
3. Inline Add/Edit form inside the expanded panel was too cramped for surcharge management

**Changes:**

**`_rate-modal.tsx` (new):**
- Standalone modal dialog for Add List Price / Add Supplier / Edit rate operations
- Centered overlay with backdrop, `max-w-lg` dialog panel
- 2-column field grid: Effective from/to, Currency/Status, List price or Cost / Min values
- Supplier selector (Add Supplier mode only), full-width surcharge section below fields
- Dynamic surcharge rows: Add / Remove; serialised to JSONB format on save
- Calls existing `createFCL/LCL` and `updateFCL/LCL` server actions

**`_expanded-panel.tsx` (modified):**
- Removed all inline Add/Edit form state (`formSupplier`, `formEffFrom`, etc.), `resetForm`, `initEditForm`, `handleSaveRate`, inline form JSX block, `formRef`, associated `useEffect`
- Added `ModalState` discriminated union; rewired Edit / + Supplier Rate / + List Price buttons to open modal
- Added `buildSurchargesMap` helper (mirrors `buildMonthMap`, returns `SurchargeItem[] | null` per month)
- Passes `surchargesMap` into all `<CostSparkline>` calls

**`_sparkline.tsx` (modified):**
- Wrapped SVG in `<div style={{ position: 'relative' }}>` to enable HTML child positioning
- Removed SVG `<text>` hover label
- Current-month SVG label retained but with clamped X (`Math.max(20, Math.min(p.x, totalW - 20))`) to prevent edge clipping
- Added HTML tooltip popover on hover: month label + Freight value + surcharge rows (code + amount) + Total line (when surcharges present)

**`_types.ts` (modified):**
- Removed `'add'` and `'edit'` variants from `PanelMode` — those modes now live in the modal
- `PanelMode` is now `'view' | 'terminate'` only

---

## Pending Actions

1. **[OPEN]** Prompt log v5.37 duplicate entry — Opus to clean up (two v5.37 entries in `PROMPT-LOG-v5.31-v5.40.md`)
2. **[DEFERRED]** TD-02: Drop deprecated flat surcharge columns (`lss`, `baf`, `ecrs`, `psc`) from `fcl_rates` and `lcl_rates` — after v5.38 confirmed stable in prod
3. **[PENDING]** Migration 018 must be run on **prod DB** before deploying v5.38/v5.39 code
4. **[TBC]** Geography → Pricing → Quotation workstream — designed, implementation status TBC
5. **[DEFERRED]** All AI agent phases — after core platform complete

---

## Migration Status

| Migration | Description | Local | Prod |
|---|---|---|---|
| 016 | rate_status enum: DRAFT + REJECTED | ✅ | ✅ |
| 017 | fcl_rates + lcl_rates: effective_to DATE | ✅ | ✅ |
| 018 | fcl_rates + lcl_rates: surcharges JSONB | ✅ | ⚠️ Pending |

---

## Current State

| Area | Status |
|---|---|
| FCL rate cards + time series grid | ✅ Working |
| LCL rate cards + time series grid | ✅ Working |
| Rate CRUD (add/edit/terminate/delete) | ✅ Working |
| Surcharges JSONB (v5.38) | ✅ Code done, migration local only |
| Rate edit modal (v5.39) | ✅ Done |
| Sparkline HTML tooltip popover (v5.39) | ✅ Done |
| Expanded panel cleanup (v5.39) | ✅ Done |
| Pricing dashboard | ✅ Working |
| Geography / Pricing / Quotation workstream | 🔒 Designed, implementation TBC |

---

## Key File Locations
- `af-platform/src/app/(platform)/pricing/_rate-modal.tsx` (new — v5.39)
- `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx`
- `af-platform/src/app/(platform)/pricing/_sparkline.tsx`
- `af-platform/src/app/(platform)/pricing/_types.ts`
- `af-platform/src/app/(platform)/pricing/_rate-list.tsx`
- `af-platform/src/app/(platform)/pricing/_helpers.ts`
- `af-server/routers/pricing/fcl.py`
- `af-server/routers/pricing/lcl.py`
- `af-platform/src/app/actions/pricing.ts`
- `claude/prompts/log/PROMPT-LOG-v5.31-v5.40.md`
- `claude/tests/AF-Test-Master.md`
- `claude/other/AF-Backlog.md`
