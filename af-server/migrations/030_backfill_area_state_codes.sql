-- Migration 030: Backfill state_code on NULL international area rows
-- Patches data originally seeded by deprecated migration 027.
-- Also seeds TW-00 (Taiwan city-state) and removes duplicate NZ-LYT state.
-- Safe to re-run — all area UPDATEs are guarded by AND state_code IS NULL.
-- Prerequisite: migration 029 (international states seeded).
-- Do not run until migration 029_seed_international_states.sql has been applied.

-- =========================================================================
-- Step 0 — Seed TW state (Taiwan)
-- =========================================================================

INSERT INTO states (state_code, name, country_code)
VALUES ('TW-00', 'Taiwan', 'TW')
ON CONFLICT (state_code) DO NOTHING;

-- =========================================================================
-- Step 1 — Remove duplicate NZ-LYT state
-- NZ-LYT ('Christchurch') is a duplicate of NZ-CAN (Canterbury).
-- No area rows reference NZ-LYT yet. NZ areas assigned NZ-AUK in Step 4.
-- =========================================================================

DELETE FROM states WHERE state_code = 'NZ-LYT';

-- =========================================================================
-- Step 2 — Fix UK prefix area rows → GB-ENG
-- UK is not a valid ISO country code. Two area rows (UK-B24, UK-D7) were
-- seeded with this incorrect prefix. Assign them to GB-ENG (England).
-- The area_code values themselves are kept as-is (legacy identifiers).
-- =========================================================================

UPDATE areas SET state_code = 'GB-ENG'
WHERE area_code LIKE 'UK-%' AND state_code IS NULL;

-- =========================================================================
-- Step 3 — Fix CN-ZH area row → CN-ZJ (Zhejiang)
-- One area row (CN-ZH-05, Huzhou) used a legacy incorrect state prefix.
-- The correct Zhejiang state code is CN-ZJ. The area_code is kept as-is.
-- =========================================================================

UPDATE areas SET state_code = 'CN-ZJ'
WHERE area_code LIKE 'CN-ZH%' AND state_code IS NULL;

-- =========================================================================
-- Step 4 — Bulk backfill all remaining NULL area rows
-- =========================================================================

-- -------------------------------------------------------------------------
-- MIDDLE EAST
-- -------------------------------------------------------------------------

-- UAE — Dubai
UPDATE areas SET state_code = 'AE-DU'
WHERE area_code IN ('AE-215', 'AE-DXB-000', 'AE-DXB-002') AND state_code IS NULL;

-- -------------------------------------------------------------------------
-- ASIA PACIFIC
-- -------------------------------------------------------------------------

-- Australia
UPDATE areas SET state_code = 'AU-NSW'
WHERE area_code LIKE 'AU-NSW%' AND state_code IS NULL;

UPDATE areas SET state_code = 'AU-WA'
WHERE area_code LIKE 'AU-WA%' AND state_code IS NULL;

-- Bangladesh — Chittagong Division
UPDATE areas SET state_code = 'BD-CHT'
WHERE area_code LIKE 'BD-%' AND state_code IS NULL;

-- Brunei
UPDATE areas SET state_code = 'BN-00'
WHERE area_code LIKE 'BN-%' AND state_code IS NULL;

-- China — Anhui
UPDATE areas SET state_code = 'CN-AH'
WHERE area_code LIKE 'CN-AH%' AND state_code IS NULL;

-- China — Beijing
UPDATE areas SET state_code = 'CN-BJ'
WHERE area_code LIKE 'CN-BJ%' AND state_code IS NULL;

-- China — Fujian
UPDATE areas SET state_code = 'CN-FJ'
WHERE area_code LIKE 'CN-FJ%' AND state_code IS NULL;

-- China — Guangdong
-- Note: CN-GDG-* (Dongguan) and CN-GZ-020 (Huangpu/Guangzhou) are
-- also Guangdong — the GZ in CN-GZ-020 is a legacy area code artefact,
-- not the province of Guizhou.
UPDATE areas SET state_code = 'CN-GD'
WHERE (area_code LIKE 'CN-GD%' OR area_code LIKE 'CN-GDG%' OR area_code = 'CN-GZ-020')
AND state_code IS NULL;

-- China — Hubei
UPDATE areas SET state_code = 'CN-HB'
WHERE area_code LIKE 'CN-HB%' AND state_code IS NULL;

-- China — Hebei
UPDATE areas SET state_code = 'CN-HE'
WHERE area_code LIKE 'CN-HE%' AND state_code IS NULL;

-- China — Jiangsu
UPDATE areas SET state_code = 'CN-JS'
WHERE area_code LIKE 'CN-JS%' AND state_code IS NULL;

-- China — Liaoning
UPDATE areas SET state_code = 'CN-LN'
WHERE area_code LIKE 'CN-LN%' AND state_code IS NULL;

-- China — Sichuan
UPDATE areas SET state_code = 'CN-SC'
WHERE area_code LIKE 'CN-SC%' AND state_code IS NULL;

