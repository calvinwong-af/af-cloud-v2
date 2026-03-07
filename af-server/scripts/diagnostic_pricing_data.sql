-- =============================================================================
-- Pricing Data Diagnostic
-- Run against Cloud SQL (prod) or local DB via Cloud SQL Auth Proxy
-- Purpose: Understand current state of migrated FCL/LCL data before
--          deciding whether to run remigrate_pricing_freight.py
-- =============================================================================

-- 1. FCL rate cards — breakdown by origin port
--    Shows how many cards exist per origin, and how many have at least one rate
SELECT
    rc.origin_port_code,
    COUNT(DISTINCT rc.id)                                      AS total_cards,
    COUNT(DISTINCT r.rate_card_id)                             AS cards_with_rates,
    COUNT(r.id)                                                AS total_rates,
    MIN(r.effective_from)                                      AS earliest_rate,
    MAX(r.effective_from)                                      AS latest_rate
FROM fcl_rate_cards rc
LEFT JOIN fcl_rates r ON r.rate_card_id = rc.id
GROUP BY rc.origin_port_code
ORDER BY rc.origin_port_code;

-- =============================================================================

-- 2. LCL rate cards — breakdown by origin port (same shape)
SELECT
    rc.origin_port_code,
    COUNT(DISTINCT rc.id)                                      AS total_cards,
    COUNT(DISTINCT r.rate_card_id)                             AS cards_with_rates,
    COUNT(r.id)                                                AS total_rates,
    MIN(r.effective_from)                                      AS earliest_rate,
    MAX(r.effective_from)                                      AS latest_rate
FROM lcl_rate_cards rc
LEFT JOIN lcl_rates r ON r.rate_card_id = rc.id
GROUP BY rc.origin_port_code
ORDER BY rc.origin_port_code;

-- =============================================================================

-- 3. FCL cards with ZERO rates — the critical gap
--    If origins other than MYPKG appear here, they have shells but no rate history
SELECT
    rc.origin_port_code,
    COUNT(*)                                                   AS cards_without_rates,
    MIN(rc.created_at)                                         AS earliest_card_created
FROM fcl_rate_cards rc
WHERE NOT EXISTS (
    SELECT 1 FROM fcl_rates r WHERE r.rate_card_id = rc.id
)
GROUP BY rc.origin_port_code
ORDER BY rc.origin_port_code;

-- =============================================================================

-- 4. Same for LCL
SELECT
    rc.origin_port_code,
    COUNT(*)                                                   AS cards_without_rates,
    MIN(rc.created_at)                                         AS earliest_card_created
FROM lcl_rate_cards rc
WHERE NOT EXISTS (
    SELECT 1 FROM lcl_rates r WHERE r.rate_card_id = rc.id
)
GROUP BY rc.origin_port_code
ORDER BY rc.origin_port_code;

-- =============================================================================

-- 5. Overall summary — single row totals
SELECT
    (SELECT COUNT(*) FROM fcl_rate_cards)                      AS fcl_cards_total,
    (SELECT COUNT(*) FROM fcl_rates)                           AS fcl_rates_total,
    (SELECT COUNT(*) FROM lcl_rate_cards)                      AS lcl_cards_total,
    (SELECT COUNT(*) FROM lcl_rates)                           AS lcl_rates_total;

-- =============================================================================

-- 6. China origin port cards — do any CN ports exist at all in the DB?
--    rate_card_key format is "CNSZX:MYPKG:NON-DG:20GP:DRY" — check what CN origins migrated
SELECT
    rc.origin_port_code,
    COUNT(*)                                                   AS total_cards,
    COUNT(r.id)                                                AS total_rates,
    MIN(r.effective_from)                                      AS earliest_rate,
    MAX(r.effective_from)                                      AS latest_rate,
    array_agg(DISTINCT rc.destination_port_code ORDER BY rc.destination_port_code) AS destinations
FROM fcl_rate_cards rc
LEFT JOIN fcl_rates r ON r.rate_card_id = rc.id
WHERE rc.origin_port_code LIKE 'CN%'
GROUP BY rc.origin_port_code
ORDER BY rc.origin_port_code;

-- Same for LCL
SELECT
    rc.origin_port_code,
    COUNT(*)                                                   AS total_cards,
    COUNT(r.id)                                                AS total_rates,
    array_agg(DISTINCT rc.destination_port_code ORDER BY rc.destination_port_code) AS destinations
FROM lcl_rate_cards rc
LEFT JOIN lcl_rates r ON r.rate_card_id = rc.id
WHERE rc.origin_port_code LIKE 'CN%'
GROUP BY rc.origin_port_code
ORDER BY rc.origin_port_code;

-- =============================================================================
-- READING THE RESULTS:
--
-- Query 1 & 2: Which origins exist in the DB. If CN ports are absent entirely,
--   the cards were never migrated — either not in Datastore or all trashed.
--
-- Query 3 & 4: Origins with card shells but no rate history.
--   Empty → rates are present for all cards → remigration optional.
--   Has rows → pre-2024 cutoff removed rate history → run remigration.
--
-- Query 6: The China-specific test.
--   No CN rows → China cards missing from DB entirely.
--     → Either: (a) all China PricingFCL entities in Datastore have trash=True,
--               (b) China cards were never entered in the old system for these origins,
--               (c) Datastore entities use a different port code format (unlikely given
--                   the field name port_origin_un_code is confirmed correct).
--     → Next step: run remigrate_pricing_freight.py --dry-run and check origin breakdown.
--                  If CN ports appear in dry-run → they were trashed; edit script to
--                  include trashed cards. If CN ports absent from dry-run → data was
--                  never entered in Datastore for those origins.
--   CN rows present but no rates → pre-2024 cutoff issue; remigration will fix.
--   Only CNNGB but not CNSZX/CNSHA/CNGZU → those specific cards are trashed in Datastore.
-- =============================================================================
