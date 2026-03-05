# Prompt Completion Log — v4.21–v4.30

### [2026-03-05 20:15 UTC] — v-DISP-01: Port Name Format + Container Size Normalisation
- **Status:** Completed
- **Tasks:**
  - **Fix A:** Trimmed leading dashes (em-dash, en-dash, hyphen) from `port.name` in `getPortLabel()` via regex `^[\s\u2014\u2013\-]+`
  - **Fix B:** Added `normaliseContainerSize()` with `TYPE_SUFFIX_MAP` to convert raw carrier codes (e.g. `40FF` → `40' FR`, `20ST` → `20' GP`). Falls back to raw code if unrecognised.
- **Files Modified:**
  - `af-platform/src/lib/ports.ts`
  - `af-platform/src/app/(platform)/shipments/[id]/_components.tsx`

### [2026-03-05 20:00 UTC] — v-GEO-06: FilterCombobox: Fix X Button Focus + Behaviour Sweep
- **Status:** Completed
- **Tasks:**
  - Added `useRef` for input element in `FilterCombobox`
  - X button now clears value, opens dropdown, and refocuses input via `setTimeout`
  - Dropdown now shows "No results" message when query matches nothing (instead of hiding entirely)
  - Verified existing behaviours (option select, Escape key, onBlur timing) still work correctly
- **Files Modified:**
  - `af-platform/src/app/(platform)/geography/_components.tsx`

### [2026-03-05 19:45 UTC] — v-GEO-05: Country Filter Label Consistency + China Provinces Seed
- **Status:** Completed
- **Tasks:**
  - **Change A:** Standardised country filter labels in StatesTab and CitiesTab to `${code} — ${name}` format by fetching countries data and building a `countryMap`. PortsTab and HaulageAreasTab already had correct format.
  - **Change B:** Created `run_migration_007.py` and seeded 33 China provinces/municipalities/autonomous regions/SARs into the `states` table using ISO 3166-2:CN codes.
- **Files Modified:**
  - `af-platform/src/app/(platform)/geography/_components.tsx`
  - `af-server/scripts/run_migration_007.py` (new)

### [2026-03-05 19:15 UTC] — v-GEO-04: Countries Tab: Remove Currency Symbol + Fix Euro Encoding
- **Status:** Completed
- **Tasks:**
  - **Change A:** Removed `currency_symbol` from all layers — `Country` interface, `updateCountryAction` params, `CountryUpdate` Pydantic model, `list_countries`/`get_country` SELECT queries, `update_country` field loop, `CountriesTab` table display, `CountryEditModal` state/field/payload.
  - **Change B:** Verified Euro symbol encoding — `€` (U+20AC) was already correctly stored in production DB (1 char, 3 bytes UTF-8). No mojibake present; no data fix needed.
- **Files Modified:**
  - `af-platform/src/app/(platform)/geography/_components.tsx`
  - `af-platform/src/app/actions/geography.ts`
  - `af-server/routers/geography.py`
