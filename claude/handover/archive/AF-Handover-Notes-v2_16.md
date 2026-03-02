# AF Platform — Handover Notes v2.16
**Date:** 27 February 2026  
**Session Focus:** Data structure review and decisions for V2 migration  
**Prepared by:** Claude / Calvin  

---

## Session Summary

This session was a strategic review of the full Datastore entity map with the goal of establishing a clean, unambiguous data structure before the V2 migration script is written. No code was written. All decisions made here feed directly into the migration scope.

---

## Key Decisions Made This Session

### 1. Pricing Engine — Scrapped

The V1 `FinancialComponents` pricing engine and its entire dependency chain are scrapped. This includes:
- `FinancialComponents` class and all subclasses (FCL/LCL/Air)
- `CustomerRank` / `CompanyRates` markup system
- `estimate_component[]` / `actual_component[]` patterns
- All V1 subsidiary Kinds (`QuotationFreight`, `QuotationFCL/LCL/Air`, `ShipmentOrderFCL/LCL/Air`)

**What is kept:** All rate table Kinds (`PTMonthlyRate*`, `PricingFCL/LCL/Air`, `PricingHaulage`, `PricingTransport`, `PricingLocalCharges`, `PricingCustomsCharges`, `PricingDGClassCharges`). The `cost` / `price` structure on those tables is preserved as-is.

**New quotation function** will be purpose-built for V2. Design deferred — incoterm/line item logic, markup model, and staff vs automated flow all to be decided when the pricing module is built.

---

### 2. Quotation Kind → ShipmentOrder Kind (Rename)

The existing `Quotation` Datastore Kind is to be renamed `ShipmentOrder`. This removes the naming ambiguity between the operational shipment record and the commercial quotation document.

**Rationale:** In V2, the ShipmentOrder is the primary object. The word "quotation" moves exclusively to describe the `CommercialQuotation` (`AFCQ-XXXXXX`) — the customer-facing pricing document. Having both a `Quotation` Kind and a `CommercialQuotation` Kind was a collision waiting to cause confusion.

**Key naming rules going forward:**
| Entity | Kind Name | Key Prefix | Notes |
|---|---|---|---|
| V1 legacy records | `Quotation` (unchanged) | `AFCQ-XXXXXX` | Read/write until all 22 open orders close, then read-only archive |
| V2 ShipmentOrder | `ShipmentOrder` (new Kind) | `AF-XXXXXX` | All new records |
| CommercialQuotation | `CommercialQuotation` | `AFCQ-XXXXXX` | Pricing/invoicing document — build deferred |

**V1 legacy records are NOT rekeyed.** The `AFCQ-` prefix on legacy records stays. It actually serves as a useful visual indicator that a record is V1 legacy. `data_version: 1` (or absent) confirms this programmatically.

**The 22 open V1 orders remain read/write** on the old `Quotation` Kind until operationally closed. When the last one closes, the V1 write path is disabled — simple config change, not a code change.

---

### 3. Invoice Kind — Scrapped

The `Invoice` Kind and the Xero integration are dead. The Xero API changed years ago making the integration non-functional. Invoicing will be redesigned from scratch as a future module.

**Scrapped with it:**
- `MasterInvoice` Kind
- `XeroAccounts` Kind
- All Xero sync fields (`xero_invoice_id`, `xero_sync`, `xero_sync_required`) — preserved on old records for historical reading only, never written by V2

---

### 4. PortShipmentTasks — Phased Out

`PortShipmentTasks` (922 records) is part of the old cargo routing system, distinct from the milestone/workflow tracking we have now. It will be revisited together with the incoterm task definition work. No new records written by V2.

---

### 5. Reference Kinds — Full Disposition

| Kind | Records | Decision | Notes |
|---|---|---|---|
| `Port` | 337 | ✅ Keep | Core reference — origin/destination |
| `City` | 646 | ✅ Keep | Haulage/transport location reference |
| `Country` | 90 | ✅ Keep | Company address, cross-border orders |
| `Carrier` | 89 | ✅ Keep | Operational reference |
| `Airlines` | 7 | ✅ Keep | Operational reference |
| `Vessel` | 228 | ✅ Keep | Vessel tracking |
| `VesselSchedule` | 8,234 | ✅ Keep | Port call schedules |
| `Service` | 48 | ✅ Keep | Shipping service lines |
| `ServicePortCall` | 400 | ✅ Keep | Port calls per service |
| `ServicesCarriers` | 38 | ✅ Keep | Carrier ↔ service mapping |
| `Incoterms` | 9 | ✅ Keep | Still referenced on ShipmentOrder |
| `CargoType` | 22 | ✅ Keep | DG classification reference |
| `CurrencyConversion` | 22 | ✅ Keep | Multi-currency support |
| `FileTags` | 36 | ✅ Keep | File management |
| `Tags` | 8 | ✅ Keep | General tagging |
| `AccountType` | 2 | ✅ Keep | User role system |
| `TransportTonnage` | 5 | ✅ Keep | Truck size reference for ground transport rate table |
| `ProductServiceItems` | 91 | ✅ Keep | Financial line item code reference — preserved to avoid rebuild |
| `CustomerRank` | 2 | ❌ Scrap | Markup system — gone with pricing engine |
| `CompanyRates` | 641 | ❌ Scrap | Markup system — gone with pricing engine |
| `XeroAccounts` | 71 | ❌ Scrap | Xero only — dead with integration |
| `Zone` | 4 | ❌ Scrap | Geocoding for old pricing — rebuild later |
| `UnmatchedZones` | 611 | ❌ Scrap | Geocoding queue for old pricing — rebuild later |
| `SuppliersCarriers` | 9 | ❌ Scrap | Over-engineered, unused in practice |

