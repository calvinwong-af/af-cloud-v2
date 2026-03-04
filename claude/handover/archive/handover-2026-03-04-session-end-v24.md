# Session Handover — Session 24 → Session 25
**Date:** 04 March 2026
**Platform:** AcceleFreight v2 (af-cloud-v2)
**Session type:** Debugging + Design + Prompt Prep

---

## What Was Done This Session

### 1. cloudbuild.yaml — ANTHROPIC_API_KEY secret added
- `af-server/cloudbuild.yaml` updated to include `ANTHROPIC_API_KEY=anthropic-api-key:latest` in `--set-secrets`
- Secret Manager name is `anthropic-api-key` (lowercase hyphenated) — confirmed from GCP Console
- Previously the key was being dropped on every Cloud Build deployment

### 2. Port Geocoding — All 371 ports populated
- Created `af-server/scripts/geocode_ports.py` (via Opus)
- First run: 341/371 succeeded (rate limiting at 0.1s delay)
- Delay increased to 0.5s, second run: 30/30 remaining succeeded
- All ports now have lat/lng in PostgreSQL

### 3. Ports API — lat/lng added to response
- `af-server/routers/ports.py` — both `GET /ports` and `GET /ports/{un_code}` now return `lat` and `lng`
- Previously the SELECT query omitted these columns so map always showed "coordinates not set"

### 4. Route Map — Still not rendering (investigation deferred)
- After API fix and deployment, map still shows "Map unavailable — port coordinates not set"
- Next step: check browser network tab → `/api/v2/ports` response to confirm lat/lng values present in JSON
- Module-level cache in `af-platform/src/lib/ports.ts` (`_portsCache`) ruled out as cause after hard refresh

### 5. BL Upload — Status progression design discussion
- Identified that CNF/EXPORT shipments stay at Booking Confirmed after BL upload even when on-board date is in the past
- Root cause: `_is_booking_relevant("CNF", "EXPORT")` returns True → forces STATUS_BOOKING_CONFIRMED
- Also identified missing `atd` concept — system only has `etd` flat column, no actual departure tracking
- Both issues folded into the v4.03 redesign prompt (see below)

### 6. v4.03 Prompt Written — Route Node Timing Redesign
- Full prompt written to `claude/prompts/PROMPT-CURRENT.md`
- Ready to pass to Opus in VS Code

---

## v4.03 Design — Detailed Breakdown

This is the most important section for the next session. Read carefully before starting.

---

### The Problem Being Solved

Currently timing data is **scattered across three places** and they are not always in sync:

| Field | Location | What it stores |
|---|---|---|
| `shipments.etd` | Flat column | Estimated departure — written by BL apply, BC apply, manual edit |
| `shipments.eta` | Flat column | Estimated arrival — written by BL apply, BC apply, manual edit |
| `route_nodes[n].scheduled_etd` | JSONB on shipments | Per-leg estimated departure |
| `route_nodes[n].scheduled_eta` | JSONB on shipments | Per-leg estimated arrival |
| `route_nodes[n].actual_etd` | JSONB on shipments | Per-leg actual departure (ATD) |
| `route_nodes[n].actual_eta` | JSONB on shipments | Per-leg actual arrival (ATA) |

The Route Card (top of shipment detail) reads from the **flat columns** (`etd`/`eta`).
The Route Node legs (Leg 4, Leg 5 cards) read from **route_nodes JSONB**.
The Shipment Status node is updated **manually** by the operator.

This means:
- Updating ATD on the Leg card does NOT update the Route Card
- Departing a vessel requires the operator to BOTH update the node AND manually advance status
- There is no single place to look for the current state of timing

---

### The Fix — Single Source of Truth

**`route_nodes` JSONB becomes the single source of truth for all timing.**

#### Data ownership after this change:

| Data | Owned By | Notes |
|---|---|---|
| Port identity (which port) | `shipments.origin_port` / `dest_port` | Unchanged — shipment level |
| Terminal identity | `shipments.origin_terminal` / `dest_terminal` | Unchanged — shipment level |
| Estimated departure (ETD) | `route_nodes[ORIGIN].scheduled_etd` | **Route node owns it** |
| Estimated arrival (ETA) | `route_nodes[DESTINATION].scheduled_eta` | **Route node owns it** |
| Actual departure (ATD) | `route_nodes[ORIGIN].actual_etd` | **Route node owns it** |
| Actual arrival (ATA) | `route_nodes[DESTINATION].actual_eta` | **Route node owns it** |
| `shipments.etd` flat column | Derived copy | Written from ORIGIN node — never edited directly |
| `shipments.eta` flat column | Derived copy | Written from DESTINATION node — never edited directly |

#### What is being DEPRECATED (no longer directly editable):
- `shipments.etd` — becomes read-only derived field, synced from route node
- `shipments.eta` — becomes read-only derived field, synced from route node
- Any frontend input that writes directly to flat `etd`/`eta` without going through route nodes

#### What is NOT changing:
- Route node structure (`route_nodes` JSONB schema stays the same)
- Port assignment staying at shipment level
- V1 legacy fallback — if `route_nodes` is empty, Route Card reads flat `etd`/`eta` for display only (no edit)