-- China — Shandong
UPDATE areas SET state_code = 'CN-SD'
WHERE area_code LIKE 'CN-SD%' AND state_code IS NULL;

-- China — Shanghai
UPDATE areas SET state_code = 'CN-SH'
WHERE area_code LIKE 'CN-SH%' AND state_code IS NULL;

-- China — Zhejiang (includes CN-ZJ-* rows; CN-ZH-* already handled in Step 3)
UPDATE areas SET state_code = 'CN-ZJ'
WHERE area_code LIKE 'CN-ZJ%' AND state_code IS NULL;

-- Hong Kong
UPDATE areas SET state_code = 'HK-00'
WHERE area_code LIKE 'HK-%' AND state_code IS NULL;

-- Indonesia — East Java (Surabaya)
UPDATE areas SET state_code = 'ID-JI'
WHERE area_code IN ('ID-31', 'ID-338', 'ID-60183') AND state_code IS NULL;

-- Indonesia — Jakarta
UPDATE areas SET state_code = 'ID-JK'
WHERE area_code LIKE 'ID-JKT%' AND state_code IS NULL;

-- India — Uttar Pradesh
UPDATE areas SET state_code = 'IN-UP'
WHERE area_code IN ('IN-221401', 'IN-247001') AND state_code IS NULL;

-- India — Rajasthan (Jaipur)
UPDATE areas SET state_code = 'IN-RJ'
WHERE area_code = 'IN-302003' AND state_code IS NULL;

-- India — Andhra Pradesh (Kakinada)
UPDATE areas SET state_code = 'IN-AP'
WHERE area_code = 'IN-533005' AND state_code IS NULL;

-- India — Gujarat
UPDATE areas SET state_code = 'IN-GJ'
WHERE area_code LIKE 'IN-GJ%' AND state_code IS NULL;

-- India — Karnataka
UPDATE areas SET state_code = 'IN-KA'
WHERE area_code LIKE 'IN-KA%' AND state_code IS NULL;

-- Japan — Tokyo
UPDATE areas SET state_code = 'JP-TYO'
WHERE area_code IN ('JP-160', 'JP-173') AND state_code IS NULL;

-- Japan — Ibaraki
UPDATE areas SET state_code = 'JP-IBR'
WHERE area_code = 'JP-311' AND state_code IS NULL;

-- Japan — Gunma
UPDATE areas SET state_code = 'JP-GUN'
WHERE area_code = 'JP-370' AND state_code IS NULL;

-- Japan — Kyoto
UPDATE areas SET state_code = 'JP-KYO'
WHERE area_code = 'JP-616-8312' AND state_code IS NULL;

-- Cambodia
UPDATE areas SET state_code = 'KH-00'
WHERE area_code LIKE 'KH-%' AND state_code IS NULL;

-- South Korea — Incheon
UPDATE areas SET state_code = 'KR-ICN'
WHERE area_code = 'KR-INC-001' AND state_code IS NULL;

-- South Korea — Gyeonggi-do
UPDATE areas SET state_code = 'KR-GYG'
WHERE area_code = 'KR-INC-002' AND state_code IS NULL;

-- South Korea — Busan
UPDATE areas SET state_code = 'KR-PUS'
WHERE area_code LIKE 'KR-PUS%' AND state_code IS NULL;

-- South Korea — Seoul
UPDATE areas SET state_code = 'KR-SEL'
WHERE area_code LIKE 'KR-SEL%' AND state_code IS NULL;

-- Mongolia
UPDATE areas SET state_code = 'MN-00'
WHERE area_code LIKE 'MN-%' AND state_code IS NULL;

-- Macau
UPDATE areas SET state_code = 'MO-00'
WHERE area_code LIKE 'MO-%' AND state_code IS NULL;

-- New Zealand — Auckland
UPDATE areas SET state_code = 'NZ-AUK'
WHERE area_code LIKE 'NZ-%' AND state_code IS NULL;

-- Singapore
UPDATE areas SET state_code = 'SG-00'
WHERE area_code LIKE 'SG-%' AND state_code IS NULL;

-- Thailand — Pathum Thani (TH-13 is the legacy numeric code for Pathum Thani province)
UPDATE areas SET state_code = 'TH-PTM'
WHERE area_code = 'TH-13' AND state_code IS NULL;

-- Thailand — Bangkok
UPDATE areas SET state_code = 'TH-BKK'
WHERE area_code LIKE 'TH-BKK%' AND state_code IS NULL;

-- Taiwan
UPDATE areas SET state_code = 'TW-00'
WHERE area_code LIKE 'TW-%' AND state_code IS NULL;

-- Vietnam — Quang Ninh
UPDATE areas SET state_code = 'VN-QN'
WHERE area_code = 'VN-013' AND state_code IS NULL;

-- Vietnam — Hanoi
UPDATE areas SET state_code = 'VN-HN'
WHERE area_code = 'VN-024' AND state_code IS NULL;

-- Vietnam — Ho Chi Minh City
UPDATE areas SET state_code = 'VN-SGN'
WHERE area_code LIKE 'VN-028%' AND state_code IS NULL;

