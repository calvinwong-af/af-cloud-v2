# Handover — 03 March 2026 (Session End — v2.73 pending)

## Session Summary
This session covered the DOC-PARSE feature live testing on AF-003861 (AWB upload), two hotfixes (v2.71/v2.72), and a new prompt (v2.73) targeting apply endpoint consistency. v2.73 is queued for Opus — not yet executed.

---

## Current System State

### Versions
| Item | Value |
|---|---|
| Last completed prompt | v2.72 |
| Next prompt to run | v2.73 (queued in PROMPT-CURRENT.md) |
| Test list version | 2.49 (this handover) |
| Prompt log file | claude/prompts/log/PROMPT-LOG-v2.63-v2.72.md |

### Stats (unchanged from v2.44 baseline)
| Metric | Value |
|---|---|
| Total Orders | 2,043 |
| Active | 23 |
| Completed | 2,019 |
| Draft | 1 |
| To Invoice | 8 |

---

## What Was Done This Session

### Live Testing — AWB Upload on AF-003861
- AWB parse (PAMAE2603001) confirmed working perfectly — all fields extracted correctly
- DocumentParseModal grouped view confirmed: Route & Dates, AWB Numbers, Shipper, Consignee, Cargo all rendering
- "Use This Data" button was crashing with `TypeError: json.loads() not dict` → hotfixed in v2.72
- After v2.72 fix: data applied successfully — route card updated SGN → SIN, company BEDI SPORTS preserved
- Two remaining gaps identified from live test:
  1. ETD not updating on route card (flight_date not written to flat etd column)
  2. AWB document not saved to Files tab after apply

### v2.71 — Port Combobox + Company Ownership UX
- All port/airport dropdowns converted to searchable PortCombobox (code-first format: SGN — Tan Son Nhat...)
- Company ownership context-aware: State A (hide), State B (match card), State C (amber banner at top)
- companyId prop wired from shipment detail page to DocumentParseModal
- Files: BLUploadTab.tsx, DocumentParseModal.tsx, shipments/[id]/page.tsx

### v2.72 — JSONB json.loads() Hotfix
- Root cause: PostgreSQL returns JSONB as already-parsed dict; json.loads() crashes on dict input
- Fixed apply_awb and apply_booking_confirmation — replaced all json.loads(row[n]) with _parse_jsonb()
- Full sweep of shipments.py confirmed — no remaining bare json.loads() on DB row columns
- Best practice comment added near _parse_jsonb() helper
- Files: af-server/routers/shipments.py

### v2.73 — Queued (not yet run)
Apply endpoint consistency prompt covering:
1. apply_awb: write flight_date → flat etd column + verify origin/dest port flat writes
2. New POST /{id}/save-document-file endpoint — accepts file + doc_type, saves to GCS + shipment_files
3. apply_booking_confirmation: write etd/eta flat columns unconditionally (not just via route_nodes)
4. Consistency sweep — all three apply endpoints uniform for flat columns, JSONB writes, file saving
5. Frontend: DocumentParseModal calls saveDocumentFileAction after successful AWB/BC apply

---

## What To Do Next Session

1. **Run v2.73 prompt in VS Code (Opus)** — this is the immediate priority
2. **Test after v2.73:**
   - DP-35: AWB apply → ETD updates on route card
   - DP-36: AWB apply → document saved to Files tab with tag "awb"
   - DP-37: BC apply → document saved to Files tab with tag "bc"
   - DP-38: BC apply → ETD/ETA updates on route card
3. **Continue DP series pending tests:** DP-04/06, DP-09–11, DP-15–18, DP-24–32
4. **BC parse test on AYN1317670** — use existing booking confirmation PDF

---

## Key Decisions Made

### JSONB Best Practice (permanent)
Always use `_parse_jsonb()` when reading any JSONB column from a PostgreSQL row via SQLAlchemy. Never use `json.loads()` directly on a row column. The helper handles both dict (pass-through) and str (parse) cases. This pattern must be followed for all future DB reads of JSONB fields.

### Document File Saving Pattern (v2.73 onwards)
All document apply endpoints follow the same pattern:
- Data apply endpoint (JSON) handles DB writes only
- File save is handled by a separate `POST /{id}/save-document-file` endpoint
- Frontend calls file save after successful data apply
- BL is the exception — it saves inline (existing behaviour preserved)

---

## Pending Tests After v2.73

| Test | Description |
|---|---|
| DP-35 | AWB apply → ETD updates on route card |
| DP-36 | AWB apply → document saved to Files tab (tag: awb) |
| DP-37 | BC apply → document saved to Files tab (tag: bc) |
| DP-38 | BC apply → ETD/ETA updates on route card |

---

## Files Modified This Session
| File | Change |
|---|---|
| `af-server/routers/shipments.py` | v2.72: _parse_jsonb() in apply_awb + apply_booking_confirmation + best practice comment |
| `af-platform/src/components/shipments/BLUploadTab.tsx` | v2.71: PortCombobox, State C banner |
| `af-platform/src/components/shipments/DocumentParseModal.tsx` | v2.71: PortCombobox, companyId prop, State A/C restructure |
| `af-platform/src/app/(platform)/shipments/[id]/page.tsx` | v2.71: companyId prop passed to DocumentParseModal |
| `claude/prompts/PROMPT-CURRENT.md` | v2.73 queued |
| `claude/tests/AF-Test-List.md` | v2.49 (this update) |
| `claude/handover/handover-2026-03-03-session-end.md` | This file |
