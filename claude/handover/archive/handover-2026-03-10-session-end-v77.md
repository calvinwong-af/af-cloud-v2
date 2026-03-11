# AF Dev Handover — Session End
**Date:** 2026-03-10
**Session:** 77
**Version Live:** v5.69 (no new deployment this session)
**Last Prompt Executed:** v5.75
**Tests:** v2.61 — 272/286 (unchanged)

---

## What Was Done This Session

### v5.75 — Fix Effective From/To vertical alignment in Rate Modal
- Replaced `<label>` wrapper on Effective From date field with matching `<div>` + inner `<div className="flex items-center justify-between">` structure to match Effective To's DOM depth
- Both date inputs now align vertically in the Update Rate / Edit Rate modal
- **File modified:** `af-platform/src/app/(platform)/pricing/_rate-modal.tsx`

### Housekeeping
- Handover archive tidied — v70–v73 moved to `claude/handover/archive/` by Calvin
- `AF-Backlog.md` updated: added PR-02 (orphan open-ended supplier rows cleanup) and PR-03 (expiring_soon overcount); collapsed closed items; removed stale planned prompts
- Pinned memory cleaned: removed AI agent roadmap (#3) and backlog detail — both now file-only references

---

## Current State

- **No active prompt** — `PROMPT-CURRENT.md` clear
- **Pricing module stable** — dashboard and Issues Only alert counts consistent
- **Rate modal alignment fixed** — v5.75 complete
- **Nothing pending deployment**

---

## Next Session — Ground Transport Design

Calvin confirmed: **transport design is next**, before Quotation workstream.

Ground transport has not been scoped yet. Starting points to consider:
- What entities are needed (transport orders, legs, drivers, vehicles?)
- How does it relate to existing shipments (linked vs standalone?)
- What does the UI entry point look like (separate module or within shipment detail?)
- The GT test series exists but is marked 🗄️ Retired — will need rewriting once design is locked

---

## Known Deferred Items

- **PR-02** — Orphan open-ended supplier rows migration cleanup (cards 109/110 patched; broader script deferred)
- **PR-03** — `expiring_soon` dashboard query overcounts open-ended cards (do not touch until scoped)
- **PR-01** — Surcharge model clarification (list price vs supplier side) — review before Quotation
- **UI-17** — Per-user default country preference (pricing hardcodes MY)
- **TD-02** — Drop deprecated flat surcharge columns (`lss`, `baf`, `ecrs`, `psc`) from FCL/LCL tables
- **effective_from flow** — "Update Rate" UI confirmed working (mode: 'update' wired in _rate-modal.tsx)
- **Quotation workstream** — after transport
- **Operations Playbook** — deferred (Jermaine to participate)
- **AI agent phases** — deferred until core platform complete (see AF-Vision-AI-Agent.md)

---

## Migrations State

| # | File | Local | Prod |
|---|---|---|---|
| 020–025 | All migrations | ✅ | ✅ |

---

## Architecture Reminders
- `shipments.etd` / `shipments.eta` deprecated; POL/POD task legs are source of truth
- BC writes scheduled timing only; BL/AWB writes actual timing only
- Forward-only status progression
- All shipment records use `AF-` prefix; `AFCQ-` retired
- af-web (Vue public site) parked indefinitely
- Scenario 4 alert = card-level, not supplier-level (locked in v5.74)
