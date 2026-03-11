-- Migration 033 — Seed legacy transport areas with standardised codes
-- These 123 area codes originate from legacy Datastore PricingTransport city_codes.
-- All codes have been standardised to {STATE_CODE}-{3-digit sequence} format.
-- MY-JHR new codes start at 030 (existing haulage areas occupy 001–029).
-- MY-KUL new codes start at 070 (existing haulage areas occupy 001–069 + 000).
-- MY-KUL-000 and MY-MLK-000 already exist in areas table — excluded from INSERT.
-- All state_codes verified against prod states table before writing this migration.

BEGIN;

-- Step 1: Pre-check — abort if areas table does not have the expected unique constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'areas_area_code_key'
    ) THEN
        RAISE EXCEPTION 'Migration aborted: areas_area_code_key constraint not found. Run migration 031 first.';
    END IF;
END $$;

-- Step 2: INSERT 123 area rows
-- ON CONFLICT (area_code) DO NOTHING — safe to re-run
INSERT INTO areas (area_code, area_name, state_code, is_active) VALUES

    -- AE-DU
    ('AE-DU-001', 'Umm Ramool', 'AE-DU', true),
    ('AE-DU-002', 'Dubai', 'AE-DU', true),
    ('AE-DU-003', 'Dubai Logistics City', 'AE-DU', true),

    -- AU-NSW
    ('AU-NSW-001', 'Sydney Metro', 'AU-NSW', true),

    -- AU-WA
    ('AU-WA-001', 'Ellenbrook', 'AU-WA', true),

    -- BD-DHA
    ('BD-DHA-001', 'Mohammadpur', 'BD-DHA', true),

    -- BE-VAN
    ('BE-VAN-001', 'Wijnegem, Antwerp', 'BE-VAN', true),

    -- BN-00
    ('BN-00-001', 'Tutong District', 'BN-00', true),

    -- CH-BE
    ('CH-BE-001', 'Burgdorf', 'CH-BE', true),

    -- CH-ZH
    ('CH-ZH-001', 'Zurich', 'CH-ZH', true),

    -- CN-AH
    ('CN-AH-001', 'Lu''an, Anhui', 'CN-AH', true),

    -- CN-BJ
    ('CN-BJ-001', 'Beijing', 'CN-BJ', true),
    ('CN-BJ-002', 'Chaoyang', 'CN-BJ', true),
    ('CN-BJ-003', 'Haidian District', 'CN-BJ', true),

    -- CN-FJ
    ('CN-FJ-001', 'Fujian', 'CN-FJ', true),
    ('CN-FJ-002', 'Huli District, Xiamen', 'CN-FJ', true),

    -- CN-GD
    ('CN-GD-001', 'Guangdong', 'CN-GD', true),
    ('CN-GD-002', 'Nansha District, Guangzhou', 'CN-GD', true),
    ('CN-GD-003', 'Zengcheng District, Guangzhou', 'CN-GD', true),
    ('CN-GD-004', 'Zhongshan', 'CN-GD', true),
    ('CN-GD-005', 'Shenzhen', 'CN-GD', true),
    ('CN-GD-006', 'Foshan', 'CN-GD', true),
    ('CN-GD-007', 'Huizhou City', 'CN-GD', true),
    ('CN-GD-008', 'Wanjiang District, Dongguan', 'CN-GD', true),

    -- CN-GZ
    ('CN-GZ-001', 'Huangpu District, Guangzhou', 'CN-GZ', true),

    -- CN-HB
    ('CN-HB-001', 'Xiantao, Hubei', 'CN-HB', true),

    -- CN-HE
    ('CN-HE-001', 'Shijiazhuang', 'CN-HE', true),

    -- CN-JS
    ('CN-JS-001', 'Jiangsu', 'CN-JS', true),
    ('CN-JS-002', 'Yixing City', 'CN-JS', true),
    ('CN-JS-003', 'Suqian', 'CN-JS', true),
    ('CN-JS-004', 'Suzhou', 'CN-JS', true),

    -- CN-LN
    ('CN-LN-001', 'Shenyang', 'CN-LN', true),

    -- CN-SC
    ('CN-SC-001', 'Chengdu', 'CN-SC', true),

    -- CN-SD
    ('CN-SD-001', 'Qingdao', 'CN-SD', true),

    -- CN-SH
    ('CN-SH-001', 'Minhang District, Shanghai', 'CN-SH', true),

    -- CN-ZJ
    ('CN-ZJ-001', 'Huzhou', 'CN-ZJ', true),
    ('CN-ZJ-002', 'Ningbo City', 'CN-ZJ', true),
    ('CN-ZJ-003', 'Wenzhou City', 'CN-ZJ', true),

    -- DE-BY
    ('DE-BY-001', 'Unterfoehring', 'DE-BY', true),

    -- DE-NW
    ('DE-NW-001', 'Herzebrock-Clarholz', 'DE-NW', true),
    ('DE-NW-002', 'Wuppertal', 'DE-NW', true),

    -- DE-SH
    ('DE-SH-001', 'Kaltenkirchen', 'DE-SH', true),

    -- ES-AN
    ('ES-AN-001', 'Torremolinos, Malaga', 'ES-AN', true),

    -- ES-CT
    ('ES-CT-001', 'Esparreguera', 'ES-CT', true),

    -- ES-IB
    ('ES-IB-001', 'Es Pil-lari, Islas Baleares', 'ES-IB', true),

    -- ES-MD
    ('ES-MD-001', 'Meco, Madrid', 'ES-MD', true),

    -- FR-ARA
    ('FR-ARA-001', 'Saint-Vulbas', 'FR-ARA', true),

    -- FR-BFC
    ('FR-BFC-001', 'Sens', 'FR-BFC', true),

    -- GB-ENG
    ('GB-ENG-001', 'Erdington, Birmingham', 'GB-ENG', true),
    ('GB-ENG-002', 'Stourbridge', 'GB-ENG', true),

    -- HK-00
    ('HK-00-001', 'Hong Kong Island', 'HK-00', true),
    ('HK-00-002', 'New Territory', 'HK-00', true),

    -- ID-JI
    ('ID-JI-001', 'Surabaya', 'ID-JI', true),
    ('ID-JI-002', 'Situbondo', 'ID-JI', true),
    ('ID-JI-003', 'Asemrowo', 'ID-JI', true),

    -- ID-JK
    ('ID-JK-001', 'North Jakarta', 'ID-JK', true),

    -- IN-AP
    ('IN-AP-001', 'Kakinada', 'IN-AP', true),

    -- IN-GJ
    ('IN-GJ-001', 'Kheda', 'IN-GJ', true),

    -- IN-KA
    ('IN-KA-001', 'Bangalore', 'IN-KA', true),

    -- IN-RJ
    ('IN-RJ-001', 'Jaipur', 'IN-RJ', true),

    -- IN-UP
    ('IN-UP-001', 'Bhadohi', 'IN-UP', true),
    ('IN-UP-002', 'Saharanpur', 'IN-UP', true),

    -- IT-EMR
    ('IT-EMR-001', 'San Martino in Rio', 'IT-EMR', true),
    ('IT-EMR-002', 'Ravenna', 'IT-EMR', true),

    -- IT-LAZ
    ('IT-LAZ-001', 'Rome', 'IT-LAZ', true),

    -- IT-LOM
    ('IT-LOM-001', 'Sesto San Giovanni', 'IT-LOM', true),
    ('IT-LOM-002', 'Fagnano Olona', 'IT-LOM', true),

    -- JP-GUN
    ('JP-GUN-001', 'Takasaki', 'JP-GUN', true),

    -- JP-IBR
    ('JP-IBR-001', 'Tsukuba', 'JP-IBR', true),

    -- JP-KYO
    ('JP-KYO-001', 'Kyoto', 'JP-KYO', true),

    -- JP-TYO
    ('JP-TYO-001', 'Shinjuku City', 'JP-TYO', true),
    ('JP-TYO-002', 'Itabashi City', 'JP-TYO', true),

    -- KH-00
    ('KH-00-001', 'Phnom Penh', 'KH-00', true),

    -- KR-GYG
    ('KR-GYG-001', 'Gyeonggi-do', 'KR-GYG', true),

    -- KR-ICN
    ('KR-ICN-001', 'Bupyeong', 'KR-ICN', true),

    -- KR-PUS
    ('KR-PUS-001', 'Busan', 'KR-PUS', true),

    -- KR-SEL
    ('KR-SEL-001', 'Songpa-gu, Seoul', 'KR-SEL', true),

    -- MN-00
    ('MN-00-001', 'Ulaanbaatar', 'MN-00', true),

    -- MO-00
    ('MO-00-001', 'Macau Island', 'MO-00', true),

    -- MY-JHR (existing haulage areas occupy 001–029; new codes start at 030)
    ('MY-JHR-030', 'Johor', 'MY-JHR', true),
    ('MY-JHR-031', 'Masai', 'MY-JHR', true),

    -- MY-KUL (existing haulage areas occupy 001–069 + MY-KUL-000; new codes start at 070)
    ('MY-KUL-070', 'Wilayah Persekutuan KL', 'MY-KUL', true),
    ('MY-KUL-071', 'Cheras', 'MY-KUL', true),
    ('MY-KUL-072', 'Gombak', 'MY-KUL', true),
    ('MY-KUL-073', 'Setapak', 'MY-KUL', true),

    -- MY-LBN
    ('MY-LBN-001', 'Rancha Rancha Industrial, Labuan', 'MY-LBN', true),
    ('MY-LBN-002', 'Jalan Arsat, Labuan', 'MY-LBN', true),

    -- MY-SBH
    ('MY-SBH-001', 'Beaufort', 'MY-SBH', true),
    ('MY-SBH-002', 'Sipitang', 'MY-SBH', true),
    ('MY-SBH-003', 'Tawau', 'MY-SBH', true),

    -- MY-SGR
    ('MY-SGR-001', 'Ampang Jaya', 'MY-SGR', true),

    -- MY-SWK
    ('MY-SWK-001', 'Bintawa Industrial Estate', 'MY-SWK', true),
    ('MY-SWK-002', 'Muara Tebas', 'MY-SWK', true),
    ('MY-SWK-003', 'Tabuan Jaya', 'MY-SWK', true),
    ('MY-SWK-004', 'Kota Samarahan', 'MY-SWK', true),
    ('MY-SWK-005', 'Permyjaya Technology Park', 'MY-SWK', true),
    ('MY-SWK-006', 'Lawas', 'MY-SWK', true),

    -- NL-GR
    ('NL-GR-001', 'Groningen', 'NL-GR', true),

    -- NZ-CAN
    ('NZ-CAN-001', 'Huntingdon', 'NZ-CAN', true),

    -- PL-MZ
    ('PL-MZ-001', 'Lomianki', 'PL-MZ', true),

    -- PL-PM
    ('PL-PM-001', 'Dobrzewino', 'PL-PM', true),

    -- PT-OPO
    ('PT-OPO-001', 'Carvalhosa', 'PT-OPO', true),
    ('PT-OPO-002', 'Barcelos', 'PT-OPO', true),

    -- SG-00
    ('SG-00-001', 'Changi', 'SG-00', true),
    ('SG-00-002', 'Tannery Road', 'SG-00', true),
    ('SG-00-003', 'Jurong East', 'SG-00', true),

    -- SI-00
    ('SI-00-001', 'Kocevje', 'SI-00', true),

    -- TH-BKK
    ('TH-BKK-001', 'Bangkok', 'TH-BKK', true),
    ('TH-BKK-002', 'Suan Luang District', 'TH-BKK', true),
    ('TH-BKK-003', 'Din Daeng District', 'TH-BKK', true),

    -- TH-PTM
    ('TH-PTM-001', 'Pathum Thani', 'TH-PTM', true),

    -- TN-NAB
    ('TN-NAB-001', 'Menzel Temime', 'TN-NAB', true),

    -- TW-00
    ('TW-00-001', 'Hsinchu', 'TW-00', true),
    ('TW-00-002', 'New Taipei City', 'TW-00', true),
    ('TW-00-003', 'Tamsui District', 'TW-00', true),

    -- US-IN
    ('US-IN-001', 'Elkhart', 'US-IN', true),

    -- US-LA
    ('US-LA-001', 'Harahan', 'US-LA', true),

    -- US-OH
    ('US-OH-001', 'Springboro', 'US-OH', true),
    ('US-OH-002', 'Dayton', 'US-OH', true),

    -- US-TX
    ('US-TX-001', 'Hidalgo', 'US-TX', true),

    -- VN-HN
    ('VN-HN-001', 'Hanoi', 'VN-HN', true),

    -- VN-QN
    ('VN-QN-001', 'Quang Ninh', 'VN-QN', true),

    -- VN-SGN
    ('VN-SGN-001', 'Ho Chi Minh City, District 11', 'VN-SGN', true)

