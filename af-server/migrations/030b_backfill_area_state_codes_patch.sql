-- Migration 030b: Patch — backfill remaining 25 NULL area rows missed by migration 030
-- Causes: missing states (CA, CN-GX, CN-HA, FR-NAQ, ID-JT, JP-MIE, LK, NO, SE, TH-NBR, US-IL)
--         and missing UPDATE patterns (CN-GZ-04, CN-TJ, DE, IT, JP-135, US-AZ mislabel)
-- Safe to re-run — all area UPDATEs guarded by AND state_code IS NULL.
-- Prerequisite: migration 030 applied.

-- =========================================================================
-- Step 0 — Seed missing states
-- =========================================================================

-- Canada (city-state treatment — only Winnipeg area present)
INSERT INTO countries (country_code, name, currency_code, currency_symbol)
VALUES ('CA', 'Canada', 'CAD', 'CA$')
ON CONFLICT (country_code) DO NOTHING;

INSERT INTO states (state_code, name, country_code)
VALUES ('CA-MB', 'Manitoba', 'CA')
ON CONFLICT (state_code) DO NOTHING;

-- China — missing provinces
INSERT INTO states (state_code, name, country_code) VALUES
    ('CN-GX', 'Guangxi',    'CN'),
    ('CN-HA', 'Henan',      'CN')   -- CN-HA is the correct ISO code for Henan (CN-HA already in seed? verify)
ON CONFLICT (state_code) DO NOTHING;

-- France — Nouvelle-Aquitaine
INSERT INTO states (state_code, name, country_code)
VALUES ('FR-NAQ', 'Nouvelle-Aquitaine', 'FR')
ON CONFLICT (state_code) DO NOTHING;

-- Indonesia — Central Java
INSERT INTO states (state_code, name, country_code)
VALUES ('ID-JT', 'Central Java', 'ID')
ON CONFLICT (state_code) DO NOTHING;

-- Japan — Mie prefecture
INSERT INTO states (state_code, name, country_code)
VALUES ('JP-MIE', 'Mie', 'JP')
ON CONFLICT (state_code) DO NOTHING;

-- Sri Lanka (city-state treatment)
INSERT INTO countries (country_code, name, currency_code, currency_symbol)
VALUES ('LK', 'Sri Lanka', 'USD', '$')
ON CONFLICT (country_code) DO NOTHING;

INSERT INTO states (state_code, name, country_code)
VALUES ('LK-00', 'Sri Lanka', 'LK')
ON CONFLICT (state_code) DO NOTHING;

-- Norway
INSERT INTO countries (country_code, name, currency_code, currency_symbol)
VALUES ('NO', 'Norway', 'USD', '$')
ON CONFLICT (country_code) DO NOTHING;

INSERT INTO states (state_code, name, country_code)
VALUES ('NO-00', 'Norway', 'NO')
ON CONFLICT (state_code) DO NOTHING;

-- Sweden (already in countries as EUR/EU member)
INSERT INTO states (state_code, name, country_code)
VALUES ('SE-00', 'Sweden', 'SE')
ON CONFLICT (state_code) DO NOTHING;

-- Thailand — Nonthaburi
INSERT INTO states (state_code, name, country_code)
VALUES ('TH-NBR', 'Nonthaburi', 'TH')
ON CONFLICT (state_code) DO NOTHING;

-- United States — Illinois
INSERT INTO states (state_code, name, country_code)
VALUES ('US-IL', 'Illinois', 'US')
ON CONFLICT (state_code) DO NOTHING;

-- United States — Arkansas (for mislabelled US-AZ-72110 rows — Morrilton is AR not AZ)
INSERT INTO states (state_code, name, country_code)
VALUES ('US-AR', 'Arkansas', 'US')
ON CONFLICT (state_code) DO NOTHING;

-- =========================================================================
-- Step 1 — Backfill remaining NULL area rows
-- =========================================================================

-- Canada — Manitoba (Winnipeg)
UPDATE areas SET state_code = 'CA-MB'
WHERE area_code LIKE 'CA-%' AND state_code IS NULL;