---

### 6. Supplier ↔ Rate Table Relationship — Deferred

The `SuppliersCarriers` Kind was an attempt to link AF suppliers to carrier routes for rate table queries. The underlying need (linking a rate supplier to carrier routes) is real but the implementation was unused. The `supplier_id` field already exists directly on `PTMonthlyRate*` records. The correct design will be decided when the pricing module is built.

**Flagged as TODO:** Revisit supplier reference model when pricing module is scoped.

---

## Updated Full Kind Disposition

### Active in V2 (keep, write new records)
`ShipmentOrder` (new Kind), `CommercialQuotation`, `Company`, `UserAccount`, `AFUserAccount`, `CompanyUserAccount`, `ShipmentWorkFlow`, `ShipmentTrackingId`, `Files`, `Comments`, `AFSystemLogs`, `UserDashboard`, all Pricing Kinds (rate tables), all kept Reference Kinds above.

### V1 Legacy (read/write until closed, then read-only archive)
`Quotation` (V1 records, `AFCQ-XXXXXX` prefix, `data_version: 1`)

### Phased Out (no new records, read for V1 compat only)
`QuotationFreight`, `QuotationLCL`, `QuotationFCL`, `QuotationAir`, `ShipmentOrder` (old Kind), `ShipmentOrderLCL`, `ShipmentOrderFCL`, `ShipmentOrderAir`, `MasterInvoice`, `Invoice`, `PortShipmentTasks`

### Scrapped (no reads, no writes, archive/delete)
`CustomerRank`, `CompanyRates`, `XeroAccounts`, `Zone`, `UnmatchedZones`, `SuppliersCarriers`

---

## TODO Index (Updated)

### Data / Architecture
| Task | Status | Notes |
|---|---|---|
| Update AF-V2-Data-Model to reflect all decisions this session | 🔴 Next | Kind rename, scrapped Kinds, updated entity map |
| Write V1 → V2 migration script | 🔴 Next after model update | Core fields only — no pricing, no invoice refs |
| Rename `Quotation` Kind → `ShipmentOrder` in Datastore | ⏳ Phase 2 | After all 22 open V1 orders close |
| Revisit `ProductServiceItems` for invoicing module | 🔵 Deferred | When invoicing is redesigned |
| Revisit supplier reference model | 🔵 Deferred | When pricing module is scoped |
| Rebuild geocoding/address matching (Zone replacement) | 🔵 Deferred | Much later |
| CompanyUserAccount repair (54% broken) | 🔵 Phase 3 | Not blocking current build |
| Delete AF2-000001 test record | ✅ Done | |

### Infrastructure
| Task | Status |
|---|---|
| Verify Cloud Build trigger fires on push | ⏳ Pending — check after next feature push |

### Server (af-server)
| Task | Status |
|---|---|
| V1 → V2 migration script | 🔴 Next major task |
| Status stage redesign | 🔵 Deferred |
| Route Node Timeline | 🔵 Deferred |
| Incoterm task definitions + PortShipmentTasks replacement | 🔵 Deferred |

### Platform (af-platform)
| Task | Status |
|---|---|
| Shipment detail — files tab | ⏳ Queued |
| Shipment detail — V1 parties cards | ⏳ Queued |
| Geography module | 🔵 Deprioritised |
| System Logs module | 🔵 Deferred |
| Pricing Tables UI | ⏳ After migration script |
| Quotations / ShipmentOrder creation module | ⏳ After migration script + Pricing Tables |
| Duplicate Shipment | ⏳ Needs server implementation |
| Company detail — files tab | ⏳ Queued |

---

## Next Session Objectives

1. **Update `AF-V2-Data-Model-v0_4.md`** — bump to v0.5, reflecting:
   - Kind rename: `Quotation` → `ShipmentOrder`
   - Scrapped Kinds removed from entity map
   - Updated obsolete Kinds list
   - Pricing engine section removed
   - CommercialQuotation section retained but clearly marked as deferred
   - Supplier reference model flagged as open question

2. **Scope the V1 → V2 migration script** — define exact field mappings from:
   - `Quotation` core fields → `ShipmentOrder`
   - `QuotationFreight` fields → `ShipmentOrder.type_details` / `cargo`
   - `QuotationFCL/LCL/Air` fields → `ShipmentOrder.type_details`
   - `ShipmentOrder` (old Kind) fields → `ShipmentOrder.parties` / `booking`
   - Status code mapping (V1 → V2)

3. **Write the migration script prompt** for VS Code / Opus

---

## Deployment State (Unchanged)

| Service | URL | Status |
|---|---|---|
| af-platform | https://appv2.accelefreight.com | ✅ Live |
| af-server | https://api.accelefreight.com | ✅ Live |
| af-cloud-auth-server | https://auth.accelefreight.com | ✅ Live |
| alfred.accelefreight.com | Old Vue TMS | ⚠️ Still live — do not touch |

## Dev Environment Quick Start

```powershell
# Terminal 1 — af-server
cd C:\dev\af-cloud-v2\af-server
.venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --port 8000

# Terminal 2 — af-platform
cd C:\dev\af-cloud-v2\af-platform
npm run dev
```

`AF_SERVER_URL=http://localhost:8000` in `af-platform/.env.local`
