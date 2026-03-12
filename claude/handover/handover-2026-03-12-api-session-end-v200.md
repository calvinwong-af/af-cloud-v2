# Handover — API Session 117 End — Contract v2.0

## Session Header
**AF API — Session 117 | AcceleFreight v2 | v6.30 Live | Tests: 272/286**

---

## What Was Done This Session

### API Contract Split (v2.0 → split files)

The monolithic `claude/other/AF-API-Contract.md` (101 KB) was split into 7 focused files under a new directory `claude/other/api-contract/`:

| File | Sections | Size |
|---|---|---|
| `AF-API-Index.md` | 0 (conventions), 1 (health), 12 (auth map) | 11 KB |
| `AF-API-Shipments.md` | 2 (shipments), 9 (data objects) | 29 KB |
| `AF-API-Pricing.md` | 11 (open items), 13 (FCL/LCL/haulage/air) | 32 KB |
| `AF-API-Ground-Transport.md` | 10 (orders, stops, legs, geocoding) | 8 KB |
| `AF-API-Geography.md` | 5 (geography), 6 (legacy ports) | 6 KB |
| `AF-API-Companies-Users.md` | 3 (companies), 4 (users) | 5 KB |
| `AF-API-AI-Files.md` | 7 (files stub), 8 (AI parse) | 3 KB |

The old monolithic file is **retained** at `claude/other/AF-API-Contract.md` as a fallback reference.

Memory entry #7 added to reflect the new file structure.

---

## How to Use the Split Contract

**Every API session:** Load `AF-API-Index.md` first (conventions + auth map).  
**Then load only the relevant domain file(s):**
- Shipment changes → `AF-API-Shipments.md`
- Pricing changes → `AF-API-Pricing.md`
- Transport changes → `AF-API-Ground-Transport.md`
- Geography/ports → `AF-API-Geography.md`
- Companies/users → `AF-API-Companies-Users.md`
- AI parsing → `AF-API-AI-Files.md`

**To update the auth map:** Edit `AF-API-Index.md` Section 12 only.  
**Version header:** Update in the relevant domain file footer + `AF-API-Index.md` footer.

---

## Current Contract State

- **Version:** v2.0 (12 March 2026)
- All content identical to previous monolithic v2.0 — split is structural only, no content changes this session.
- Last substantive update (v2.0): `PATCH /shipments/{id}/type-details` added; air rate card list response clarified (`latest_cost_supplier_id`, `rates_by_supplier` supplier-only note); auth map made comprehensive.

---

## Next API Session Startup

```
Read files:
- claude/handover/handover-2026-03-12-api-session-end-v200.md
- claude/other/api-contract/AF-API-Index.md
- claude/other/api-contract/[relevant domain file]
```

---

## Open Items (Contract)

| Item | Status |
|---|---|
| Local charges / customs / port-transport pricing | Not yet documented in contract |
| Invoice endpoints | Deferred — V1 Datastore reads still in use |
| Quotation engine endpoints | Deferred |
| Files base router (`/api/v2/files`) | Stub only |
| Port terminal CRUD | Not exposed via API |
