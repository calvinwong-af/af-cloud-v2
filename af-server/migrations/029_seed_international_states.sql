-- Migration 029: Seed international states for freight-relevant countries
-- Prerequisites: migration 028 (states.country_code FK to countries)
-- All inserts use ON CONFLICT (state_code) DO NOTHING — safe to re-run.
-- Malaysian states already seeded in migration 004 — not re-inserted here.

-- =========================================================================
-- ASIA PACIFIC
-- =========================================================================

-- China — major provinces/municipalities
INSERT INTO states (state_code, name, country_code) VALUES
    ('CN-AH', 'Anhui',          'CN'),
    ('CN-BJ', 'Beijing',        'CN'),
    ('CN-CQ', 'Chongqing',      'CN'),
    ('CN-FJ', 'Fujian',         'CN'),
    ('CN-GD', 'Guangdong',      'CN'),
    ('CN-GZ', 'Guizhou',        'CN'),
    ('CN-HA', 'Henan',          'CN'),
    ('CN-HB', 'Hubei',          'CN'),
    ('CN-HE', 'Hebei',          'CN'),
    ('CN-HI', 'Hainan',         'CN'),
    ('CN-HL', 'Heilongjiang',   'CN'),
    ('CN-HN', 'Hunan',          'CN'),
    ('CN-JL', 'Jilin',          'CN'),
    ('CN-JS', 'Jiangsu',        'CN'),
    ('CN-JX', 'Jiangxi',        'CN'),
    ('CN-LN', 'Liaoning',       'CN'),
    ('CN-NM', 'Inner Mongolia', 'CN'),
    ('CN-NX', 'Ningxia',        'CN'),
    ('CN-QH', 'Qinghai',        'CN'),
    ('CN-SC', 'Sichuan',        'CN'),
    ('CN-SD', 'Shandong',       'CN'),
    ('CN-SH', 'Shanghai',       'CN'),
    ('CN-SN', 'Shaanxi',        'CN'),
    ('CN-SX', 'Shanxi',         'CN'),
    ('CN-TJ', 'Tianjin',        'CN'),
    ('CN-XJ', 'Xinjiang',       'CN'),
    ('CN-XZ', 'Tibet',          'CN'),
    ('CN-YN', 'Yunnan',         'CN'),
    ('CN-ZJ', 'Zhejiang',       'CN')   -- correct ISO code; CN-ZH was a legacy error
ON CONFLICT (state_code) DO NOTHING;

-- Japan — major prefectures (IATA-derived alpha codes)
INSERT INTO states (state_code, name, country_code) VALUES
    ('JP-TYO', 'Tokyo',     'JP'),
    ('JP-KNW', 'Kanagawa',  'JP'),
    ('JP-OSA', 'Osaka',     'JP'),
    ('JP-KYO', 'Kyoto',     'JP'),
    ('JP-NGO', 'Aichi',     'JP'),
    ('JP-HYO', 'Hyogo',     'JP'),
    ('JP-FUK', 'Fukuoka',   'JP'),
    ('JP-GUN', 'Gunma',     'JP'),
    ('JP-IBR', 'Ibaraki',   'JP')
ON CONFLICT (state_code) DO NOTHING;

-- South Korea (IATA-derived alpha codes)
INSERT INTO states (state_code, name, country_code) VALUES
    ('KR-SEL', 'Seoul',                 'KR'),
    ('KR-PUS', 'Busan',                 'KR'),
    ('KR-ICN', 'Incheon',               'KR'),
    ('KR-KWJ', 'Gwangju',               'KR'),
    ('KR-TAE', 'Daejeon',               'KR'),
    ('KR-USN', 'Ulsan',                 'KR'),
    ('KR-GYG', 'Gyeonggi',              'KR'),
    ('KR-CCN', 'North Chungcheong',     'KR'),
    ('KR-CCS', 'South Chungcheong',     'KR'),
    ('KR-JBN', 'North Jeolla',          'KR'),
    ('KR-JBS', 'South Jeolla',          'KR'),
    ('KR-GBN', 'North Gyeongsang',      'KR'),
    ('KR-GBS', 'South Gyeongsang',      'KR')
ON CONFLICT (state_code) DO NOTHING;

