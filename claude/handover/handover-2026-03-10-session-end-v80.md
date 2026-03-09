# AF Dev Handover — Session End
**Date:** 2026-03-10
**Session:** 80
**Version Live:** v5.69 (no deployment this session)
**Last Prompt Executed:** v5.77 (complete) — v5.78 written, pending Opus execution
**Tests:** v2.61 — 272/286 (unchanged)

---

## What Was Done This Session

### v5.77 verified clean
- `GET /api/v2/pricing/port-transport/vehicle-types` — confirmed routing working
- `GET /api/v2/pricing/port-transport/areas` — fixed 500 error (MCP direct edit: `s.state_name` → `s.name AS state_name` in areas query)
- `GET /api/v2/pricing/dashboard-summary` — confirmed working; `/dashboard` 404 was a test URL error, not a real issue
- Dashboard shows `port-transport` key with zeros (expected — migration not yet run)

### Migration dry run completed
- 327 rate cards would migrate successfully
- Vehicle type mapping clean: `{1: lorry_1t, 3: lorry_3t, 5: lorry_5t, 10: lorry_10t}`
- 203 skipped (area not found) — international areas + some missing MY codes
- 11 skipped (tonnage=20 not in vehicle_types)
- 7 skipped (trashed)
- 0 rates reported — **known dry run bug**: `card_map[pt_id] = -1` placeholder causes all rates to skip; live run will work correctly

### Two pre-migration issues identified
1. **MYPKG_N → terminal_id:** Legacy system used `MYPKG_N` as a pseudo port code for Northport. DB already has `terminal_id = 'MYPKG_N'` in `port_terminals`. Schema needs `terminal_id` column on `port_transport_rate_cards`.
2. **Missing areas:** `MY-KUL-000` and `MY-MLK-000` don't exist in areas table (catch-all KL/Melaka zones). Need to be seeded.

### v5.78 prompt written (PROMPT-CURRENT.md)
Covers:
- Task A: Rewrite migration 026 with DROP+recreate — add `terminal_id` column, update unique constraint to `(port_un_code, terminal_id, area_id, vehicle_type_id)`, add terminal index
- Task B: Seed `MY-KUL-000` (Kuala Lumpur General) and `MY-MLK-000` (Melaka General) into areas table
- Task C: Backend router — `terminal_id` on Pydantic model, helper, SELECTs, create INSERT, list filter
- Task D: Migration script — `MYPKG_N` normalisation map, updated `rate_card_key` format, updated INSERT, dry run 0-rates bug fix
- Task E: Frontend types — `terminal_id` on `PortTransportRateCard` interface

### Open design question (deferred to next session)
International area codes (203 skipped in dry run): legacy Datastore has transport pricing for overseas delivery zones (CN, VN, HK, DE, AE, etc.) attached to foreign port codes. These are real pricing data and should be preserved. Two options discussed:
1. **Migrate as-is with NULL state_code** — insert legacy international area codes into `areas` table, standardise codes later (preferred given Calvin's note)
2. Separate international delivery zones table (cleaner long-term, more work now)

Decision deferred to next session. Do not execute v5.78 until this is resolved — the migration script changes in v5.78 may need a Task F added for international area upsert pre-step.

---

## Immediate Next Steps (Next Session)

1. **Resolve international areas design question** — Option 1 (migrate as-is) vs Option 2 (separate table). If Option 1, add Task F to v5.78 prompt: pre-step in migration script to upsert missing city_codes from Datastore into areas table with NULL state_code
2. **Execute v5.78** via Opus
3. **Re-run dry run** after v5.78 — verify MYPKG_N cards show as `MYPKG:MYPKG_N:area_id:vehicle_type_id`, verify non-zero rates count
4. **Run live migration**
5. **Deploy** migration 026 (prod) + backend + frontend

---

## Known Deferred Items

- **PR-02** — Orphan open-ended supplier rows migration cleanup (broader script deferred)
- **PR-03** — `expiring_soon` dashboard query overcounts (FCL: 408/408, LCL: 211/211 all flagged)
- **PR-01** — Surcharge model clarification — review before Quotation
- **UI-17** — Per-user default country preference
- **TD-02** — Drop deprecated flat surcharge columns from FCL/LCL tables
- **gen_transport module** — type 1 general delivery, future scope
- **cb_transport module** — type 3 cross-border, future scope
- **Quotation workstream** — after port_transport complete
- **Operations Playbook** — deferred (Jermaine to participate)
- **AI agent phases** — deferred until core platform complete

---

## Migrations State

| # | File | Local | Prod |
|---|---|---|---|
| 020–025 | All migrations | ✅ | ✅ |
| 026 | `026_transport_pricing.sql` (needs rewrite for terminal_id) | ⚠️ Old tables exist, need drop+recreate | ⏳ Pending |

---

## Architecture Decisions (Locked)
- `port_transport_rate_cards.terminal_id` — nullable FK to `port_terminals`, NULL = no terminal distinction (Westport default), `MYPKG_N` = Northport
- `rate_card_key` format: `PORT:area_id:vehicle_type_id` (no terminal) or `PORT:TERMINAL:area_id:vehicle_type_id` (with terminal)
- Three transport table pairs: `port_transport_`, `gen_transport_`, `cb_transport_` (latter two future)
- `shipments.etd` / `shipments.eta` deprecated; POL/POD task legs are source of truth
- BC writes scheduled timing only; BL/AWB writes actual timing only
- Forward-only status progression
- All shipment records use `AF-` prefix; `AFCQ-` retired
- af-web (Vue public site) parked indefinitely
