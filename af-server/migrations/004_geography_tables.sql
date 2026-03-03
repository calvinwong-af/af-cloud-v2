-- Migration 004: Geography tables (states, cities, haulage_areas) + ports lat/lng
-- Run against the accelefreight database.

-- States
CREATE TABLE IF NOT EXISTS states (
    state_code   VARCHAR(10)  PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    country_code VARCHAR(2)   NOT NULL DEFAULT 'MY',
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE
);

-- Cities
CREATE TABLE IF NOT EXISTS cities (
    city_id      SERIAL       PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    state_code   VARCHAR(10)  NOT NULL REFERENCES states(state_code),
    lat          NUMERIC(9,6) NULL,
    lng          NUMERIC(9,6) NULL,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE
);

-- Haulage Areas
CREATE TABLE IF NOT EXISTS haulage_areas (
    area_id      SERIAL       PRIMARY KEY,
    area_code    VARCHAR(20)  NOT NULL,
    area_name    VARCHAR(150) NOT NULL,
    port_un_code VARCHAR(10)  NOT NULL,
    state_code   VARCHAR(10)  REFERENCES states(state_code),
    city_id      INTEGER      REFERENCES cities(city_id),
    lat          NUMERIC(9,6) NULL,
    lng          NUMERIC(9,6) NULL,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    UNIQUE (area_code, port_un_code)
);

-- Add coordinates to existing ports table
ALTER TABLE ports ADD COLUMN IF NOT EXISTS lat NUMERIC(9,6) NULL;
ALTER TABLE ports ADD COLUMN IF NOT EXISTS lng NUMERIC(9,6) NULL;

-- =========================================================================
-- Seed data: Malaysian states
-- =========================================================================

INSERT INTO states (state_code, name, country_code) VALUES
    ('MY-JHR', 'Johor', 'MY'),
    ('MY-KDH', 'Kedah', 'MY'),
    ('MY-KTN', 'Kelantan', 'MY'),
    ('MY-MLK', 'Melaka', 'MY'),
    ('MY-NSN', 'Negeri Sembilan', 'MY'),
    ('MY-PHG', 'Pahang', 'MY'),
    ('MY-PNG', 'Penang', 'MY'),
    ('MY-PRK', 'Perak', 'MY'),
    ('MY-PLS', 'Perlis', 'MY'),
    ('MY-SGR', 'Selangor', 'MY'),
    ('MY-TRG', 'Terengganu', 'MY'),
    ('MY-SBH', 'Sabah', 'MY'),
    ('MY-SWK', 'Sarawak', 'MY'),
    ('MY-KUL', 'Kuala Lumpur', 'MY'),
    ('MY-LBN', 'Labuan', 'MY'),
    ('MY-PJY', 'Putrajaya', 'MY')
ON CONFLICT (state_code) DO NOTHING;

-- =========================================================================
-- Seed data: Malaysian cities (with coordinates)
-- =========================================================================

-- Selangor (MY-SGR)
INSERT INTO cities (name, state_code, lat, lng) VALUES
    ('Shah Alam', 'MY-SGR', 3.0733, 101.5185),
    ('Subang Jaya', 'MY-SGR', 3.0565, 101.5851),
    ('Petaling Jaya', 'MY-SGR', 3.1073, 101.6068),
    ('Klang', 'MY-SGR', 3.0449, 101.4455),
    ('Puchong', 'MY-SGR', 3.0255, 101.6170),
    ('Sepang', 'MY-SGR', 2.6874, 101.7425),
    ('Kajang', 'MY-SGR', 2.9927, 101.7909),
    ('Rawang', 'MY-SGR', 3.3214, 101.5768),
    ('Banting', 'MY-SGR', 2.8167, 101.5000),
    ('Kuala Selangor', 'MY-SGR', 3.3500, 101.2500),
    ('Ampang', 'MY-SGR', 3.1500, 101.7667),
    ('Cheras (Selangor)', 'MY-SGR', 3.0378, 101.7536)
ON CONFLICT DO NOTHING;

-- Kuala Lumpur (MY-KUL)
INSERT INTO cities (name, state_code, lat, lng) VALUES
    ('Kuala Lumpur City Centre', 'MY-KUL', 3.1578, 101.7117),
    ('Cheras (KL)', 'MY-KUL', 3.1073, 101.7295),
    ('Kepong', 'MY-KUL', 3.2087, 101.6329),
    ('Setapak', 'MY-KUL', 3.1897, 101.7102),
    ('Wangsa Maju', 'MY-KUL', 3.1984, 101.7353),
    ('Bangsar', 'MY-KUL', 3.1288, 101.6717),
    ('Mont Kiara', 'MY-KUL', 3.1710, 101.6508)
ON CONFLICT DO NOTHING;

-- Johor (MY-JHR)
INSERT INTO cities (name, state_code, lat, lng) VALUES
    ('Johor Bahru', 'MY-JHR', 1.4927, 103.7414),
    ('Pasir Gudang', 'MY-JHR', 1.4726, 103.8970),
    ('Kulai', 'MY-JHR', 1.6589, 103.5983),
    ('Batu Pahat', 'MY-JHR', 1.8548, 102.9325),
    ('Muar', 'MY-JHR', 2.0442, 102.5689),
    ('Segamat', 'MY-JHR', 2.5144, 102.8158),
    ('Kluang', 'MY-JHR', 2.0251, 103.3200),
    ('Mersing', 'MY-JHR', 2.4312, 103.8405)