-- China — Guangxi
UPDATE areas SET state_code = 'CN-GX'
WHERE area_code LIKE 'CN-GX%' AND state_code IS NULL;

-- China — Guizhou (CN-GZ-04 — Anshun; distinct from CN-GZ-020 which is Guangdong)
UPDATE areas SET state_code = 'CN-GZ'
WHERE area_code LIKE 'CN-GZ%' AND state_code IS NULL;

-- China — Henan (CN-HA prefix)
UPDATE areas SET state_code = 'CN-HA'
WHERE area_code LIKE 'CN-HA%' AND state_code IS NULL;

-- China — Tianjin (missed in 030 — no UPDATE pattern was written for CN-TJ)
UPDATE areas SET state_code = 'CN-TJ'
WHERE area_code LIKE 'CN-TJ%' AND state_code IS NULL;

-- Germany — additional postal codes missed by explicit list in 030
UPDATE areas SET state_code = 'DE-NW'
WHERE area_code = 'DE-45549' AND state_code IS NULL;  -- Sprockhövel, NRW

UPDATE areas SET state_code = 'DE-BY'
WHERE area_code = 'DE-63741' AND state_code IS NULL;  -- Aschaffenburg, Bavaria

-- France — Nouvelle-Aquitaine
UPDATE areas SET state_code = 'FR-NAQ'
WHERE area_code LIKE 'FR-NAQ%' AND state_code IS NULL;

-- Indonesia — Central Java (Semarang, Grobogan, Jepara)
UPDATE areas SET state_code = 'ID-JT'
WHERE area_code IN ('ID-24', 'ID-292', 'ID-59') AND state_code IS NULL;

-- Italy — additional areas missed by explicit list in 030
UPDATE areas SET state_code = 'IT-PIE'
WHERE area_code = 'IT-001272' AND state_code IS NULL;  -- Turin, Piedmont

UPDATE areas SET state_code = 'IT-SIC'
WHERE area_code = 'IT-PA-90013' AND state_code IS NULL;  -- Castelbuono, Sicily

-- Japan — Tokyo (JP-135 Koto City missed by explicit list in 030)
UPDATE areas SET state_code = 'JP-TYO'
WHERE area_code = 'JP-135' AND state_code IS NULL;

-- Japan — Mie (JP-24-510 Kawagoe — note: Kawagoe in Mie is distinct from Kawagoe in Saitama)
UPDATE areas SET state_code = 'JP-MIE'
WHERE area_code = 'JP-24-510' AND state_code IS NULL;

-- Sri Lanka
UPDATE areas SET state_code = 'LK-00'
WHERE area_code LIKE 'LK-%' AND state_code IS NULL;

-- Norway
UPDATE areas SET state_code = 'NO-00'
WHERE area_code LIKE 'NO-%' AND state_code IS NULL;

-- Sweden
UPDATE areas SET state_code = 'SE-00'
WHERE area_code LIKE 'SE-%' AND state_code IS NULL;

-- Thailand — Nonthaburi (TH-11000 — numeric prefix not matched by TH-BKK% or TH-PTM)
UPDATE areas SET state_code = 'TH-NBR'
WHERE area_code = 'TH-11000' AND state_code IS NULL;

-- United States — Arkansas (legacy data mislabelled as AZ — Morrilton is in AR)
-- area_code US-AZ-72110 is kept as-is; state_code corrected to US-AR
UPDATE areas SET state_code = 'US-AR'
WHERE area_code = 'US-AZ-72110' AND state_code IS NULL;

-- United States — Illinois
UPDATE areas SET state_code = 'US-IL'
WHERE area_code LIKE 'US-IL%' AND state_code IS NULL;

-- =========================================================================
-- Step 2 — Verification block
-- =========================================================================

DO $$
DECLARE remaining INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining FROM areas WHERE state_code IS NULL;
    IF remaining > 0 THEN
        RAISE EXCEPTION
            'Migration 030b incomplete: % area row(s) still have NULL state_code. '
            'Check area_codes against states table and rerun.',
            remaining;
    END IF;
    RAISE NOTICE 'Migration 030b complete — all % area rows now have state_code assigned.',
        (SELECT COUNT(*) FROM areas);
END $$;