-- -------------------------------------------------------------------------
-- EUROPE
-- -------------------------------------------------------------------------

-- Belgium — Antwerp
UPDATE areas SET state_code = 'BE-VAN'
WHERE area_code LIKE 'BE-AN%' AND state_code IS NULL;

-- Switzerland — Zurich
UPDATE areas SET state_code = 'CH-ZH'
WHERE area_code LIKE 'CH-%' AND state_code IS NULL;

-- Germany — per area (no single prefix covers all DE rows)
UPDATE areas SET state_code = 'DE-SH'
WHERE area_code = 'DE-24568' AND state_code IS NULL;  -- Kaltenkirchen, Schleswig-Holstein

UPDATE areas SET state_code = 'DE-NW'
WHERE area_code IN ('DE-33442', 'DE-42329') AND state_code IS NULL;  -- Herzebrock-Clarholz, Wuppertal

UPDATE areas SET state_code = 'DE-BY'
WHERE area_code = 'DE-85774' AND state_code IS NULL;  -- Unterföhring, Bavaria

-- Spain — per area
UPDATE areas SET state_code = 'ES-IB'
WHERE area_code = 'ES-07608' AND state_code IS NULL;  -- Balearic Islands

UPDATE areas SET state_code = 'ES-CT'
WHERE area_code = 'ES-08292' AND state_code IS NULL;  -- Esparreguera, Catalonia

UPDATE areas SET state_code = 'ES-MD'
WHERE area_code = 'ES-28880' AND state_code IS NULL;  -- Meco, Madrid

UPDATE areas SET state_code = 'ES-AN'
WHERE area_code = 'ES-29620' AND state_code IS NULL;  -- Torremolinos, Andalusia

-- France — Auvergne-Rhône-Alpes
UPDATE areas SET state_code = 'FR-ARA'
WHERE area_code LIKE 'FR-ARA%' AND state_code IS NULL;

-- France — Bourgogne-Franche-Comté
UPDATE areas SET state_code = 'FR-BFC'
WHERE area_code LIKE 'FR-BFC%' AND state_code IS NULL;

-- Italy — per area
UPDATE areas SET state_code = 'IT-LAZ'
WHERE area_code = 'IT-00159' AND state_code IS NULL;  -- Rome, Lazio

UPDATE areas SET state_code = 'IT-LOM'
WHERE area_code IN ('IT-20099', 'IT-21054') AND state_code IS NULL;  -- Sesto San Giovanni, Fagnano Olona

UPDATE areas SET state_code = 'IT-EMR'
WHERE area_code IN ('IT-42018', 'IT-45-001') AND state_code IS NULL;  -- San Martino in Rio, Ravenna

-- Netherlands — Groningen
UPDATE areas SET state_code = 'NL-GR'
WHERE area_code LIKE 'NL-%' AND state_code IS NULL;

-- Poland — per area
UPDATE areas SET state_code = 'PL-MZ'
WHERE area_code = 'PL-05092' AND state_code IS NULL;  -- Lomianki, Masovian (Warsaw area)

UPDATE areas SET state_code = 'PL-PM'
WHERE area_code = 'PL-80209' AND state_code IS NULL;  -- Dobrzewino, Pomeranian (Gdansk area)

-- Portugal — Porto region
UPDATE areas SET state_code = 'PT-OPO'
WHERE area_code LIKE 'PT-%' AND state_code IS NULL;

-- Slovenia
UPDATE areas SET state_code = 'SI-00'
WHERE area_code LIKE 'SI-%' AND state_code IS NULL;

-- Tunisia
UPDATE areas SET state_code = 'TN-TUN'
WHERE area_code LIKE 'TN-%' AND state_code IS NULL;

-- -------------------------------------------------------------------------
-- AMERICAS
-- -------------------------------------------------------------------------

-- United States — per state
UPDATE areas SET state_code = 'US-IN'
WHERE area_code LIKE 'US-IN%' AND state_code IS NULL;  -- Indiana

UPDATE areas SET state_code = 'US-LA'
WHERE area_code LIKE 'US-LA%' AND state_code IS NULL;  -- Louisiana

UPDATE areas SET state_code = 'US-OH'
WHERE area_code LIKE 'US-OH%' AND state_code IS NULL;  -- Ohio

UPDATE areas SET state_code = 'US-TX'
WHERE area_code LIKE 'US-TX%' AND state_code IS NULL;  -- Texas

-- =========================================================================
-- Step 5 — Verification block
-- =========================================================================

DO $$
DECLARE remaining INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining FROM areas WHERE state_code IS NULL;
    IF remaining > 0 THEN
        RAISE EXCEPTION
            'Migration 030 incomplete: % area row(s) still have NULL state_code. '
            'Check area_codes against states table and rerun.',
            remaining;
    END IF;
    RAISE NOTICE 'Migration 030 complete — all % area rows have state_code assigned.',
        (SELECT COUNT(*) FROM areas);
END $$;
