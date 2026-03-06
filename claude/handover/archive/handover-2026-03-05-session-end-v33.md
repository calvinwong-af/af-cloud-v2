# Handover — 2026-03-05 Session End v33

## Session Header
AF Dev — Session 33 | AcceleFreight v2 | v4.25 Live | v5.00 Prompt Ready | Tests v2.58 (270/284)

---

## Session Summary
Ground transport debugging (Places API autocomplete), GT polish fixes, and a major architectural design session resulting in the v5.00 unified orders architecture prompt.

---

## Completed This Session

### GT Debugging — Places API Autocomplete (GT-03 follow-up)
- Root cause 1: `GOOGLE_MAPS_API_KEY` not in `--set-secrets` in `cloudbuild.yaml` → added
- Root cause 2: API key was website-restricted (HTTP referrer) → created separate server-side key with no application restrictions, API restrictions only (Geocoding + Places + Places New)
- Root cause 3: `locationBias.radius` was 3,000,000m (invalid, max 50,000) → removed locationBias entirely
- New secret `GOOGLE_MAPS_API_KEY` created in Secret Manager
- `.env.example` updated to document `GOOGLE_MAPS_API_KEY` and `ANTHROPIC_API_KEY`
- Autocomplete now working locally and ready for prod deploy

### GT Polish Fixes
- Suggestion dropdown height: 200px → 320px
- Vehicle type / equipment type made mandatory on step 2 (validation on Next button)
- Transport order prefix: `GT-` → `AFDO-`, starting from 731
- Created date added to Order Details card
- Sentence case applied throughout: status badges, transport type, leg type labels
- `Transport Type` → `Transport type`, `Leg Type` → `Leg type` labels
- Debug `console.log` and `logger.warning` removed after diagnosis

### Files Modified (GT fixes)
- `af-server/cloudbuild.yaml` — added `GOOGLE_MAPS_API_KEY` to `--set-secrets`
- `af-server/.env.example` — documented new env vars
- `af-server/routers/ground_transport.py` — removed locationBias, removed debug log, AFDO prefix + 731 seed
- `af-server/core/db_queries.py` — `generate_transport_order_id()` updated (AFDO prefix, start 731, orders table query)
- `af-platform/src/components/ground-transport/AddressInput.tsx` — dropdown height, removed debug log
- `af-platform/src/components/ground-transport/CreateGroundTransportModal.tsx` — mandatory vehicle/equipment validation
- `af-platform/src/app/(platform)/ground-transport/[id]/page.tsx` — created date, sentence case labels
- `af-platform/src/app/(platform)/ground-transport/[id]/_components.tsx` — sentence case status badges

---

## v5.00 Architecture — Unified Orders

### Design Decisions (final, do not revisit)
- Single `orders` table as master index for all order types
- `order_type`: `"shipment"` | `"transport"`
- `transport_mode`: `null` | `"trucking"` | `"haulage"` (delivery and haulage unified as transport)
- Unified `AF-XXXXXX` ID sequence (AFDO prefix for transport orders specifically)
- Shared status spine: `draft → confirmed → in_progress → completed / cancelled`
- `sub_status` nullable string on `orders` — type-aware interpretation
- `order_stops` as source of truth for transport; `order_legs` auto-derived between consecutive stops
- `parties` at order level (commercial); driver/vendor/carrier at leg level (operational)
- `cargo` at order level — one description shared across all legs
- `haulage_areas` → `areas`, `haulage_area_id` → `area_id` (rename throughout)
- `tasks.shipment_id` → `tasks.order_id`
- Hard migration — restructure in place, legacy tables renamed to `_legacy_*` not dropped
- V1 minimum fields retained: order_id, company_id, incoterm, transaction_type, order_type, origin_port, dest_port, status, created_at, migrated_from_v1
- Parallel cutover not needed — hard migration is appropriate given modest schema delta

### New Tables
- `orders` — master index (replaces `shipments`)
- `shipment_details` — freight-specific fields (1:1 with orders)
- `order_stops` — transport stop sequence
- `order_legs` — auto-derived from stops

### Prompt Location
`claude/prompts/PROMPT-CURRENT.md` — v5.00 full prompt ready for Opus

---

## Pending Actions

### Immediate (next session)
- Execute v5.00 prompt via Opus
- Verify migration locally before deploying to prod
- Deploy `af-server` with `GOOGLE_MAPS_API_KEY` secret (push `cloudbuild.yaml` to main)

### After v5.00
- GT smoke test steps 4–8 (paused — needs new architecture in place first)
- SQL backfill for V1 completed records (`completed = TRUE` for status 5001)
- API Contract update for v4.22/v4.24/v5.00 endpoints
- Ground transport list page update (unified orders index)

---

## Test State
- Version: v2.58 | 270/284 passing
- No test changes this session
- v5.00 will require significant test updates — defer to post-migration pass

---

## Key Context for Next Session
- Start with session header: `AF Dev — Session 34 | AcceleFreight v2 | v4.25 Live | v5.00 Prompt Ready | Tests v2.58 (270/284)`
- Read this handover + PROMPT-CURRENT.md at session start
- v5.00 is a large prompt — Opus should execute in phases (Phase 1 DB → Phase 2 Backend → Phase 3 Frontend → Phase 4 Migration Script)
- Do NOT drop legacy tables — rename to `_legacy_shipments` and `_legacy_ground_transport_orders`
- Run migration locally first, verify row counts, then deploy

---

## Key File Paths
- Handover: `claude/handover/handover-2026-03-05-session-end-v33.md`
- Tests master: `claude/tests/AF-Test-Master.md`
- Prompt log: `claude/prompts/log/PROMPT-LOG-v4.21-v4.30.md`
- Active prompt: `claude/prompts/PROMPT-CURRENT.md`
- Backlog: `claude/other/AF-Backlog.md`
- API Contract: `claude/other/AF-API-Contract.md` (v1.5 — needs update post v5.00)
