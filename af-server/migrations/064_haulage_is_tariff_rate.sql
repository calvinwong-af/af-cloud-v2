-- Migration 064: Add is_tariff_rate to haulage_rate_cards
--
-- is_tariff_rate = TRUE means this route's cost is derived from the haulage
-- council's published tariff table + supplier rebate, rather than a directly
-- negotiated rate. This flag is informational and affects how the cost is
-- displayed and potentially calculated.

ALTER TABLE haulage_rate_cards
    ADD COLUMN IF NOT EXISTS is_tariff_rate BOOLEAN NOT NULL DEFAULT FALSE;
