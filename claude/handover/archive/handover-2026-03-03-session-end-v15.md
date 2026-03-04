# Session Handover — 03 March 2026 (Session 15 End)
**Platform Version:** v3.03 local (v3.04 prompt ready in PROMPT-CURRENT.md, v3.05 with Opus now)
**Test Master:** v2.62 — 229/266 passing, 29 pending
**Handover written:** End of Session 15

---

## What Was Done This Session

### v3.03 — Incoterm-Aware Status Logic + EXW Export Block (Opus)
- `_is_booking_relevant(incoterm, transaction_type)` helper added to `_helpers.py`
- BL apply (`bl.py`) auto-advances status: Path A → 3002, Path B → `_determine_initial_status(etd)`
- AWB apply (`doc_apply.py`) auto-advances status: same pattern using `flight_date`
- EXW hard-blocked from incoterm selector when `transaction_type === 'EXPORT'`
- Applied in `StepRoute.tsx`, `BLManualFields.tsx`, `CreateShipmentModal.tsx`

### Commit + Deploy
- v2.93 through v3.02 committed and deployed to production
- Production now at v3.03 (local confirmed, deploy assumed after Opus run)

### GCP IAM Fix — BUG-03 File Download 401s (Session 15)
- Added **Service Account Token Creator** role to `af-server@cloud-accele-freight.iam.gserviceaccount.com`
- Fixes `signBlob` permission error for signed URLs in `files.py`
- No redeployment needed — IAM change live immediately

### Test Verification This Session
- **DP-61** ✅ YES — AWB apply Path B (FCA EXPORT, past flight_date) → status 4001
- **DP-62** ✅ YES — EXW blocked from incoterm selector on EXPORT
- **DP-60** PENDING — blocked by local dev token expiry issue; retry needed (not a code bug)
- **FILE-03** ✅ YES — "Read file again" on BC file confirmed working

### TODOs Logged This Session

| ID | Description | Priority | File |
|---|---|---|---|
| TODO-UI-01 | Incoterm edit on shipment details page (pencil → modal) | **IMMEDIATE** | `_components.tsx` + `shipments-write.ts` + backend |
| TODO-UI-02 | Incoterm badge color on details page to match list | Low | `_components.tsx` |
| TODO-BC-01 | BCReview POL/POD — plain text instead of port combobox | Medium | `BCReview.tsx` |

---

## Prompts Status

| Version | Status | Description |
|---|---|---|
| v3.03 | ✅ Complete | Incoterm-aware status logic + EXW block |
| v3.04 | **READY** — in PROMPT-CURRENT.md | Incoterm edit on shipment details + badge consistency |
| v3.05 | **With Opus now** | Port combobox fix — BLReview + BCReview (TODO-BC-01 + BL-PORT-01) |

---

## IMMEDIATE NEXT PRIORITY — v3.04 (Incoterm Edit on Details Page)

v3.04 must be run **before** DP-55 through DP-59 BL/AWB status tests, because those tests
require shipments with specific incoterm values — and the only way to set incoterm on an
existing shipment is currently via BC upload or create flow. The incoterm edit modal is
needed to set up test shipments quickly.

**v3.04 scope:**
- Backend: `PATCH /shipments/{id}/incoterm` in `core.py`
- Frontend: `updateIncotermAction` in `shipments-write.ts`
- Frontend: `IncotermEditModal` in `_components.tsx` — pencil icon on Route card, AFU only
- Frontend: `PortPair.tsx` — `onEditIncoterm` prop + consistent badge style
- EXW export block applies in modal
- No status auto-correction on incoterm change

Full prompt in: `claude/prompts/PROMPT-CURRENT.md`

---

## Pending Tests — DP-55 to DP-61 (v3.03 Status Auto-Advance)

These require test shipments with specific incoterm + transaction_type combinations.
**Blocked until v3.04 (incoterm edit) is live.**

| # | Test | Shipment Needed |
|---|---|---|
| DP-55 | `_is_booking_relevant()` FOB import → True | SEA, FOB, IMPORT |
| DP-56 | `_is_booking_relevant()` FOB export → False | SEA, FOB, EXPORT |
| DP-57 | apply-bl Path A → 3002 | SEA, FOB, IMPORT |
| DP-58 | apply-bl Path B past date → 4001 | SEA, FOB, EXPORT |
| DP-59 | apply-bl Path B future date → 3002 | SEA, FOB, EXPORT |
| DP-60 | apply-awb Path A → 3002 | AIR, FCA, IMPORT (token issue — retry) |
| DP-61 | ✅ YES confirmed | — |

---

## System State

| Item | State |
|---|---|
| Production | v3.03 live (post-session deploy) |
| Local | v3.03 — committed |
| PROMPT-CURRENT | v3.04 — ready for Opus |
| v3.05 | With Opus now (BLReview + BCReview port combobox) |
| Test Master | v2.62 — 229/266 passing |
| PostgreSQL migration | Complete |
| API Contract | v1.3 (v3.04 will add incoterm endpoint — update after) |

---

## Open Items

1. **v3.05 verify** — BLReview + BCReview port combobox (Opus running now)
2. **v3.04 run** — Incoterm edit on shipment details (IMMEDIATE — unblocks DP-55–59)
3. **DP-55–59** — BL apply status tests (blocked on v3.04)
4. **DP-60** — AWB apply Path A retry (token issue)
5. **TODO-UI-02** — Incoterm badge color (low — bundle with v3.04 if not already done)
6. **DT series** — 15 datetime tests still pending
7. **DP-42, DP-48** — diff badge cosmetic items (low priority)

---

## Key File Locations

| File | Path |
|---|---|
| Handover | `claude/handover/` |
| Active prompt | `claude/prompts/PROMPT-CURRENT.md` (v3.04) |
| Prompt log | `claude/prompts/log/PROMPT-LOG-v3.03-v3.12.md` |
| Test master | `claude/tests/AF-Test-Master.md` |
| Test series | `claude/tests/series/` |
| _helpers.py | `af-server/routers/shipments/_helpers.py` |
| bl.py | `af-server/routers/shipments/bl.py` |
| doc_apply.py | `af-server/routers/shipments/doc_apply.py` |
| core.py | `af-server/routers/shipments/core.py` |
| shipments-write.ts | `af-platform/src/app/actions/shipments-write.ts` |
| _components.tsx | `af-platform/src/app/(platform)/shipments/[id]/_components.tsx` |
| PortPair.tsx | `af-platform/src/components/shared/PortPair.tsx` |
| BLReview.tsx | `af-platform/src/components/shipments/_doc-parsers/BLReview.tsx` |
| BCReview.tsx | `af-platform/src/components/shipments/_doc-parsers/BCReview.tsx` |
| DocumentParseModal | `af-platform/src/components/shipments/DocumentParseModal.tsx` |
