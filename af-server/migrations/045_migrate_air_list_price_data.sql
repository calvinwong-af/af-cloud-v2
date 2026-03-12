-- Migration 045: Migrate Air List Price Data
--
-- Copies existing supplier_id IS NULL rows from air_freight_rates into the
-- new air_list_price_rates table, via air_list_price_rate_cards.
--
-- Steps:
--   1. Create one air_list_price_rate_cards record per unique O/D+DG combination
--      found in air_freight_rate_cards.
--   2. For each O/D+DG card, copy supplier_id IS NULL rows from air_freight_rates
--      (across ALL airline cards sharing that O/D+DG) into air_list_price_rates.
--      Deduplication: where multiple airline cards have a row for the same
--      effective_from, keep the row with the highest p100_list_price (most
--      recent data is considered most authoritative; if tied, arbitrary pick).
--   3. The original supplier_id IS NULL rows in air_freight_rates are left
--      intact for now — they will be deleted post-verification once the new
--      backend is deployed and confirmed working.
--
-- Safe to run multiple times: INSERT uses ON CONFLICT DO NOTHING.

-- ---------------------------------------------------------------------------
-- Step 1: Create air_list_price_rate_cards for each unique O/D+DG combination
-- ---------------------------------------------------------------------------

INSERT INTO air_list_price_rate_cards (
    rate_card_key,
    origin_port_code,
    destination_port_code,
    dg_class_code,
    code,
    description,
    is_active
)
SELECT DISTINCT
    rc.origin_port_code || ':' || rc.destination_port_code || ':' || rc.dg_class_code AS rate_card_key,
    rc.origin_port_code,
    rc.destination_port_code,
    rc.dg_class_code,
    'FR-AIR'    AS code,
    ''          AS description,
    TRUE        AS is_active
FROM air_freight_rate_cards rc
ON CONFLICT (rate_card_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Step 2: Copy list price rate rows into air_list_price_rates
--
-- For each O/D+DG, gather all supplier_id IS NULL rows from air_freight_rates
-- across all airline cards that share that route. Deduplicate by
-- (lp_card_id, effective_from) — keep the row with the highest p100_list_price.
-- ---------------------------------------------------------------------------

INSERT INTO air_list_price_rates (
    rate_card_id,
    effective_from,
    effective_to,
    rate_status,
    currency,
    l45_list_price,
    p45_list_price,
    p100_list_price,
    p250_list_price,
    p300_list_price,
    p500_list_price,
    p1000_list_price,
    min_list_price,
    surcharges,
    created_at,
    updated_at
)
SELECT
    lp.id               AS rate_card_id,
    r.effective_from,
    r.effective_to,
    r.rate_status,
    r.currency,
    r.l45_list_price,
    r.p45_list_price,
    r.p100_list_price,
    r.p250_list_price,
    r.p300_list_price,
    r.p500_list_price,
    r.p1000_list_price,
    r.min_list_price,
    r.surcharges,
    r.created_at,
    r.updated_at
FROM (
    -- Deduplicate: one row per (lp_card_key, effective_from)
    -- ranked by p100_list_price DESC, then id DESC as tiebreaker
    SELECT DISTINCT ON (
        rc.origin_port_code || ':' || rc.destination_port_code || ':' || rc.dg_class_code,
        r.effective_from
    )
        rc.origin_port_code || ':' || rc.destination_port_code || ':' || rc.dg_class_code AS lp_key,
        r.id,
        r.effective_from,
        r.effective_to,
        r.rate_status,
        r.currency,
        r.l45_list_price,
        r.p45_list_price,
        r.p100_list_price,
        r.p250_list_price,
        r.p300_list_price,
        r.p500_list_price,
        r.p1000_list_price,
        r.min_list_price,
        r.surcharges,
        r.created_at,
        r.updated_at
    FROM air_freight_rates r
    JOIN air_freight_rate_cards rc ON rc.id = r.rate_card_id
    WHERE r.supplier_id IS NULL
    ORDER BY
        rc.origin_port_code || ':' || rc.destination_port_code || ':' || rc.dg_class_code,
        r.effective_from,
        r.p100_list_price DESC NULLS LAST,
        r.id DESC
) r
JOIN air_list_price_rate_cards lp ON lp.rate_card_key = r.lp_key;

-- ---------------------------------------------------------------------------
-- Verification queries (run manually after applying to confirm counts)
-- ---------------------------------------------------------------------------
-- SELECT COUNT(*) FROM air_list_price_rate_cards;
--   Should equal: SELECT COUNT(DISTINCT origin_port_code || ':' || destination_port_code || ':' || dg_class_code) FROM air_freight_rate_cards;
--
-- SELECT COUNT(*) FROM air_list_price_rates;
--   Should be <= SELECT COUNT(*) FROM air_freight_rates WHERE supplier_id IS NULL;
--   (less due to deduplication across airline cards sharing same O/D+DG+effective_from)
--
-- SELECT lp.rate_card_key, COUNT(*) AS rate_rows
-- FROM air_list_price_rates r
-- JOIN air_list_price_rate_cards lp ON lp.id = r.rate_card_id
-- GROUP BY lp.rate_card_key ORDER BY rate_rows DESC LIMIT 20;
