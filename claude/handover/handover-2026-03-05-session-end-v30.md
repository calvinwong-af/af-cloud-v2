# Handover — 2026-03-05 Session End v30

## Session Summary
Geography module extended: haulage areas migrated from Datastore, countries table created and seeded, Geography UI prompt prepared.

---

## Completed This Session

### Haulage Areas Migration (Datastore → PostgreSQL)
- Inspected PricingHaulage Kind in Datastore — 939 active records, 900 unique port:city combos
- Discovered State Kind does not exist in Datastore — state codes embedded in city code strings
- Built `inspect_city_prefixes.py` to extract unique state prefixes from PricingHaulage city_codes
- Found 7 mismatches between Datastore codes and PostgreSQL states table
- Built complete STATE_CODE_MAP:
  - MY-SEL → MY-SGR (Selangor)
  - MY-NE9 → MY-NSN (Negeri Sembilan)
  - MY-TER → MY-TRG (Terengganu)
  - MY-PER → MY-PRK (Perak, alternate code)
  - MY-KLT → MY-KTN (Kelantan)
  - MY-PEJ → MY-PJY (Putrajaya)
  - MY-PKG → MY-SGR (Port Klang area, within Selangor)
- Fixed DB connection in `migrate_haulage_areas.py` to parse `DATABASE_URL` instead of separate env vars
- **Migration executed successfully: 506 haulage areas inserted**

### Countries Table
- Created `af-server/migrations/006_countries.sql` — new `countries` table with full global seed (~180 countries)
- Schema: `country_code (PK)`, `name`, `currency_code`, `currency_symbol`, `tax_label`, `tax_rate`, `tax_applicable`, `is_active`
- Currency rules: MY→MYR, AU→AUD, SG→SGD, EU members→EUR, all others→USD
- Tax pre-populated: MY (SST, 6%), SG (GST, 9%), all others null/false
- Created `af-server/scripts/run_migration_006.py` to execute the migration
- **Migration executed successfully**

### Scripts Cleanup
- Created `af-server/scripts/archive/` directory
- Moved 22 one-time/obsolete scripts to archive (V1→V2 migration scripts, inspection scripts, shipment-specific fix scripts)
- Active scripts folder now has 11 files only

---

## Prompt Ready — GEO-02

**File:** `claude/prompts/PROMPT-CURRENT.md`

Three-part prompt for Opus covering:

1. **Backend** (`af-server/routers/geography.py`)
   - Replace countries stub with full implementation
   - `GET /countries`, `GET /countries/{code}`, `PATCH /countries/{code}`
   - 10-minute in-memory cache following existing port/states pattern
   - `CountryUpdate` Pydantic model (currency + tax fields only, name not updatable)

2. **Frontend actions** (`af-platform/src/app/actions/geography.ts`)
   - Add `Country` TypeScript interface
   - Add `fetchCountriesAction()` and `updateCountryAction()`

3. **Frontend UI** (`_components.tsx` + `page.tsx`)
   - New `FilterCombobox` component (typeable, with clear button)
   - `HaulageAreasTab`: replace `<select>` filters with `FilterCombobox`, add country filter (client-side only, cascades to narrow port options)
   - New `CountriesTab` component — table view with search, edit modal for currency/tax fields
   - New `CountryEditModal` — edits currency_code, currency_symbol, tax_label, tax_rate, tax_applicable
   - `page.tsx`: add Countries to TABS constant, render `CountriesTab`

---

## Key Files Modified This Session
- `af-server/scripts/migrate_haulage_areas.py` — STATE_CODE_MAP updated, DB connection fixed
- `af-server/migrations/006_countries.sql` — created
- `af-server/scripts/run_migration_006.py` — created
- `af-server/scripts/archive/` — 22 scripts moved here

---

## Open Items / Next Steps
1. Execute GEO-02 prompt in Opus
2. Test Countries tab in Geography UI
3. Test Haulage Areas combobox filters (country → port cascade)
4. Eventually revisit `scripts/archive/` to delete permanently
5. Check `backfill_issued_invoice.py` and `fix_issued_invoice.py` — determine if V1-specific and archive

---

## Data State
- `haulage_areas` table: 506 records (migrated from Datastore)
- `countries` table: ~180 records (full global seed, MY SST 6%, SG GST 9%)
- All other tables unchanged
