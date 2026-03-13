-- Migration 056: Add is_international to customs_rate_cards
-- Extends rate_card_key from 5-part to 6-part

-- Step 1: Add is_international to customs_rate_cards
ALTER TABLE customs_rate_cards
    ADD COLUMN is_international BOOLEAN NOT NULL DEFAULT TRUE;

-- Step 2: Backfill — domestic cards should not apply to international by default
UPDATE customs_rate_cards SET is_international = FALSE WHERE is_domestic = TRUE;

-- Step 3: Rebuild rate_card_key to include is_international (now 6-part)
-- Format: {port_code}|{trade_direction}|{shipment_type}|{charge_code}|{is_domestic}|{is_international}
UPDATE customs_rate_cards
SET rate_card_key = port_code || '|' || trade_direction || '|' || shipment_type || '|' ||
                    charge_code || '|' || is_domestic::text || '|' || is_international::text;

-- Step 4: Update the natural key UNIQUE constraint to include is_international
ALTER TABLE customs_rate_cards DROP CONSTRAINT customs_rate_cards_unique;
ALTER TABLE customs_rate_cards ADD CONSTRAINT customs_rate_cards_unique
    UNIQUE (port_code, trade_direction, shipment_type, charge_code, is_domestic, is_international);
