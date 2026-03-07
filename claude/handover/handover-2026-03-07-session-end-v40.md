# Session 40 Handover — AcceleFreight v2
**Date:** 2026-03-07
**Version:** v5.07 Live (deployed) | v5.07 Complete
**Tests:** 279/299 (unchanged — no new prompts this session)
**Session Type:** Design/Research — Pricing Module Study

---

## Session Work

### Legacy Code Setup
- Extracted legacy Vue frontend + Flask/GAE server into `claude/legacy-reference/`
- Added `claude/legacy-reference/` to `.gitignore`
- Legacy server: `af-team-af-cloud-webserver-2999c133ea36/`
- Legacy frontend: `af-team-af-cloud-webapp-fdcc08416c3d/`

### Pricing Module — Legacy Study (Complete)

Read all four legacy pricing model files in full:
- `model/pricing/pricing_ocean_air_model.py` ✅
- `model/pricing/pricing_haulage_transport_model.py` ✅
- `model/pricing/pricing_port_charges_model.py` ✅
- `model/pricing/pricing_helper.py` ✅
- `model/quotations_model.py` (first 100 lines — properties only)

---

## Pricing Module — New Design Decisions (Locked)

### Naming Conventions

| Legacy Name | New Name |
|---|---|
| `PricingFCL` / `PricingLCL` / `PricingAir` | `freight_rate_cards` (unified, discriminated by `freight_type`) |
| `PricingHaulage` | `haulage_rate_cards` |
| `PricingTransport` | `trucking_rate_cards` |
| `PricingLocalCharges` | `port_charge_rate_cards` |
| `PricingCustomsCharges` | `customs_charge_rate_cards` |
| `PricingDGCCharges` | `dg_surcharge_rate_cards` |
| `PTMonthlyRateOceanAir` | `freight_rates` |
| `PTMonthlyRateHaulageTransport` | `haulage_rates` / `trucking_rates` |
| `PTMonthlyRatePortCharges` | `port_charge_rates` / `customs_charge_rates` |
| `pt_id` | `rate_card_id` |
| `pt_group` | `rate_card_key` (human-readable composite key string) |
| `pt_my_id` | Dropped — replaced by proper composite PK in PostgreSQL |
| `KIND` prefix system | Dropped — replaced by `freight_type` enum column |
| `TransportTonnage` | `truck_tonnages` |
| `year_month_order` | Dropped — PostgreSQL date ordering handles this natively |

---

### Rate Validity Model — Unified Effective-Date

**Single model across ALL pricing domains:**

```
effective_from  DATE  NOT NULL
-- implicit valid_to = next record's effective_from for same lane+supplier
```

**Query pattern (universal):**
```sql
WHERE rate_card_id = $1
  AND supplier_id = $2
  AND effective_from <= $reference_date
ORDER BY effective_from DESC
LIMIT 1
```

**Rationale:**
- Subsumes both period-based and effective-date patterns — they are the same design
- Air "seasonal" rates = month-aligned effective dates
- LCL monthly rates = first-of-month effective dates
- FCL spot rates = entered whenever carrier publishes (could be bi-weekly or mid-week)
- Operational advantage: no empty placeholder records — only write when something changes
- If no rate exists for a lane: return null → quotation marks line item as "rate not available"

**Validated by real supplier data (ECU Worldwide tariff sheets):**
- Filename pattern: `ECUWW_EXPORT_TARIFF_WEF_08_03_2026_-14_03_2026.xlsx`
- WEF = With Effect From → maps directly to `effective_from`
- Validity window (e.g. 08/03–14/03) is bi-weekly — not monthly
- This confirms that even "slow" LCL supplier rates can change on 2-week cycles
- The effective-date model handles any cadence without schema changes

**Rate value rules (confirmed from tariff data):**
- **Negative rates are valid and normal** — carrier pays AF to use their service (e.g. Shanghai at -133 per W/M). Store and display as-is, never treat as error.
- **FOC (Free of Charge) = numeric 0** — not a special state. Store as 0.
- **ON REQUEST = distinct state, not a value** — lane exists but rate is unpublished. Requires staff confirmation before quoting. Schema must represent as a `rate_status` enum field, e.g. `PUBLISHED | ON_REQUEST`. When a lane is ON_REQUEST at the latest effective date, the quotation system must flag it as requiring confirmation rather than auto-calculating.

---

### Rate Granularity by Domain (Operational, Not Schema)

