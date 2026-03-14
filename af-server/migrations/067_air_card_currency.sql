-- Migration 067: Move currency from air_freight_rates and air_list_price_rates
-- to their respective card tables.
--
-- Rationale: currency is a card-level attribute. All rate rows on a given card
-- must share the same currency. Storing per-row allows silent data integrity
-- violations.

-- -----------------------------------------------------------------------
-- A: air_freight_rate_cards (supplier cost cards)
-- -----------------------------------------------------------------------

-- 1. Add column (nullable first for backfill)
ALTER TABLE air_freight_rate_cards
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10);

-- 2. Backfill from latest rate row per card
UPDATE air_freight_rate_cards rc
SET currency = sub.currency
FROM (
    SELECT DISTINCT ON (rate_card_id)
        rate_card_id, currency
    FROM air_freight_rates
    ORDER BY rate_card_id, effective_from DESC
) sub
WHERE rc.id = sub.rate_card_id;

-- 3. Default for cards with no rate rows
UPDATE air_freight_rate_cards
SET currency = 'MYR'
WHERE currency IS NULL;

-- 4. NOT NULL constraint
ALTER TABLE air_freight_rate_cards
    ALTER COLUMN currency SET NOT NULL;

-- 5. Drop from air_freight_rates
ALTER TABLE air_freight_rates
    DROP COLUMN IF EXISTS currency;

-- -----------------------------------------------------------------------
-- B: air_list_price_rate_cards (list price cards)
-- -----------------------------------------------------------------------

-- 1. Add column (nullable first for backfill)
ALTER TABLE air_list_price_rate_cards
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10);

-- 2. Backfill from latest rate row per card
UPDATE air_list_price_rate_cards rc
SET currency = sub.currency
FROM (
    SELECT DISTINCT ON (rate_card_id)
        rate_card_id, currency
    FROM air_list_price_rates
    ORDER BY rate_card_id, effective_from DESC
) sub
WHERE rc.id = sub.rate_card_id;

-- 3. Default for cards with no rate rows
UPDATE air_list_price_rate_cards
SET currency = 'MYR'
WHERE currency IS NULL;

-- 4. NOT NULL constraint
ALTER TABLE air_list_price_rate_cards
    ALTER COLUMN currency SET NOT NULL;

-- 5. Drop from air_list_price_rates
ALTER TABLE air_list_price_rates
    DROP COLUMN IF EXISTS currency;