---

### Auto Status Progression

When timing is updated on a route node via `PATCH /route-nodes/{sequence}`, the backend checks:

| Trigger | Condition | Auto Action |
|---|---|---|
| `actual_etd` set on ORIGIN node | New value is non-null AND current status < 4001 | Status → **Departed (4001)** |
| `actual_eta` set on DESTINATION node | New value is non-null AND current status < 4002 | Status → **Arrived (4002)** |
| `actual_etd` cleared/changed on ORIGIN node | Any | **No auto action** — manual fix only |
| `actual_eta` cleared/changed on DESTINATION node | Any | **No auto action** — manual fix only |

**Key rule: forward-only, never auto-revert.**

Status constants already exist in `core/constants.py`:
- `STATUS_DEPARTED = 4001` ✅
- `STATUS_ARRIVED = 4002` ✅

When auto-advancing, append to `shipments.status_history` JSONB:
```json
{
  "status": 4001,
  "label": "Departed",
  "timestamp": "<now>",
  "changed_by": "<claims.email>",
  "note": "Auto-advanced from ATD"
}
```

---

### Terminal Selection in Edit Port Modal

**Current state:** Edit Port modal has a single search → select port → Save. No terminal step.

**Problem:** For MYPKG (Port Klang), there are two terminals: Westports and Northport. Currently no way to select between them in the modal.

**New behaviour:**
- Step 1: Search and select port (unchanged)
- Step 2: If `port.has_terminals = true` → show terminal picker (pill/button list)
  - Source: `port.terminals[]` array from the ports API
  - Auto-select the terminal where `is_default = true`
- Step 3: Save → writes `port_un_code` + `terminal_id` to shipment
- If `has_terminals = false` → skip Step 2, Save immediately after port selection

Port assignment remains at **shipment level** (`origin_port`, `origin_terminal`, `dest_port`, `dest_terminal`). Route nodes are not involved in port identity.

---

### Frontend Display Changes

**Route Card** (top of shipment detail page — shows Origin/Destination with ETD/ETA):
- Currently reads: `shipments.etd` / `shipments.eta` flat columns
- After change: reads from route nodes
  - ORIGIN node `scheduled_etd` → show as ETD
  - ORIGIN node `actual_etd` → show as ATD (replaces ETD when set)
  - DESTINATION node `scheduled_eta` → show as ETA
  - DESTINATION node `actual_eta` → show as ATA (replaces ETA when set)
- Fallback: if no route nodes → read flat columns (legacy display only)

**Route Node Leg cards** (Leg 4 = POL, Leg 5 = POD):
- Already show ETA/ETD/ATA/ATD fields ✅
- Confirm ATA/ATD are wired to `PATCH /route-nodes/{sequence}` — if not, wire them

---

## Test Status (unchanged this session)

| Suite | Total | YES | PENDING | DEFERRED | NA | Status |
|---|---|---|---|---|---|---|
| All series | 284 | 270 | 0 | 12 | 9 | — |

**Overall: 270/284 passing**

New test series for v4.03 features to be added after verification.

---

## Pending Actions (in order)

1. **Pass v4.03 prompt to Opus** in VS Code
2. **Debug Route Map** — check network tab for `/api/v2/ports` lat/lng in JSON response on prod
3. **After v4.03 verified:** Add new test series (RN = Route Nodes, EP = Edit Port terminal)
4. **Backlog item noted:** BL apply status progression for CNF/EXPORT — when on-board date is past, should advance to Departed not stay at Booking Confirmed (deferred to after v4.03)

---

## Open Backlog (unchanged)

| # | Item | Priority |
|---|---|---|
| UI-01 | Keyboard arrow nav on all combobox/dropdowns | Low |
| UI-02/04 | Port list filtered by freight type in PortEditModal | Low |
| UI-03 | Port edit pencil icon position on RouteCard | Low |
| UI-05 | No ability to edit order details on detail page | Medium |
| UI-09 | Read File opens legacy dialog (all doc types) | Medium |
| BL-01 | CNF/EXPORT BL apply should advance to Departed when on-board date is past | Medium |

---

## Architecture Notes (unchanged)

- Production: `https://af-server-667020632236.asia-northeast1.run.app`
- Frontend: `appv2.accelefreight.com` | API: `api.accelefreight.com`
- All shipment records use `AF-` prefix (V1 legacy + V2 native)
- Python venv: `.venv` (Python 3.11) — always use this, not system Python 3.14

---

## Key File Locations

| Item | Path |
|---|---|
| Current prompt | `claude/prompts/PROMPT-CURRENT.md` (v4.03 — ready for Opus) |
| Prompt log | `claude/prompts/log/PROMPT-LOG-v4.01-v4.10.md` |
| Test master | `claude/tests/AF-Test-Master.md` |
| API contract | `claude/other/AF-API-Contract.md` (v1.4) |
| Route nodes router | `af-server/routers/shipments/route_nodes.py` |
| Ports router | `af-server/routers/ports.py` |
| Status constants | `af-server/core/constants.py` |
| Cloud build config | `af-server/cloudbuild.yaml` |
| Geocode script | `af-server/scripts/geocode_ports.py` |
