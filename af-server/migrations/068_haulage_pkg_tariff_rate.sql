-- Migration 068: Flag all Port Klang (MYPKG) haulage rate cards as tariff rate cards.
--
-- PKG haulage follows the tariff pricing model: price = published tariff,
-- cost = tariff × (1 - supplier rebate_percent). The is_tariff_rate flag
-- gates this logic in the quotation engine.

UPDATE haulage_rate_cards
SET is_tariff_rate = TRUE,
    updated_at = NOW()
WHERE port_un_code = 'MYPKG';
