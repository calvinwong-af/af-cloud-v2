-- Migration 063: Move currency + uom from haulage_rates to haulage_rate_cards
--
-- Rationale: currency and uom are card-level attributes (same pattern as customs,
-- local charges, DG class charges). They were incorrectly placed on rate rows
-- in migration 037.

-- 1. Add columns to haulage_rate_cards (nullable first for backfill)
ALTER TABLE haulage_rate_cards
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10),
    ADD COLUMN IF NOT EXISTS uom      VARCHAR(20);

-- 2. Backfill from latest rate row per card
UPDATE haulage_rate_cards rc
SET
    currency = sub.currency,
    uom      = sub.uom
FROM (
    SELECT DISTINCT ON (rate_card_id)
        rate_card_id,
        currency,
        uom
    FROM haulage_rates
    ORDER BY rate_card_id, effective_from DESC
) sub
WHERE rc.id = sub.rate_card_id;

-- 3. Apply defaults for any cards with no rate rows
UPDATE haulage_rate_cards
SET currency = 'MYR', uom = 'CONTAINER'
WHERE currency IS NULL OR uom IS NULL;

-- 4. Set NOT NULL constraints
ALTER TABLE haulage_rate_cards
    ALTER COLUMN currency SET NOT NULL,
    ALTER COLUMN uom      SET NOT NULL;

-- 5. Drop currency + uom from haulage_rates
ALTER TABLE haulage_rates
    DROP COLUMN IF EXISTS currency,
    DROP COLUMN IF EXISTS uom;