| Domain | Expected Update Cadence | Notes |
|---|---|---|
| FCL | Weekly to bi-weekly | Carrier-driven, volatile. MSK/Hapag-Lloyd can change mid-week |
| LCL | Bi-weekly to monthly | Supplier tariff sheets (e.g. ECU WW) published with WEF dates |
| Air | Seasonal (month-boundary) | IATA seasons, defined by first/last day of month |
| Haulage | Monthly to quarterly | Contract-based, stable |
| Trucking | Monthly to quarterly | Same |
| Port/Customs/DG | Irregular | Regulatory/carrier announcements, effective-date suits perfectly |

---

### Supplier Tariff Import — Future AI Agent Opportunity

ECU Worldwide tariff sheets observed:
- **Columns:** PORTS, PROVINCE, O/F PER W/M, MIN M3, REMARK, GRI/PSS/RR (surcharge per W/M), ETS (surcharge per W/M), LOCAL CHGS (ALL IN or separate), VIA port, T/T (transit time days), FREIGHT COLLECT flag
- **"ON REQUEST"** values exist — schema must handle null/on-request rates (not zero)
- **Scale:** 2024 files ~1,400 rows; 2026 file ~27,000 rows — supplier massively expanded tariff coverage
- **AI parsing opportunity:** These structured Excel sheets are strong candidates for automated ingestion via AI (aligns with AF Vision AI Agent roadmap — future phase)

---

### Legacy Rate Structure Summary (for schema reference)

**Ocean/Air rates (per monthly record):**
- Base: `price {price, min_price}`, `cost {cost, min_cost}`, `uom`, `currency`, `roundup_qty`
- FCL/LCL surcharges: `low_sulfur_surcharge`, `bunker_adjustment_factor`, `emergency_cost_recovery_surcharge`, `peak_season_surcharge`
- Air surcharges: `fsc` (fuel), `ssc` (security), `msc` (supplement)
- Air weight brackets: `l45`, `p45`, `p100`, `p250`, `p300`, `p500`, `p1000` (price + cost each)
- Price record tracks `lowest_cost` / `highest_cost` across suppliers (auto-maintained)

**Haulage rates (per record):**
- Base: `price`, `cost`, `uom`, `currency`, `roundup_qty`
- Surcharges: `toll_fee`, `side_loader_surcharge`
- FAF: `{ is_faf, is_faf_percent, faf_percent, is_faf_value, faf_value }` — unique to haulage
- Conditions: `is_tariff_rates` boolean

**Port charges (per record):**
- Base: `price`, `cost`, `uom`, `currency`, `roundup_qty`
- No supplier dimension — single price/cost per record
- Conditions: `paid_with_freight` (local charges only)
- `transaction_type` field (IMPORT/EXPORT)

**Container size wildcard `*`** — haulage and local charges support catch-all rates

**`is_domestic` / `is_international`** flags on port charges — matters for same-country shipments

---

### Data Migration Scope

- **Rate history:** January 2024 onwards (`effective_from >= 2024-01-01`)
- **Rate card definitions (lanes/routes):** All active records regardless of date
- **Pre-2024 data:** Left in Datastore, not migrated — archived reference only

---

## Next Session — Immediate Tasks

1. **Pricing schema design:**
   - Design PostgreSQL tables for all 6 rate card domains + their rates tables
   - Define composite PKs, indexes, constraints
   - Handle "ON REQUEST" / null rate states
   - Write Opus prompt for schema + migration script + af-server pricing router skeleton

2. **Before schema design:** Consider reading `logic/financial_components.py` (targeted — just the quotation assembly entry points) to understand how rates are consumed at quotation-build time. This informs which indexes matter most.

---

## Pending Work Queue

### Backlog (Active)
- Delete retired route folders: `shipments/` and `ground-transport/` stubs
- Move detail routes to new paths under `orders/`
- GT smoke tests GT-10 through GT-13

### Deferred
- `/orders/haulage` page design
- Ground transportation design
- Operations Playbook (Jermaine)
- AI agent phases (all post-core)

---

## File Locations
- Legacy reference: `claude/legacy-reference/` (gitignored)
- Active prompt: `claude/prompts/PROMPT-CURRENT.md` (cleared)
- Tests master: `claude/tests/AF-Test-Master.md`
- Backlog: `claude/other/AF-Backlog.md`
- Backfill script: `af-server/scripts/backfill_scope_from_tasks.py`
