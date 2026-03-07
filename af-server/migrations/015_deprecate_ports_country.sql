-- Migration 015: Deprecate ports.country, backfill country_code, add FK to countries
--
-- 1. Backfill country_code from UN/LOCODE prefix for all ports where NULL
-- 2. Add FK constraint ports.country_code → countries.country_code
-- 3. Add deprecation comment on ports.country column

-- 1. Backfill country_code from UN/LOCODE prefix for ports with NULL or empty country_code
--    Only for ports where LEFT(un_code, 2) exists in the countries table
--    (i.e. 4+ char UN/LOCODE codes like MYPKG, not 3-char IATA codes like KUL)
UPDATE ports
SET country_code = LEFT(un_code, 2)
WHERE (country_code IS NULL OR country_code = '')
  AND LEFT(un_code, 2) IN (SELECT country_code FROM countries);

-- Set remaining empty strings to NULL so the FK constraint is satisfied
-- (NULL is allowed in a nullable FK, empty string is not)
UPDATE ports
SET country_code = NULL
WHERE country_code = '';

-- 2. Add FK constraint linking ports.country_code → countries.country_code
--    Use ON UPDATE CASCADE so country_code renames propagate automatically
--    Nullable FK (some ports may have codes not yet in countries table)
ALTER TABLE ports
    ADD CONSTRAINT fk_ports_country_code
    FOREIGN KEY (country_code)
    REFERENCES countries(country_code)
    ON UPDATE CASCADE
    DEFERRABLE INITIALLY DEFERRED;

-- 3. Add deprecation comment on ports.country column
COMMENT ON COLUMN ports.country IS
    'DEPRECATED — do not read or write. Country name is owned by the countries table. '
    'This column will be dropped in a future migration once all consumers are updated.';
