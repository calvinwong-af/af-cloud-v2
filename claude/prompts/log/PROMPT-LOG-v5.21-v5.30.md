# Prompt Completion Log — v5.21–v5.30

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
