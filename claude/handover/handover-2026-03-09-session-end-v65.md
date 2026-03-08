# AF Dev Handover — Session 65 End
**Date:** 2026-03-09  
**Version Live:** v5.22  
**Last Prompt Executed:** v5.55  
**Tests:** v2.61 — 272/286 (unchanged this session)

---

## What Was Done This Session

### v5.51 — LCL Min Quantity + FCL Min Fields Removal ✅
Removed `min_list_price` / `min_cost` from FCL entirely. Renamed `min_cost` → `min_quantity` on LCL supplier rows. Migration 020 run on local DB. Prod pending (run after 018).

### v5.52 — Terminal Name on Rate Card Display ✅
LEFT JOIN `port_terminals` in FCL + LCL list/detail endpoints. `terminal_name` added to `RateCard` interface. Indigo badge on rate card row when terminal assigned. Resolves MYPKG duplicate visual identity issue.

### v5.53 — Alert Badges Scenarios 1 & 2 ✅ + MCP row highlight fix
Replaced `hasMarginAlert` with `getAlertLevel` returning `AlertLevel` type. Red badge = cost exceeds price, Amber badge = no list price. Full row highlight + `border-l-2` accent added directly via MCP (was cell-only tinting from Opus). Row highlight bug fixed via MCP (expanded state was masking alert background — decoupled bg from border).

### v5.54 — Dashboard Alert Counts + Scenario 3 ✅
Dashboard `ActiveCard` shows alert tray (red/amber/yellow dot lines). Backend: 3 alert count queries added to `dashboard-summary`. `latest_cost_from` / `latest_list_price_from` added to rate card response. Scenario 3 badge: yellow "Price review needed".

### v5.55 — Issues Filter + Dashboard Navigation Links ✅
"Issues only" toggle button on FCL/LCL rate card tabs — bypasses origin requirement, fetches cross-origin alert cards. Backend: `alerts_only` query param with 3-scenario WHERE clause. Dashboard alert tray lines converted to `Link` components navigating to rate card tab with `?alerts=<scenario>` pre-set.

### MCP Direct Fixes
- `_expanded-panel.tsx` — `+ Set List Price` button when no list price rate exists
- `_rate-modal.tsx` — surcharges section hidden for list price modal (`!isListPriceMode`)

---

## Current State

### Migration Status
| Migration | Local | Prod |
|---|---|---|
| 018 — surcharges JSONB | ✅ | ✅ |
| 019 — inverted date fix | ✅ | ⚠️ Rolled back — safe to skip |
| 020 — lcl min_quantity rename | ✅ | ⚠️ Pending — run after 018 |

### No Active Prompt
`PROMPT-CURRENT.md` is clear. No pending Opus work.

---

## Key File States

| File | Last Modified By | Notes |
|---|---|---|
| `af-server/routers/pricing/fcl.py` | v5.55 | `alerts_only` param, terminal join, latest_*_from batch query |
| `af-server/routers/pricing/lcl.py` | v5.55 | Same as fcl.py |
| `af-server/routers/pricing/__init__.py` | v5.54 | 3 alert count queries in dashboard-summary |
| `af-platform/src/app/actions/pricing.ts` | v5.55 | `alertsOnly`, `terminal_name`, `latest_*_from`, alert counts on DashboardComponentSummary |
| `af-platform/src/app/(platform)/pricing/_helpers.ts` | v5.54 | `getAlertLevel` with 3-scenario AlertLevel type |
| `af-platform/src/app/(platform)/pricing/_rate-list.tsx` | MCP | Row highlight decoupled (bg vs border-l); all 3 alert badges |
| `af-platform/src/app/(platform)/pricing/_rate-cards-tab.tsx` | v5.55 | `showIssuesOnly` state + toggle + origin bypass |
| `af-platform/src/app/(platform)/pricing/_expanded-panel.tsx` | MCP | `+ Set List Price` button when no list price |
| `af-platform/src/app/(platform)/pricing/_rate-modal.tsx` | MCP | Surcharges hidden for list price mode |
| `af-platform/src/app/(platform)/pricing/_dashboard.tsx` | v5.55 | Alert tray as Link components |

---

## What's Next (Suggested)

- **Prod deployment** — migration 020 needs to run on prod before deploying v5.51+ backend changes
- **Pricing module** appears largely complete for core data entry + alerting. Natural next area: **Quotation module** (designed in earlier sessions, implementation not yet started)
- **Geography → Pricing → Quotation workstream** — verify implementation status before starting quotation work
- **Ground transportation design** — separate plan, not yet scoped