ON CONFLICT (area_code) DO NOTHING;

-- Step 3: Verification — abort if insert count is unexpected
DO $$
DECLARE
    new_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO new_count
    FROM areas
    WHERE area_code IN (
        'AE-DU-001','AE-DU-002','AE-DU-003',
        'AU-NSW-001','AU-WA-001','BD-DHA-001','BE-VAN-001','BN-00-001',
        'CH-BE-001','CH-ZH-001',
        'CN-AH-001','CN-BJ-001','CN-BJ-002','CN-BJ-003',
        'CN-FJ-001','CN-FJ-002',
        'CN-GD-001','CN-GD-002','CN-GD-003','CN-GD-004',
        'CN-GD-005','CN-GD-006','CN-GD-007','CN-GD-008',
        'CN-GZ-001','CN-HB-001','CN-HE-001',
        'CN-JS-001','CN-JS-002','CN-JS-003','CN-JS-004',
        'CN-LN-001','CN-SC-001','CN-SD-001','CN-SH-001',
        'CN-ZJ-001','CN-ZJ-002','CN-ZJ-003',
        'DE-BY-001','DE-NW-001','DE-NW-002','DE-SH-001',
        'ES-AN-001','ES-CT-001','ES-IB-001','ES-MD-001',
        'FR-ARA-001','FR-BFC-001',
        'GB-ENG-001','GB-ENG-002',
        'HK-00-001','HK-00-002',
        'ID-JI-001','ID-JI-002','ID-JI-003','ID-JK-001',
        'IN-AP-001','IN-GJ-001','IN-KA-001','IN-RJ-001',
        'IN-UP-001','IN-UP-002',
        'IT-EMR-001','IT-EMR-002','IT-LAZ-001','IT-LOM-001','IT-LOM-002',
        'JP-GUN-001','JP-IBR-001','JP-KYO-001','JP-TYO-001','JP-TYO-002',
        'KH-00-001',
        'KR-GYG-001','KR-ICN-001','KR-PUS-001','KR-SEL-001',
        'MN-00-001','MO-00-001',
        'MY-JHR-030','MY-JHR-031',
        'MY-KUL-070','MY-KUL-071','MY-KUL-072','MY-KUL-073',
        'MY-LBN-001','MY-LBN-002',
        'MY-SBH-001','MY-SBH-002','MY-SBH-003',
        'MY-SGR-001',
        'MY-SWK-001','MY-SWK-002','MY-SWK-003',
        'MY-SWK-004','MY-SWK-005','MY-SWK-006',
        'NL-GR-001','NZ-CAN-001',
        'PL-MZ-001','PL-PM-001',
        'PT-OPO-001','PT-OPO-002',
        'SG-00-001','SG-00-002','SG-00-003',
        'SI-00-001',
        'TH-BKK-001','TH-BKK-002','TH-BKK-003','TH-PTM-001',
        'TN-NAB-001',
        'TW-00-001','TW-00-002','TW-00-003',
        'US-IN-001','US-LA-001','US-OH-001','US-OH-002','US-TX-001',
        'VN-HN-001','VN-QN-001','VN-SGN-001'
    );

    IF new_count != 123 THEN
        RAISE EXCEPTION
            'Migration 033 verification failed: expected 123 transport area rows, found %.', new_count;
    END IF;

    RAISE NOTICE 'Migration 033 verification passed: 123 transport area rows confirmed.';
END $$;

COMMIT;
