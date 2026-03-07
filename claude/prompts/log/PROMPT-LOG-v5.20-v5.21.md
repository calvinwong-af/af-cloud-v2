# Prompt Log — v5.20 to v5.21

---

### [2026-03-08 UTC] — v5.20: PortCombobox Terminal Integration
- **Status:** Completed (Opus)
- **Tasks:**
  - Extended `PortCombobox` with `withTerminal` flag, `terminalValue`, `onTerminalChange`, `onPortChange` props
  - Terminal data (`terminals`, `has_terminals`) added to `PortComboboxOption` interface as optional fields
  - `TerminalSelector` rendered internally inside `PortCombobox` when `withTerminal=true` and port has terminals
  - Auto-apply default terminal on port selection (`handleSelect`) and on mount/value+options change (`useEffect`)
  - Refactored `BCReview.tsx` — replaced inline terminal `<select>` IIFEs and broken POD onChange with `withTerminal` API
  - Refactored `BLReview.tsx` — same cleanup as BCReview
  - Refactored `AWBReview.tsx` — terminal fields added to option mapping for future-proofing; no `withTerminal` flag (airports have no terminals yet)
  - Refactored `StepRoute.tsx` — replaced separate `TerminalSelector` instances with `withTerminal` API on origin/dest comboboxes
  - `TerminalSelector.tsx` — converted from pill buttons to `<select>` dropdown (scalable to any number of terminals)
- **Files Modified:**
  - `af-platform/src/components/shared/PortCombobox.tsx`
  - `af-platform/src/components/shared/TerminalSelector.tsx`
  - `af-platform/src/components/shipments/_doc-parsers/BCReview.tsx`
  - `af-platform/src/components/shipments/_doc-parsers/BLReview.tsx`
  - `af-platform/src/components/shipments/_doc-parsers/AWBReview.tsx`
  - `af-platform/src/components/shipments/_create-shipment/StepRoute.tsx`

---

### [2026-03-08 UTC] — v5.21: PortCombobox + Parser Terminal Bug Fixes
- **Status:** Completed (MCP direct edits)
- **Root causes identified and fixed:**
  1. **Port selection not sticking (BC/BL parsers)** — stale closure bug: `onChange` and `onTerminalChange` both used `{ ...formState, key: value }` spread pattern, closing over stale `formState` snapshot. `onTerminalChange` was overwriting the port code set by `onChange`. Fixed by switching to functional updater form `setFormState(prev => ({ ...prev, key: value }))` in BCReview and BLReview.
  2. **Terminal not auto-assigned on parser open** — `parsedData` from parser never includes `pol_terminal`/`pod_terminal`. `PortCombobox` useEffect relied on async timing to fill it, but `seaPortOptions` being recreated on every BCReview render caused instability. Fixed by seeding terminal defaults into `parsedData` at the source — `DocumentParseModal` now calls `seedDefaultTerminals(data, ports)` before `setParsedData`, injecting `pol_terminal`/`pod_terminal` immediately when parsing completes.
  3. **JSX syntax error** — `TerminalSelector` moved outside `relative` div required React fragment wrapper `<>...</>`. Fixed.
  4. **`mouseDownRef` timing** — several iterations on blur guard; ultimately the stale closure fix (item 1) resolved the apparent click-registration issue. `mouseDownRef` approach retained but simplified.
- **Files Modified:**
  - `af-platform/src/components/shared/PortCombobox.tsx`
  - `af-platform/src/components/shipments/_doc-parsers/BCReview.tsx`
  - `af-platform/src/components/shipments/_doc-parsers/BLReview.tsx`
  - `af-platform/src/components/shipments/DocumentParseModal.tsx`

---
