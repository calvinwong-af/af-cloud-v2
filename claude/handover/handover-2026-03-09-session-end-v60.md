# AcceleFreight v2 — Session End Handover
**Session:** 60
**Date:** 2026-03-09
**Live version:** v5.22
**Last prompt written:** v5.44 (running in Opus at session end — not yet confirmed complete)
**Last prompt confirmed executed:** v5.43
**Tests:** v2.61 — 272/286

---

## What Was Done This Session

### 1. MCP Direct — Pricing nav chevron not closing (RESOLVED)

**Symptom:** Clicking the chevron on "Pricing Tables" in the sidebar did not collapse the sub-menu.

**Root cause:** `showPricingSub = isPricingRoute || pricingExpanded` — while on any `/pricing/*`
route, `isPricingRoute` was always `true`, so toggling `pricingExpanded` to `false` had no effect.

**Fix (MCP direct — `Sidebar.tsx`):**
- `showPricingSub` is now purely `pricingExpanded`
- Added `useEffect` watching `isPricingRoute` to auto-expand on first arrival at a pricing route
- Chevron can now close the sub-menu even while on a pricing route

**File:** `af-platform/src/components/shell/Sidebar.tsx`

---

### 2. MCP Direct — `model_fields_set` AttributeError (PARTIAL — lcl.py corrupt)

**Symptom:** PATCH `/pricing/fcl/rates/{id}` and `/pricing/lcl/rates/{id}` returning 500:
`AttributeError: 'FCLRateUpdate' object has no attribute 'model_fields_set'`

**Root cause:** `body.model_fields_set` is Pydantic v2 syntax. Project uses Pydantic v1
which requires `body.__fields_set__`.

**Status:**
- `fcl.py` — fix written to disk (`__fields_set__`). Verify correct on server restart.
- `lcl.py` — **FILE IS CORRUPT**. A `write_file` operation was interrupted mid-content,
  leaving the file truncated. Server will fail to import `lcl.py` on startup.

**Both files are covered in v5.44 prompt for Opus to handle cleanly.**

---

### 3. v5.44 — Prompt Written (Running in Opus at Session End)

**Status:** PENDING — running in Opus, not yet confirmed complete.

**Four fixes in this prompt:**

**Fix 1 — `lcl.py` full rewrite (CRITICAL)**
File is corrupt from interrupted write. Opus must rewrite in full using `fcl.py` as reference
with LCL-specific differences (table names, model names, no container_size/type, uom="W/M",
rate_card_key format `origin:dest:dg`).

**Fix 2 — `model_fields_set` → `__fields_set__` (both files)**
Pydantic v1 compatibility fix in `update_fcl_rate` and `update_lcl_rate`.

**Fix 3 — Grid surcharge split (`fcl.py`, `lcl.py`, `pricing.ts`, `_rate-list.tsx`)**
Single shared `surcharge_total = max(pr_sc, cost_sc)` was applied to both grid rows.
Split into `list_surcharge_total` and `cost_surcharge_total` per bucket. Frontend uses
correct per-row surcharge for display and tooltip. `surcharge_total` kept for backward compat.
Also fixes future branch using `cost_entries[0]` instead of best cost entry.

**Fix 4 — Date label null `effective_from` (`_expanded-panel.tsx`)**
`formatRatesRange` used `.filter(Boolean)` which dropped null `effective_from` values.
Migrated rates have null `effective_from`. Fix: `rates.map(r => r.effective_from ?? MIGRATION_FLOOR)`
so null dates contribute `'2024-01-01'` to the sort instead of being excluded.

**Files in v5.44:**
- `af-server/routers/pricing/lcl.py` — full rewrite
- `af-server/routers/pricing/fcl.py` — Fix 2 + Fix 3
- `af-platform/src/app/actions/pricing.ts` — new time series fields
- `af-platform/src/app/(platform)/pricing/_rate-list.tsx` — per-row surcharge display
- `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx` — Fix 4

---

## Pending Actions

| # | Item | Status |
|---|------|--------|
| 1 | **v5.44 Opus execution** | ⏳ Running at session end — verify complete |
| 2 | **Migration 018 on prod DB** | ⚠️ Must run before deploying v5.38+ code to prod |
| 3 | **Prompt log v5.37 duplicate entry** | 🔧 Minor — Opus to clean up when convenient |
| 4 | **TD-02: Drop deprecated flat surcharge columns** | 🔒 Deferred — after v5.38 stable in prod |
| 5 | **Geography → Pricing → Quotation workstream** | 🔒 Deferred — implementation TBC |
| 6 | **AI agent phases** | 🔒 Deferred — after core platform complete |

---

## Migration Status

| Migration | Description | Local | Prod |
|-----------|-------------|-------|------|
| 016 | rate_status enum: DRAFT + REJECTED | ✅ | ✅ |
| 017 | fcl_rates + lcl_rates: effective_to DATE | ✅ | ✅ |
| 018 | fcl_rates + lcl_rates: surcharges JSONB | ✅ | ⚠️ Pending |

---

## Architecture Decisions (Session 60)

- **Surcharge split pattern:** List price and cost rows in the time series grid each carry
  their own surcharge total (`list_surcharge_total`, `cost_surcharge_total`). The shared
  `surcharge_total` (= list price surcharge) is kept only for backward compat and card-level
  `has_surcharges` indicator. This is now the canonical structure.

---

## Key File Locations

| File | Notes |
|------|-------|
| `af-platform/src/components/shell/Sidebar.tsx` | Nav chevron fix applied this session |
| `af-server/routers/pricing/fcl.py` | `__fields_set__` fix + surcharge split — verify on restart |
| `af-server/routers/pricing/lcl.py` | ⚠️ CORRUPT — awaiting v5.44 Opus rewrite |
| `af-platform/src/app/(platform)/pricing/_rate-list.tsx` | Surcharge split (v5.44) |
| `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx` | Date label fix (v5.44) |
| `af-platform/src/app/actions/pricing.ts` | New time series types (v5.44) |
| `claude/prompts/PROMPT-CURRENT.md` | v5.44 — running |
| `claude/prompts/log/PROMPT-LOG-v5.41-v5.50.md` | Needs v5.44 entry after Opus completes |
| `claude/tests/AF-Test-Master.md` | v2.61 — 272/286 |

---

## Session Start Instructions (Next Session)

1. Confirm v5.44 Opus execution result
2. If complete: update prompt log + bump version to v5.44
3. If `lcl.py` still corrupt: that is the first priority before any other work
4. Run `af-server` and verify no import errors on startup
5. Test PATCH on both FCL and LCL rates to confirm `__fields_set__` fix working
