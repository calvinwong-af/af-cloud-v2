# AcceleFreight v2 — Session End Handover
**Session:** 63
**Date:** 2026-03-09
**Live version:** v5.22
**Last prompt executed:** v5.48
**No pending prompts**
**Tests:** v2.61 — 272/286

---

## What Was Done This Session

### 1. Migration 019 Part 2 — Rolled Back (CRITICAL)

**What happened:** v5.48 (Session 62) included Migration 019 with two parts:
- Part 1: Fix inverted effective dates (COSCO rate with `effective_to < effective_from`) ✅ Correct
- Part 2: Terminate superseded open-ended records (set `effective_to = next_effective_from - 1 day`) ❌ Wrong

Part 2 terminated 1,906 FCL + 983 LCL records. This broke the sparklines — the seed+window
detail endpoint was excluding seed records when a window record existed for the same supplier,
causing gaps for all months before the latest rate's `effective_from`.

**Rollback steps taken:**
1. Ran rollback SQL in local DB to clear migration-set `effective_to` values:
   ```sql
   UPDATE fcl_rates r SET effective_to = NULL
   WHERE r.effective_to IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM fcl_rates r2
     WHERE r2.rate_card_id = r.rate_card_id
       AND r2.supplier_id IS NOT DISTINCT FROM r.supplier_id
       AND r2.effective_from = r.effective_to + INTERVAL '1 day'
       AND r2.rate_status = 'PUBLISHED'
   );
   -- (same for lcl_rates)
   ```
2. Confirmed only 5 legitimate user-set `effective_to` values remain in FCL (none in LCL)
3. Rewrote `019_rate_data_quality.sql` — Part 2 removed, comment added explaining why

**Architecture decision:** Overlapping open-ended records are handled in code, not by modifying
data. The time series builder and detail endpoint must tolerate multiple open-ended records per
supplier and pick the correct dominant rate per month.

**Prod DB:** Migration 019 was never applied to prod — no rollback needed there.

---

### 2. Detail Endpoint Seed Exclusion — Fixed (MCP Direct)

**Root cause of sparkline gaps:** In `get_fcl_rate_card` and `get_lcl_rate_card`, seed records
were excluded when a window record existed for the same supplier:
```python
# WRONG — causes gaps for months before latest rate's effective_from
rate_rows = list(window_rows) + [r for r in seed_rows if r[2] not in window_suppliers]
```

**Fix:** Always include seed records. The frontend `getDominantRate` handles multiple records
per supplier by sorting DESC and selecting the correct one per month:
```python
# CORRECT
rate_rows = list(window_rows) + list(seed_rows)
```

**Files modified (MCP direct):**
- `af-server/routers/pricing/fcl.py`
- `af-server/routers/pricing/lcl.py`

**Result:** Sparklines restored across full history. ✅

---

## Current State

### Sparkline / Expanded Panel Behaviour
- List view time series: seed+window pattern in `list_fcl_rate_cards` — working correctly
- Detail view (expanded panel): seed+window with full merge — working correctly
- "Since 01 Feb 2026" label on COSCO: correct — reflects `effective_from` of current active rate
- Data is forward-looking by design — accepted assumption for now, will test with this

### Migration Status
| Migration | Description | Local | Prod |
|-----------|-------------|-------|------|
| 016 | rate_status enum: DRAFT + REJECTED | ✅ | ✅ |
| 017 | fcl_rates + lcl_rates: effective_to DATE | ✅ | ✅ |
| 018 | fcl_rates + lcl_rates: surcharges JSONB | ✅ | ⚠️ Pending |
| 019 | Inverted date fix only (Part 2 removed) | ✅ | ⚠️ Pending (safe) |

### Outstanding Items
| # | Issue | Status |
|---|-------|--------|
| 1 | Migration 018 on prod DB | ⚠️ Must run before deploying v5.38+ to prod |
| 2 | Migration 019 on prod DB | ⚠️ Pending — safe to run (Part 1 only) |
| 3 | "Update" supersede flow doesn't auto-terminate previous rate | 🔧 Backlog — UX improvement |

---

## Key File Locations
| File | Notes |
|------|-------|
| `af-server/routers/pricing/fcl.py` | Seed merge fix (session 63) |
| `af-server/routers/pricing/lcl.py` | Seed merge fix (session 63) |
| `af-server/migrations/019_rate_data_quality.sql` | Part 2 removed — Part 1 only |
| `claude/prompts/PROMPT-CURRENT.md` | No pending prompt |
| `claude/prompts/log/PROMPT-LOG-v5.41-v5.50.md` | v5.41–v5.48 logged |
| `claude/tests/AF-Test-Master.md` | v2.61 — 272/286 |
