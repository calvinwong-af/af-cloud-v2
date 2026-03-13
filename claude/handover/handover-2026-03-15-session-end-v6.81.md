# AF Dev Handover — Session 133 End
**Date:** 2026-03-15
**Session:** 133
**Version at close:** v6.81 (prompt written, not yet executed)
**Live on Cloud Run:** v6.73
**Tests:** v2.61 (272/286)

---

## Session Summary

Long session focused entirely on the quotation module — specifically the scope configuration
architecture and the relationship between scope, area assignment, and the quotation pricing engine.
The session involved significant architectural debate and course corrections before landing on the
correct design.

### Key Architectural Decisions Made

1. **Scope is task modes only** — `shipment_details.scope` is a denormalised cache of task modes
   (ASSIGNED/TRACKED/IGNORED). It holds nothing else. No area, no transport details.

2. **Area lives on GT order stops** — `order_stops.area_id` is the single source of truth for
   haulage area. Set via ScopeConfigModal (which writes to GT order stops), readable by the
   quotation pricing engine via `_get_gt_area_id()`.

3. **Quotations hold pricing only** — `quotation.transport_details` was wrong and removed.
   Quotations do not store any operational shipment data beyond `scope_snapshot` and `notes`.

4. **ScopeConfigModal is the single entry point for scope + area** — unified across shipment page,
   quotation page, and create quotation flow. When saving area for a haulage leg, it creates a
   draft GT order if none exists, or updates the existing stop.

---

## Versions Completed This Session

| Version | Description | Status |
|---|---|---|
| v6.74 | UOM abbreviation + New Rate Modal UX fix | ✅ Complete |
| v6.75 | Fix customs pricing UOM-aware qty resolution | ✅ Complete |
| v6.76 | Scope standardisation: TLX Release migration + unified scope UI | ✅ Complete |
| v6.77 | Scope UI tweaks + area editing in Configure Scope | ✅ Complete |
| v6.78 | Unified ScopeConfigModal (replaces all 3 scope components) | ✅ Complete |
| v6.79 | Scope/area architecture cleanup (drop scope_transport + transport_details) | ✅ Complete |
| v6.80 | Restore area assignment → GT order stop | ✅ Complete |
| v6.81 | Enriched quotation summary card | ✅ Prompt written, NOT executed |

---

## Pending Before Deploy

### Critical — must be done before Cloud Run deploy:

1. **Run migration 061** — drops `scope_transport` from `shipment_details` and
   `transport_details` from `quotations`. Runner: `run_migration_061.py`.
   ⚠️ Migration 060 already ran on prod (added `scope_transport`); migration 061 drops it again.

2. **Fix single GET /quotations/{ref}** — Opus completed v6.79 but missed this one endpoint.
   The single GET still has the old `q.transport_details` in the SELECT and is missing
   `sd.origin_port`, `sd.dest_port`. This causes a 500 on the quotation detail page.
   
   **Manual fix needed** in `af-server/routers/quotations.py` around the `get_quotation`
   endpoint (~line 1800). Change the SELECT from:
   ```sql
   q.scope_snapshot, q.transport_details, q.notes, ...
   sd.incoterm_code,
   sd.transaction_type
   ```
   To:
   ```sql
   q.scope_snapshot, q.notes, ...
   sd.incoterm_code,
   sd.transaction_type,
   sd.origin_port,
   sd.dest_port
   ```
   This fix is also included in the v6.81 prompt — Opus will handle it when v6.81 executes.

3. **Execute prompt v6.81** — enriched quotation summary card. Run in Opus.

---

## Current Issues (Unresolved at Session End)

### Issue 1: Quotation detail page 500
The single `GET /quotations/{ref}` returns 500 because `q.transport_details` was dropped by
migration 061 but the backend code still references it. The uvicorn server is running but this
endpoint fails. Fix described above in "Pending Before Deploy #2".

### Issue 2: v6.81 not yet executed
The enriched two-column shipment overview card on the quotation page is designed and prompted
but not yet built. The quotation page currently shows only the flat scope list (no shipment info,
no area names).

---

## Architecture Reference (locked)

### Scope
- Scope flags stored on `shipment_details.scope` (JSONB) — values: `ASSIGNED/TRACKED/IGNORED`
- `tlx_release` stored on `shipment_details.tlx_release` (boolean) — since migration 059
- Scope keys: `first_mile`, `export_clearance`, `import_clearance`, `last_mile`
- `freight` removed from scope — was wrong, never needed
- `scope_transport` — added in migration 060, removed in migration 061. Never use.

### Area / Transport
- `order_stops.area_id` — single source of truth for haulage area
- GT order linked to shipment via `parent_shipment_id` + `task_ref` + `leg_type`
- `task_ref` values: `ORIGIN_HAULAGE` (first_mile), `DESTINATION_HAULAGE` (last_mile)
- `leg_type` values: `first_mile`, `last_mile`
- ScopeConfigModal creates draft GT order on save if none exists

### Quotations
- `quotations.transport_details` — **DROPPED** in migration 061. Do not reference.
- `quotations.scope_snapshot` — snapshot of scope flags at quotation creation time
- Pricing engine reads area via `_get_gt_area_id(conn, shipment_id, leg_key)` in `quotations.py`
- `_get_gt_vehicle_type(conn, shipment_id, leg_key)` for LCL/AIR vehicle type

### Migrations
- Latest applied: 061 (`DROP scope_transport`, `DROP transport_details`)
- Next migration must be 062+

---

## Key File Paths

| File | State |
|---|---|
| `af-server/migrations/061_cleanup_scope_area.sql` | Applied to prod ✓ |
| `af-server/routers/shipments/scope.py` | v6.79 — no scope_transport |
| `af-server/routers/quotations.py` | v6.79 — BUT single GET has bug (see above) |
| `af-platform/src/app/actions/ground-transport.ts` | v6.80 — has `setHaulageAreaAction` |
| `af-platform/src/app/actions/quotations.ts` | v6.79 — no transport_details |
| `af-platform/src/components/shared/ScopeConfigModal.tsx` | v6.80 — area UI restored → GT order |
| `af-platform/src/components/shipments/CreateQuotationModal.tsx` | v6.80 — port/container props |
| `af-platform/src/app/(platform)/shipments/[id]/page.tsx` | v6.80 — full props passed |
| `af-platform/src/app/(platform)/quotations/[ref]/_components.tsx` | v6.80 — port props passed |

---

## Next Session Start

1. Check `list_directory` on handover + log folders to confirm filenames
2. Read this handover file
3. Session header: `AF Dev — Session 134 | AcceleFreight v2 | v6.73 Live | v6.81 Prompt Ready | Tests v2.61 (272/286)`
4. First action: fix the single GET quotation bug (or confirm Opus fixed it in v6.81)
5. Then: run migration 061 if not already done, execute v6.81 in Opus, deploy v6.74–v6.81

---

## Backlog (unchanged)

- Geography → Tax Rules admin UI
- Manual line item tax application
- `is_domestic` audit on DG Class Charges
- Air freight data migration
- AF-API-Pricing.md update
- Deploy v6.74–v6.81 to Cloud Run
