# Handover Notes — v2.33
**Date:** 01 March 2026
**Session type:** To Invoice Bug Fixes + V1 Badge + Prompt Log Archiving

---

## Session Summary

Long debugging and fix session focused on the To Invoice count showing 17 instead of 8. Root cause was a three-part problem: cancelled V1 records leaking in, 2 V2 records incorrectly appearing, and the V1 badge not rendering on migrated AF- records. Also prepared the prompt log archiving system (v2.32) for Opus.

---

## Prompts Executed This Session

### v2.30 — To Invoice Over-Count (Previous Session Fix)
Confirmed deployed and working via console output:
- V2 Quotation matches: 8 records
- V1 records after two-source filter: 0
- Final response: 8 shipments ✓

### v2.31 — Cancelled V1 Fix + V1 Badge (deployed)
**Changes:**
1. Added explicit `STATUS_CANCELLED` guard in V1 to_invoice two-pass loop
2. Added per-SO debug log to diagnose which records were slipping through
3. V2 debug logging added to identify AF-003867/003866 path
4. V1 badge detection checked — badge already existed in ShipmentRow

**Outcome:** To Invoice now shows 8. Confirmed via console log:
- AFCQ-003862 had `raw_status=3001` (V2 operational code stored on V1 SO) — caught by cancelled guard
- All 7 cancelled records excluded

### v2.32 — Prompt Log Archiving System (pending Opus)
**Changes:**
1. Create `claude/prompts/log/` folder
2. Create README.md with naming convention and 10-entry-per-file rule
3. Migrate all ~25 existing PROMPT-LOG.md entries into versioned files
4. Deprecate root PROMPT-LOG.md with redirect stub
5. Update claude/README.md with new log location

### v2.33 — Remove Debug Logs + Fix V1 Badge Detection (pending Opus)
**Changes:**
1. Remove all 8 `[to_invoice]` debug log lines from `list_shipments()` in shipments.py
2. Remove `v2_count` variable and `if tab == "to_invoice"` conditional blocks
3. Fix V1 badge detection: `data_version === 1 || migrated_from_v1 === true || quotation_id.startsWith('AFCQ-')`
4. Apply same badge logic to mobile card view (ShipmentCard)
5. Ensure `migrated_from_v1` on ShipmentOrder type and passed through in shipments.ts

---

## Root Cause Analysis — To Invoice 17 vs 8

Final confirmed breakdown:
- **8** V1 orders legitimately to invoice ✓
- **7** V1 cancelled orders — had V2 status codes (e.g. 3001) written directly onto ShipmentOrder by write endpoints; `status >= 100` Datastore filter did not exclude them; explicit `STATUS_CANCELLED` guard in two-pass loop fixed this
- **2** V2 orders (AF-003867, AF-003866) — were appearing because they matched the migrated ShipmentOrder section; fixed by v2.30 STATUS_COMPLETED guard

---

## V1 Badge Status

The badge code existed in `ShipmentRow` already:
```tsx
{order.data_version === 1 && (...)}
```
But only AFCQ-003862 showed the badge because migrated records have `data_version=2`. Fix in v2.33 extends detection to `migrated_from_v1=true` and `quotation_id.startsWith('AFCQ-')`.

---

## Key Files Modified This Session

| File | Change |
|---|---|
| `af-server/routers/shipments.py` | STATUS_CANCELLED guard + debug logs (v2.31) |
| `af-platform/src/components/shipments/ShipmentOrderTable.tsx` | V1 badge detection fix (v2.33 pending) |
| `af-platform/src/lib/types.ts` | migrated_from_v1 field (v2.33 pending) |
| `af-platform/src/lib/shipments.ts` | Pass-through migrated_from_v1 (v2.33 pending) |
| `claude/prompts/log/` | New archive folder (v2.32 pending) |
| `claude/PROMPT-LOG.md` | Deprecated, redirect stub (v2.32 pending) |

---

## Pending Work

### Immediate (next session)
1. Confirm v2.32 and v2.33 deployed correctly by Opus
2. Verify V1 badge now shows on migrated AF- records in the list
3. Confirm `[to_invoice]` debug logs no longer appearing in server console
4. Log v2.31/v2.32/v2.33 to new prompt log archive

### Short-term
- **2 V2 orders in To Invoice** (AF-003867, AF-003866) — they are not at STATUS_COMPLETED yet, investigate why they appear at all in the To Invoice list. May be a separate stats vs list discrepancy.
- **PT series** — port terminal migration scripts still pending execution
- **MI series** — full migration validation pending (MI-03 through MI-10)

### Backlog
- Platform cleanup: Remove v1-assembly.ts read path once migration fully stable
- Server cleanup: Remove V1 branches from list/stats/search once platform layer clean
- Dashboard stats: Active count still 22 — verify all are genuinely active

---

## Dashboard Stats (Last Confirmed — 01 Mar 2026)
| Stat | Value |
|---|---|
| Total | 2,044 |
| Active | 22 |
| Completed | 2,021 |
| To Invoice | **8** ✓ |
| Draft | 1 |
| Cancelled | 0 |

---

## Next Session — Recommended Starting Point

1. Check Opus has completed v2.32 and v2.33
2. Verify V1 badge visible on migrated AF- records in shipment list
3. Verify no `[to_invoice]` logs in server console
4. Investigate AF-003867 and AF-003866 appearing in To Invoice list (they are V2 but not yet at STATUS_COMPLETED)
5. Continue with PT series or next feature as directed