-- India — major states
INSERT INTO states (state_code, name, country_code) VALUES
    ('IN-AP', 'Andhra Pradesh',     'IN'),
    ('IN-AS', 'Assam',              'IN'),
    ('IN-BR', 'Bihar',              'IN'),
    ('IN-DL', 'Delhi',              'IN'),
    ('IN-GJ', 'Gujarat',            'IN'),
    ('IN-HR', 'Haryana',            'IN'),
    ('IN-KA', 'Karnataka',          'IN'),
    ('IN-KL', 'Kerala',             'IN'),
    ('IN-MH', 'Maharashtra',        'IN'),
    ('IN-MP', 'Madhya Pradesh',     'IN'),
    ('IN-OR', 'Odisha',             'IN'),
    ('IN-PB', 'Punjab',             'IN'),
    ('IN-RJ', 'Rajasthan',          'IN'),
    ('IN-TN', 'Tamil Nadu',         'IN'),
    ('IN-TS', 'Telangana',          'IN'),
    ('IN-UP', 'Uttar Pradesh',      'IN'),
    ('IN-WB', 'West Bengal',        'IN')
ON CONFLICT (state_code) DO NOTHING;

-- Indonesia
INSERT INTO states (state_code, name, country_code) VALUES
    ('ID-JB', 'West Java',          'ID'),
    ('ID-JI', 'East Java',          'ID'),
    ('ID-JK', 'Jakarta',            'ID'),
    ('ID-JT', 'Central Java',       'ID'),
    ('ID-KS', 'South Kalimantan',   'ID'),
    ('ID-SN', 'South Sulawesi',     'ID'),
    ('ID-SU', 'North Sumatra',      'ID')
ON CONFLICT (state_code) DO NOTHING;

-- Thailand (IATA-derived alpha codes)
INSERT INTO states (state_code, name, country_code) VALUES
    ('TH-BKK', 'Bangkok',               'TH'),
    ('TH-PTM', 'Pathum Thani',          'TH'),
    ('TH-CBR', 'Chonburi',              'TH'),
    ('TH-CNX', 'Chiang Mai',            'TH'),
    ('TH-NST', 'Nakhon Si Thammarat',   'TH'),
    ('TH-SGK', 'Songkhla',              'TH')
ON CONFLICT (state_code) DO NOTHING;

-- Vietnam
INSERT INTO states (state_code, name, country_code) VALUES
    ('VN-BD', 'Binh Duong',         'VN'),
    ('VN-DN', 'Da Nang',            'VN'),
    ('VN-DNI','Dong Nai',           'VN'),
    ('VN-HP', 'Hai Phong',          'VN'),
    ('VN-HN', 'Hanoi',              'VN'),
    ('VN-QN', 'Quang Ninh',         'VN'),
    ('VN-SGN','Ho Chi Minh City',   'VN')
ON CONFLICT (state_code) DO NOTHING;

-- Bangladesh
INSERT INTO states (state_code, name, country_code) VALUES
    ('BD-BAR', 'Barisal Division',    'BD'),
    ('BD-CHT', 'Chittagong Division', 'BD'),
    ('BD-DHA', 'Dhaka Division',      'BD'),
    ('BD-RAJ', 'Rajshahi Division',   'BD'),
    ('BD-SYL', 'Sylhet Division',     'BD')
ON CONFLICT (state_code) DO NOTHING;

-- Australia
INSERT INTO states (state_code, name, country_code) VALUES
    ('AU-ACT', 'Australian Capital Territory',  'AU'),
    ('AU-NSW', 'New South Wales',               'AU'),
    ('AU-NT',  'Northern Territory',            'AU'),
    ('AU-QLD', 'Queensland',                    'AU'),
    ('AU-SA',  'South Australia',               'AU'),
    ('AU-TAS', 'Tasmania',                      'AU'),
    ('AU-VIC', 'Victoria',                      'AU'),
    ('AU-WA',  'Western Australia',             'AU')
ON CONFLICT (state_code) DO NOTHING;

-- New Zealand
INSERT INTO states (state_code, name, country_code) VALUES
    ('NZ-AUK', 'Auckland',      'NZ'),
    ('NZ-CAN', 'Canterbury',    'NZ'),
    ('NZ-LYT', 'Christchurch',  'NZ'),
    ('NZ-WGN', 'Wellington',    'NZ')
ON CONFLICT (state_code) DO NOTHING;

-- City-states — single state record mirrors country
INSERT INTO states (state_code, name, country_code) VALUES
    ('BN-00', 'Brunei',     'BN'),
    ('HK-00', 'Hong Kong',  'HK'),
    ('KH-00', 'Cambodia',   'KH'),
    ('MN-00', 'Mongolia',   'MN'),
    ('MO-00', 'Macau',      'MO'),
    ('SG-00', 'Singapore',  'SG')
ON CONFLICT (state_code) DO NOTHING;

