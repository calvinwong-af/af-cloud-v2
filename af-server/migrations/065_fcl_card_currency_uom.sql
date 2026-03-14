-- Migration 065: Move currency + uom from fcl_rates to fcl_rate_cards
--
-- Rationale: currency and uom are card-level attributes. All rate rows on a
-- given card must share the same currency and UOM. Storing per-row exposes
-- the system to silent data integrity violations.

-- 1. Add columns to fcl_rate_cards (nullable first for backfill)
ALTER TABLE fcl_rate_cards
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10),
    ADD COLUMN IF NOT EXISTS uom      VARCHAR(20);

-- 2. Backfill from latest rate row per card
UPDATE fcl_rate_cards rc
SET
    currency = sub.currency,
    uom      = sub.uom
FROM (
    SELECT DISTINCT ON (rate_card_id)
        rate_card_id,
        currency,
        uom
    FROM fcl_rates
    ORDER BY rate_card_id, effective_from DESC
) sub
WHERE rc.id = sub.rate_card_id;

-- 3. Apply defaults for any cards with no rate rows
UPDATE fcl_rate_cards
SET currency = 'MYR', uom = 'CONTAINER'
WHERE currency IS NULL OR uom IS NULL;

-- 4. Set NOT NULL constraints
ALTER TABLE fcl_rate_cards
    ALTER COLUMN currency SET NOT NULL,
    ALTER COLUMN uom      SET NOT NULL;

-- 5. Drop currency + uom from fcl_rates
ALTER TABLE fcl_rates
    DROP COLUMN IF EXISTS currency,
    DROP COLUMN IF EXISTS uom;
