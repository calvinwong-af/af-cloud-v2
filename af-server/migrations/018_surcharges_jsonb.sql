-- Migration 018: Add surcharges JSONB column to fcl_rates and lcl_rates
-- Migrates non-zero legacy flat surcharge columns into the new array.
-- Legacy columns (lss, baf, ecrs, psc) are retained but deprecated.

ALTER TABLE fcl_rates ADD COLUMN IF NOT EXISTS surcharges JSONB DEFAULT NULL;
ALTER TABLE lcl_rates ADD COLUMN IF NOT EXISTS surcharges JSONB DEFAULT NULL;

-- Migrate existing non-zero flat surcharge values into the JSONB array for fcl_rates
UPDATE fcl_rates
SET surcharges = (
  SELECT jsonb_agg(item)
  FROM (
    SELECT jsonb_build_object('code', 'LSS', 'description', 'Low Sulphur Surcharge', 'amount', lss) AS item WHERE lss IS NOT NULL AND lss <> 0
    UNION ALL
    SELECT jsonb_build_object('code', 'BAF', 'description', 'Bunker Adjustment Factor', 'amount', baf) WHERE baf IS NOT NULL AND baf <> 0
    UNION ALL
    SELECT jsonb_build_object('code', 'ECRS', 'description', 'Emergency Cost Recovery Surcharge', 'amount', ecrs) WHERE ecrs IS NOT NULL AND ecrs <> 0
    UNION ALL
    SELECT jsonb_build_object('code', 'PSC', 'description', 'Port Security Charge', 'amount', psc) WHERE psc IS NOT NULL AND psc <> 0
  ) sub
)
WHERE (lss IS NOT NULL AND lss <> 0)
   OR (baf IS NOT NULL AND baf <> 0)
   OR (ecrs IS NOT NULL AND ecrs <> 0)
   OR (psc IS NOT NULL AND psc <> 0);

-- Migrate existing non-zero flat surcharge values into the JSONB array for lcl_rates
UPDATE lcl_rates
SET surcharges = (
  SELECT jsonb_agg(item)
  FROM (
    SELECT jsonb_build_object('code', 'LSS', 'description', 'Low Sulphur Surcharge', 'amount', lss) AS item WHERE lss IS NOT NULL AND lss <> 0
    UNION ALL
    SELECT jsonb_build_object('code', 'BAF', 'description', 'Bunker Adjustment Factor', 'amount', baf) WHERE baf IS NOT NULL AND baf <> 0
    UNION ALL
    SELECT jsonb_build_object('code', 'ECRS', 'description', 'Emergency Cost Recovery Surcharge', 'amount', ecrs) WHERE ecrs IS NOT NULL AND ecrs <> 0
    UNION ALL
    SELECT jsonb_build_object('code', 'PSC', 'description', 'Port Security Charge', 'amount', psc) WHERE psc IS NOT NULL AND psc <> 0
  ) sub
)
WHERE (lss IS NOT NULL AND lss <> 0)
   OR (baf IS NOT NULL AND baf <> 0)
   OR (ecrs IS NOT NULL AND ecrs <> 0)
   OR (psc IS NOT NULL AND psc <> 0);