-- =========================================================================
-- MIDDLE EAST
-- =========================================================================

-- UAE — all 7 emirates
INSERT INTO states (state_code, name, country_code) VALUES
    ('AE-AJ', 'Ajman',          'AE'),
    ('AE-AZ', 'Abu Dhabi',      'AE'),
    ('AE-DU', 'Dubai',          'AE'),
    ('AE-FU', 'Fujairah',       'AE'),
    ('AE-RK', 'Ras Al Khaimah', 'AE'),
    ('AE-SH', 'Sharjah',        'AE'),
    ('AE-UQ', 'Umm Al Quwain',  'AE')
ON CONFLICT (state_code) DO NOTHING;

-- Saudi Arabia, Tunisia
INSERT INTO states (state_code, name, country_code) VALUES
    ('SA-RIY', 'Riyadh',            'SA'),
    ('SA-MKH', 'Makkah',            'SA'),
    ('SA-EST', 'Eastern Province',  'SA'),
    ('TN-TUN', 'Tunis',             'TN'),
    ('TN-NAB', 'Nabeul',            'TN')
ON CONFLICT (state_code) DO NOTHING;

-- =========================================================================
-- EUROPE
-- =========================================================================

-- Germany — all 16 Bundesländer
INSERT INTO states (state_code, name, country_code) VALUES
    ('DE-BB', 'Brandenburg',            'DE'),
    ('DE-BE', 'Berlin',                 'DE'),
    ('DE-BW', 'Baden-Württemberg',      'DE'),
    ('DE-BY', 'Bavaria',                'DE'),
    ('DE-HB', 'Bremen',                 'DE'),
    ('DE-HE', 'Hesse',                  'DE'),
    ('DE-HH', 'Hamburg',                'DE'),
    ('DE-MV', 'Mecklenburg-Vorpommern', 'DE'),
    ('DE-NI', 'Lower Saxony',           'DE'),
    ('DE-NW', 'North Rhine-Westphalia', 'DE'),
    ('DE-RP', 'Rhineland-Palatinate',   'DE'),
    ('DE-SH', 'Schleswig-Holstein',     'DE'),
    ('DE-SL', 'Saarland',              'DE'),
    ('DE-SN', 'Saxony',                 'DE'),
    ('DE-ST', 'Saxony-Anhalt',          'DE'),
    ('DE-TH', 'Thuringia',              'DE')
ON CONFLICT (state_code) DO NOTHING;

-- United Kingdom
INSERT INTO states (state_code, name, country_code) VALUES
    ('GB-ENG', 'England',           'GB'),
    ('GB-NIR', 'Northern Ireland',  'GB'),
    ('GB-SCT', 'Scotland',          'GB'),
    ('GB-WLS', 'Wales',             'GB')
ON CONFLICT (state_code) DO NOTHING;

-- France — 13 metropolitan regions
INSERT INTO states (state_code, name, country_code) VALUES
    ('FR-ARA', 'Auvergne-Rhône-Alpes',         'FR'),
    ('FR-BFC', 'Bourgogne-Franche-Comté',       'FR'),
    ('FR-BRE', 'Brittany',                      'FR'),
    ('FR-CVL', 'Centre-Val de Loire',           'FR'),
    ('FR-GES', 'Grand Est',                     'FR'),
    ('FR-HDF', 'Hauts-de-France',               'FR'),
    ('FR-IDF', 'Île-de-France',                 'FR'),
    ('FR-NAQ', 'Nouvelle-Aquitaine',            'FR'),
    ('FR-NOR', 'Normandy',                      'FR'),
    ('FR-OCC', 'Occitanie',                     'FR'),
    ('FR-PAC', 'Provence-Alpes-Côte d''Azur',  'FR'),
    ('FR-PDL', 'Pays de la Loire',              'FR'),
    ('FR-LRE', 'La Réunion',                    'FR')
ON CONFLICT (state_code) DO NOTHING;

-- Italy — ISO 3166-2 alpha codes
INSERT INTO states (state_code, name, country_code) VALUES
    ('IT-CAL', 'Calabria',              'IT'),
    ('IT-CAM', 'Campania',              'IT'),
    ('IT-EMR', 'Emilia-Romagna',        'IT'),
    ('IT-FVG', 'Friuli-Venezia Giulia', 'IT'),
    ('IT-LAZ', 'Lazio',                 'IT'),
    ('IT-LIG', 'Liguria',               'IT'),   -- covers Genoa / ITGOA
    ('IT-LOM', 'Lombardy',              'IT'),
    ('IT-MAR', 'Marche',                'IT'),
    ('IT-MOL', 'Molise',                'IT'),
    ('IT-PIE', 'Piedmont',              'IT'),
    ('IT-PUG', 'Apulia',                'IT'),
    ('IT-SAR', 'Sardinia',              'IT'),
    ('IT-SIC', 'Sicily',                'IT'),
    ('IT-TOS', 'Tuscany',               'IT'),
    ('IT-TRE', 'Trentino-Alto Adige',   'IT'),
    ('IT-UMB', 'Umbria',                'IT'),
    ('IT-VDA', 'Aosta Valley',          'IT'),
    ('IT-VEN', 'Veneto',                'IT')
