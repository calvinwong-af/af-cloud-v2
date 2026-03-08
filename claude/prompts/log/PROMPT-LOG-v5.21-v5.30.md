# Prompt Completion Log — v5.21–v5.30

### [2026-03-08 14:45 UTC] — v5.22: rate_status Enum Extension + Rate Deduplication
- **Status:** Completed
- **Tasks:**
  - Task 1: Created `migrations/016_rate_status_draft_rejected.sql` — adds DRAFT and REJECTED to rate_status enum (IF NOT EXISTS, no transaction block)
  - Task 2: Created `scripts/dedup_rates.py` — identifies and deletes redundant historical rate rows using LAG() window functions, --dry-run default, --execute with confirmation, IS NOT DISTINCT FROM for NULL equality, rn>1 guard to protect most recent rows
  - Task 3: Updated `fcl.py` — extended `_VALID_RATE_STATUSES` with DRAFT/REJECTED, added `publish_fcl_rate` and `reject_fcl_rate` endpoints (DRAFT->PUBLISHED/REJECTED, admin only), added `pending_draft_count` to `list_fcl_rate_cards`
  - Task 4: Updated `lcl.py` — identical changes as Task 3 for LCL router
- **Files Modified:**
  - `af-server/migrations/016_rate_status_draft_rejected.sql` (new)
  - `af-server/scripts/dedup_rates.py` (new)
  - `af-server/routers/pricing/fcl.py`
  - `af-server/routers/pricing/lcl.py`
- **Notes:** Migration and dedup script are NOT to be executed by Opus — Calvin runs manually

---

### [2026-03-08 09:30 UTC] — v5.21: Fix PortCombobox Selection & Terminal Auto-Assign
- **Status:** Completed
- **Tasks:**
  - Rewrote `PortCombobox.tsx` — removed `mouseDownRef` blur guard entirely, simplified `onBlur` to unconditionally close dropdown
  - List items use `onMouseDown` with `e.preventDefault()` to prevent input blur during click (proven pattern)
  - Removed container div `onMouseDown`/`onMouseUp` handlers that set/cleared the ref
  - Terminal auto-assign `useEffect` reordered guards: checks `terminalValue` emptiness inside effect body, reads from props directly, deps remain `[value, options]` with eslint-disable
  - Moved `onTerminalChange` presence check inside `showTerminal` condition for cleaner rendering guard
  - All existing behaviour preserved: keyboard nav, scroll-to-highlighted, clear-on-empty, className/placeholder/sublabel
- **Files Modified:**
  - `af-platform/src/components/shared/PortCombobox.tsx`

---