ON CONFLICT DO NOTHING;

-- Penang (MY-PNG)
INSERT INTO cities (name, state_code, lat, lng) VALUES
    ('George Town', 'MY-PNG', 5.4141, 100.3288),
    ('Butterworth', 'MY-PNG', 5.3991, 100.3638),
    ('Bayan Lepas', 'MY-PNG', 5.3025, 100.2733),
    ('Bukit Mertajam', 'MY-PNG', 5.3630, 100.4607),
    ('Seberang Prai', 'MY-PNG', 5.3845, 100.3995)
ON CONFLICT DO NOTHING;

-- Perak (MY-PRK)
INSERT INTO cities (name, state_code, lat, lng) VALUES
    ('Ipoh', 'MY-PRK', 4.5975, 101.0901),
    ('Taiping', 'MY-PRK', 4.8517, 100.7363),
    ('Telok Intan', 'MY-PRK', 4.0259, 101.0213),
    ('Lumut', 'MY-PRK', 4.2304, 100.6294),
    ('Sitiawan', 'MY-PRK', 4.2167, 100.7000)
ON CONFLICT DO NOTHING;

-- Kedah (MY-KDH)
INSERT INTO cities (name, state_code, lat, lng) VALUES
    ('Alor Setar', 'MY-KDH', 6.1248, 100.3685),
    ('Sungai Petani', 'MY-KDH', 5.6474, 100.4880),
    ('Kulim', 'MY-KDH', 5.3650, 100.5550),
    ('Langkawi', 'MY-KDH', 6.3500, 99.8000)
ON CONFLICT DO NOTHING;

-- Negeri Sembilan (MY-NSN)
INSERT INTO cities (name, state_code, lat, lng) VALUES
    ('Seremban', 'MY-NSN', 2.7258, 101.9424),
    ('Nilai', 'MY-NSN', 2.8186, 101.7977),
    ('Port Dickson', 'MY-NSN', 2.5227, 101.7956),
    ('Senawang', 'MY-NSN', 2.7056, 101.9547)
ON CONFLICT DO NOTHING;

-- Melaka (MY-MLK)
INSERT INTO cities (name, state_code, lat, lng) VALUES
    ('Kota Melaka', 'MY-MLK', 2.1896, 102.2501),
    ('Ayer Keroh', 'MY-MLK', 2.2700, 102.2808),
    ('Alor Gajah', 'MY-MLK', 2.3810, 102.2070),
    ('Jasin', 'MY-MLK', 2.3063, 102.4313)
ON CONFLICT DO NOTHING;

-- Pahang (MY-PHG)
INSERT INTO cities (name, state_code, lat, lng) VALUES
    ('Kuantan', 'MY-PHG', 3.8077, 103.3260),
    ('Temerloh', 'MY-PHG', 3.4517, 102.4174),
    ('Bentong', 'MY-PHG', 3.5223, 101.9085),
    ('Raub', 'MY-PHG', 3.7896, 101.8574),
    ('Kuala Lipis', 'MY-PHG', 4.1844, 101.9431)
ON CONFLICT DO NOTHING;

-- Terengganu (MY-TRG)
INSERT INTO cities (name, state_code, lat, lng) VALUES
    ('Kuala Terengganu', 'MY-TRG', 5.3117, 103.1324),
    ('Kemaman', 'MY-TRG', 4.2333, 103.4167),
    ('Dungun', 'MY-TRG', 4.7752, 103.4210)
ON CONFLICT DO NOTHING;

-- Kelantan (MY-KTN)
INSERT INTO cities (name, state_code, lat, lng) VALUES
    ('Kota Bharu', 'MY-KTN', 6.1254, 102.2381),
    ('Pasir Mas', 'MY-KTN', 6.0500, 102.1400),
    ('Tanah Merah', 'MY-KTN', 5.8075, 102.1480)
ON CONFLICT DO NOTHING;

-- Perlis (MY-PLS)
INSERT INTO cities (name, state_code, lat, lng) VALUES
    ('Kangar', 'MY-PLS', 6.4414, 100.1986)
ON CONFLICT DO NOTHING;

-- Putrajaya (MY-PJY)
INSERT INTO cities (name, state_code, lat, lng) VALUES
    ('Putrajaya', 'MY-PJY', 2.9264, 101.6964)
ON CONFLICT DO NOTHING;

-- Sabah (MY-SBH)
INSERT INTO cities (name, state_code, lat, lng) VALUES
    ('Kota Kinabalu', 'MY-SBH', 5.9804, 116.0735),
    ('Sandakan', 'MY-SBH', 5.8402, 118.1179),
    ('Tawau', 'MY-SBH', 4.2498, 117.8871)
ON CONFLICT DO NOTHING;

-- Sarawak (MY-SWK)
INSERT INTO cities (name, state_code, lat, lng) VALUES
    ('Kuching', 'MY-SWK', 1.5497, 110.3592),
    ('Miri', 'MY-SWK', 4.3995, 114.0126),
    ('Sibu', 'MY-SWK', 2.2870, 111.8312)
ON CONFLICT DO NOTHING;

-- Labuan (MY-LBN)
INSERT INTO cities (name, state_code, lat, lng) VALUES
    ('Labuan', 'MY-LBN', 5.2831, 115.2308)
ON CONFLICT DO NOTHING;