ON CONFLICT (state_code) DO NOTHING;

-- Spain
INSERT INTO states (state_code, name, country_code) VALUES
    ('ES-AN', 'Andalusia',              'ES'),
    ('ES-AR', 'Aragon',                 'ES'),
    ('ES-AS', 'Asturias',               'ES'),
    ('ES-CB', 'Cantabria',              'ES'),
    ('ES-CL', 'Castile and León',       'ES'),
    ('ES-CM', 'Castile-La Mancha',      'ES'),
    ('ES-CN', 'Canary Islands',         'ES'),
    ('ES-CT', 'Catalonia',              'ES'),
    ('ES-EX', 'Extremadura',            'ES'),
    ('ES-GA', 'Galicia',                'ES'),
    ('ES-IB', 'Balearic Islands',       'ES'),
    ('ES-MC', 'Murcia',                 'ES'),
    ('ES-MD', 'Community of Madrid',    'ES'),
    ('ES-NC', 'Navarre',                'ES'),
    ('ES-PV', 'Basque Country',         'ES'),
    ('ES-RI', 'La Rioja',               'ES'),
    ('ES-VC', 'Valencia',               'ES')
ON CONFLICT (state_code) DO NOTHING;

-- Netherlands, Belgium, Poland, Portugal, Switzerland
INSERT INTO states (state_code, name, country_code) VALUES
    ('BE-BRU', 'Brussels',          'BE'),
    ('BE-VAN', 'Antwerp',           'BE'),
    ('BE-VBR', 'Flemish Brabant',   'BE'),
    ('BE-WLG', 'Liège',             'BE'),
    ('CH-BE',  'Bern',              'CH'),
    ('CH-GE',  'Geneva',            'CH'),
    ('CH-ZH',  'Zurich',            'CH'),
    ('NL-GR',  'Groningen',         'NL'),
    ('NL-NB',  'North Brabant',     'NL'),
    ('NL-NH',  'North Holland',     'NL'),
    ('NL-ZH',  'South Holland',     'NL'),
    ('PL-DS',  'Lower Silesian',    'PL'),
    ('PL-MZ',  'Masovian',          'PL'),
    ('PL-PM',  'Pomeranian',        'PL'),
    ('PT-LIS', 'Lisbon',            'PT'),
    ('PT-OPO', 'Porto',             'PT'),
    ('PT-CEN', 'Centro',            'PT')
ON CONFLICT (state_code) DO NOTHING;

-- Slovenia — city-state treatment
INSERT INTO states (state_code, name, country_code) VALUES
    ('SI-00', 'Slovenia', 'SI')
ON CONFLICT (state_code) DO NOTHING;

-- =========================================================================
-- AMERICAS
-- =========================================================================

-- United States — major states
INSERT INTO states (state_code, name, country_code) VALUES
    ('US-AZ', 'Arizona',        'US'),
    ('US-CA', 'California',     'US'),
    ('US-FL', 'Florida',        'US'),
    ('US-GA', 'Georgia',        'US'),
    ('US-IL', 'Illinois',       'US'),
    ('US-IN', 'Indiana',        'US'),
    ('US-LA', 'Louisiana',      'US'),
    ('US-MI', 'Michigan',       'US'),
    ('US-MN', 'Minnesota',      'US'),
    ('US-NC', 'North Carolina', 'US'),
    ('US-NJ', 'New Jersey',     'US'),
    ('US-NY', 'New York',       'US'),
    ('US-OH', 'Ohio',           'US'),
    ('US-OR', 'Oregon',         'US'),
    ('US-PA', 'Pennsylvania',   'US'),
    ('US-TN', 'Tennessee',      'US'),
    ('US-TX', 'Texas',          'US'),
    ('US-VA', 'Virginia',       'US'),
    ('US-WA', 'Washington',     'US'),
    ('US-WI', 'Wisconsin',      'US')
ON CONFLICT (state_code) DO NOTHING;
