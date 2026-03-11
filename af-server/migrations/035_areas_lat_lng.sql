-- Migration 035: Add lat/lng columns to areas for geo-matching
ALTER TABLE areas
    ADD COLUMN IF NOT EXISTS lat NUMERIC(10, 7) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS lng NUMERIC(10, 7) DEFAULT NULL;

-- Index for spatial queries (optional but useful for large area sets)
CREATE INDEX IF NOT EXISTS idx_areas_lat_lng ON areas (lat, lng)
    WHERE lat IS NOT NULL AND lng IS NOT NULL;
