# Handover — 2026-03-12 — Session 113 End — v6.24 Live

## Session Header
AF Dev — Session 113 | AcceleFreight v2 | v6.24 Live | No prompt ready | Tests v2.61 (272/286)

---

## What Was Done This Session

### v6.20-A — Air List Price Structural Refactor: Backend ✅ (ran on entry)
Already running when session started. Confirmed complete in log. See session 112 handover for full context.

### v6.21 — Container/Seal Fix Attempt (one-line) ✅ then ⚠️
Single-line fix `order.order_id` → `order.quotation_id` in `TypeDetailsCard.handleSave`. Correct fix, but save still failed — pointed to a deeper server-side issue.

### v6.22 — Container/Seal Full Diagnosis ✅
Opus confirmed v6.21 fix was correctly applied and no other frontend/action bugs found. Added diagnostic console.logs to `_components.tsx` and `shipments-write.ts`. Save continued to fail — redirected diagnosis to Cloud Run pg8000 JSONB compatibility.

### v6.23 — JSONB Write Audit: All Shipment Routers ✅ CONFIRMED WORKING
**Root cause identified and fixed:** `CAST(:param AS jsonb)` in SQLAlchemy `text()` statements is pg8000-incompatible on Cloud Run — the driver does not coerce string params to JSONB, causing updates to silently no-op.

Opus audited all 8 shipment router files and fixed **47 occurrences**:
- `core.py`, `bl.py`, `doc_apply.py`, `route_nodes.py`, `status.py`, `scope.py`, `tasks.py`, `_status_helpers.py`
- Fix pattern: `CAST(:param AS jsonb)` + `.bindparams(bindparam("param", type_=String()))` on the `text()` object
- Note: `::jsonb` shorthand broke SQLAlchemy text() param parsing (KeyError), so CAST syntax retained with bindparam type annotation
- Container/seal save confirmed working on prod after deploy ✅

### v6.24 — Air List Price UI (v6.20-B Frontend) ✅
Wired air freight expanded panel and rate modal to new list price tables:
- `_air-expanded-panel.tsx`: `priceRefRates` now reads from `detail.list_price_rates` (was `rates_by_supplier['null']`). Added `isListPriceRateId` helper. `handleTerminate` branches on list price vs supplier. `isListPrice` + `listPriceCardId` props passed to modal.
- `_air-rate-modal.tsx`: Added `isListPrice` + `listPriceCardId` props. Save branches — list price creates → `createAirListPriceRateAction(listPriceCardId)`, list price edits → `updateAirListPriceRateAction(rateId)`, supplier ops → existing actions unchanged.

---

## Key Learning This Session

**pg8000 / Cloud Run JSONB write incompatibility** — `CAST(:param AS jsonb)` in SQLAlchemy `text()` statements silently no-ops on Cloud Run (pg8000 driver). Fix is to add `.bindparams(bindparam("param_name", type_=String()))` to the `text()` object. This must be applied to **all routers**, not just shipments. The pricing routers (`fcl.py`, `lcl.py`, `air.py`, `haulage.py`) should be audited in a future session.

**Reduced MCP dependency** — agreed new rule: MCP reads for context only; all file edits go through Opus regardless of size. No direct MCP edits to component or router files.

---

## Immediate Cleanup Needed (next prompt)

Console.logs added during diagnosis are still live in production:
- `af-platform/src/app/(platform)/shipments/[id]/_components.tsx` — `console.log('[TypeDetailsCard] save payload:', ...)`
- `af-platform/src/app/actions/shipments-write.ts` — `console.log('[updateTypeDetailsAction] url:', ...)`

These should be removed in a small cleanup prompt (v6.25) before moving on.

---

## Backlog

| Item | Priority | Notes |
|---|---|---|
| v6.25 — Remove diagnostic console.logs | ⚠️ Immediate | Two files: `_components.tsx` + `shipments-write.ts` |
| JSONB audit — pricing routers | 🔶 High | Same pg8000 bug likely exists in `fcl.py`, `lcl.py`, `air.py`, `haulage.py` |
| Air freight UI verification on prod | 🔶 High | v6.24 deployed — verify list price sparkline + modal actions |
| Quotation module | ⏳ Deferred | After air freight stabilises |
| TD-02: drop deprecated flat surcharge columns | Deferred | |
| Drop `supplier_id IS NULL` rows from `air_freight_rates` | Deferred | After v6.24 confirmed |
| UI-17: per-user country preference | Deferred | |
| Retrofit hard FK to existing pricing tables | Backlog | |

---

## Active Prompt
None — `PROMPT-CURRENT.md` is clear.

---

## Test Status
**v2.61 — 272/286 passing** — no new test series this session (bug fixes + pricing UI, no new user-facing features requiring new test series).

---

## Key File Locations

| Area | Path |
|---|---|
| Air expanded panel | `af-platform/src/app/(platform)/pricing/air/_air-expanded-panel.tsx` |
| Air rate modal | `af-platform/src/app/(platform)/pricing/air/_air-rate-modal.tsx` |
| Air rate list | `af-platform/src/app/(platform)/pricing/air/_air-rate-list.tsx` |
| Shipment components (console.logs) | `af-platform/src/app/(platform)/shipments/[id]/_components.tsx` |
| Shipment write actions (console.logs) | `af-platform/src/app/actions/shipments-write.ts` |
| Shipment routers (JSONB fix applied) | `af-server/routers/shipments/` |
| Pricing routers (JSONB audit pending) | `af-server/routers/pricing/` |
| Prompt log | `claude/prompts/log/PROMPT-LOG-v6.21-v6.30.md` |

---

## Session Startup Instructions (Next Session)
```
Read files:
- claude/handover/handover-2026-03-12-session-end-v124.md
- claude/tests/AF-Test-Master.md
- claude/prompts/log/PROMPT-LOG-v6.21-v6.30.md (tail:15)
```

Display session header:
**AF Dev — Session 114 | AcceleFreight v2 | v6.24 Live | No prompt ready | Tests v2.61 (272/286)**

### First actions next session:
1. Write v6.25 — strip diagnostic console.logs from `_components.tsx` and `shipments-write.ts`
2. Write v6.26 — JSONB audit for pricing routers (`fcl.py`, `lcl.py`, `air.py`, `haulage.py`)
3. Verify v6.24 air list price UI on prod
