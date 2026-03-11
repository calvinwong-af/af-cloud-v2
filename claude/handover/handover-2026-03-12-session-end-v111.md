# AF Dev — Session 107 Handover
**Date:** 2026-03-12 | **Last Prompt:** v6.11 (ready, not yet executed) | **Next Session:** 108

---

## Session Summary

This session completed the air freight pricing module (v6.10) and prepared the FCL/Haulage
inline surcharge total retrofit (v6.11). The session also ran a full data audit confirming
zero integer status anomalies in prod following the v6.09 fix.

### Data audit result
All three audit queries returned zero rows — `orders` table is fully clean. No residual
integer status values in either active or trashed shipments.

### Prompts completed this session
- **v6.10** — Air Freight Pricing: Backend + UI + Resolve Endpoint. Status: **Completed by Opus.**
- **v6.11** — FCL + Haulage Inline Surcharge Totals. Status: **Written, not yet executed.**

---

## v6.10 scope (completed)

- `af-server/routers/pricing/air.py` — new router, ~15 endpoints including resolve endpoint
- `af-server/routers/pricing/__init__.py` — air router registered
- `af-platform/src/app/actions/pricing.ts` — AirRateCard, AirTimeSeries, AirRate, AirResolveResult types + 12 actions
- `af-platform/src/components/shell/Sidebar.tsx` — Air Freight unlocked
- 5 new UI files under `af-platform/src/app/(platform)/pricing/air/`
- tsc + lint pass clean
- Migration 040 SQL and migrate_air_pricing.py were already run — data is in prod

---

## v6.11 scope (ready for Opus)

Backend-only change. No migrations, no frontend changes.

**Files:** `af-server/routers/pricing/fcl.py` and `af-server/routers/pricing/haulage.py`

**What it adds:**
- `total_list_price` and `total_cost` computed fields to time series entries (both is_future and not-is_future branches)
- `list_surcharge_total` and `total_list_price` to the `latest_price_ref` block (requires adding `surcharges` to the DISTINCT ON query)
- All existing fields remain unchanged

Opus must create `claude/prompts/log/PROMPT-LOG-v6.11-v6.20.md` as a new log file starting with the v6.11 entry.

---

## Current state

| Item | Status |
|---|---|
| Data audit (integer status) | ✅ Clean — zero anomalies |
| v6.10 Air freight backend + UI | ✅ Complete |
| Air freight data migration | ✅ Applied to prod |
| v6.11 FCL + Haulage totals | ⏳ Prompt ready — execute next |
| PROMPT-CURRENT.md | v6.11 loaded |

---

## Immediate next actions

1. **Execute v6.11** — hand PROMPT-CURRENT.md to Opus
2. **Test air freight UI** — Calvin to verify breakpoint grid display, resolve endpoint, surcharge tooltips
3. **v6.12 (next prompt)** — LCL resolve endpoint (mirrors air resolve pattern, no breakpoints)

---

## Active backlog

| Item | Status |
|---|---|
| v6.11: FCL + Haulage inline totals | ⏳ Ready to execute |
| v6.12: LCL resolve endpoint | Next after v6.11 |
| Air Freight pricing UI testing | Pending Calvin |
| Quotation module | Next major workstream after pricing stable |
| TD-02: drop deprecated flat surcharge columns | Deferred |
| UI-17: per-user country preference | Deferred (schema migration needed) |
| Gen transport + cross-border | No data, deferred |
| Operations Playbook | Deferred until platform complete |

---

## Key architectural decisions made this session

**Server-side total calculation** — agreed that computed totals (base + surcharges) belong
on the backend, not the frontend. Classification:
- FCL + Haulage: inline total fields in rate responses (v6.11)
- LCL + Air: dedicated resolve endpoints taking quantity input (air done in v6.10; LCL in v6.12)

**Air freight min charge logic** — surcharge applies on actual weight even when min charge
floor is triggered:
```
total = min_rate + (actual_weight × surcharge_total_per_kg)   # when min applies
total = (actual_weight × tier_rate) + (actual_weight × surcharge_total_per_kg)  # normal
```

**Air freight UI** — breakpoint grid table (not sparkline) in expanded panel. l45 tier used
as representative single-figure summary in the time series card list view.

---

## Key file locations

| Area | Path |
|---|---|
| Air freight router | `af-server/routers/pricing/air.py` |
| Air freight UI | `af-platform/src/app/(platform)/pricing/air/` |
| Prompt log v6.01–v6.10 | `claude/prompts/log/PROMPT-LOG-v6.01-v6.10.md` |
| Prompt log v6.11+ | `claude/prompts/log/PROMPT-LOG-v6.11-v6.20.md` (created by Opus after v6.11) |
| Active prompt | `claude/prompts/PROMPT-CURRENT.md` |
