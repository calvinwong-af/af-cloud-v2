-- Migration 040: Air Freight Pricing
-- Creates air_freight_rate_cards and air_freight_rates tables.
--
-- Rate card key format: ORIGIN:DEST:DG_CLASS:AIRLINE_CODE
-- e.g. KUL:DXB:NON-DG:EK
--
-- Rate model: perpetual effective_from (same as all other pricing modules).
-- UOM: CW (chargeable weight) only — CTR rows from legacy data are excluded.
-- Breakpoints: l45, p45, p100, p250, p300, p500, p1000 (per kg).
-- min_list_price / min_cost: minimum charge floor, not a per-kg tier.
-- Surcharges: JSONB — fsc (fuel), msc (misc), ssc (security).
-- supplier_id IS NULL     → list price row (customer-facing)
-- supplier_id IS NOT NULL → cost row (supplier rate)
-- Hard FK to companies(id) ON DELETE RESTRICT — consistent with 039 retrofit.

-- ---------------------------------------------------------------------------
-- air_freight_rate_cards
-- ---------------------------------------------------------------------------

CREATE TABLE air_freight_rate_cards (
    id                      SERIAL PRIMARY KEY,
    rate_card_key           TEXT        NOT NULL UNIQUE,   -- ORIGIN:DEST:DG_CLASS:AIRLINE_CODE
    origin_port_code        TEXT        NOT NULL,
    destination_port_code   TEXT        NOT NULL,
    dg_class_code           TEXT        NOT NULL,          -- NON-DG | DG-2 | DG-3
    airline_code            TEXT        NOT NULL,          -- IATA airline code, uppercase
    code                    TEXT        NOT NULL DEFAULT 'FR-AIR',
    description             TEXT        NOT NULL DEFAULT '',
    is_active               BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lookup indexes
CREATE INDEX idx_air_rc_origin   ON air_freight_rate_cards (origin_port_code);
CREATE INDEX idx_air_rc_dest     ON air_freight_rate_cards (destination_port_code);
CREATE INDEX idx_air_rc_airline  ON air_freight_rate_cards (airline_code);
CREATE INDEX idx_air_rc_active   ON air_freight_rate_cards (is_active);

-- ---------------------------------------------------------------------------
-- air_freight_rates
-- ---------------------------------------------------------------------------

CREATE TABLE air_freight_rates (
    id                  SERIAL PRIMARY KEY,
    rate_card_id        INTEGER     NOT NULL REFERENCES air_freight_rate_cards(id) ON DELETE CASCADE,
    supplier_id         TEXT        REFERENCES companies(id) ON DELETE RESTRICT,
    effective_from      DATE        NOT NULL,
    effective_to        DATE,
    rate_status         rate_status NOT NULL DEFAULT 'PUBLISHED',
    currency            TEXT        NOT NULL,

    -- Breakpoint tiers — list price (per kg, supplier_id IS NULL rows)
    l45_list_price      NUMERIC(12, 4),   -- less than 45 kg
    p45_list_price      NUMERIC(12, 4),   -- +45 kg
    p100_list_price     NUMERIC(12, 4),   -- +100 kg
    p250_list_price     NUMERIC(12, 4),   -- +250 kg
    p300_list_price     NUMERIC(12, 4),   -- +300 kg
    p500_list_price     NUMERIC(12, 4),   -- +500 kg
    p1000_list_price    NUMERIC(12, 4),   -- +1000 kg
    min_list_price      NUMERIC(12, 4),   -- minimum charge floor

    -- Breakpoint tiers — cost (per kg, supplier_id IS NOT NULL rows)
    l45_cost            NUMERIC(12, 4),
    p45_cost            NUMERIC(12, 4),
    p100_cost           NUMERIC(12, 4),
    p250_cost           NUMERIC(12, 4),
    p300_cost           NUMERIC(12, 4),
    p500_cost           NUMERIC(12, 4),
    p1000_cost          NUMERIC(12, 4),
    min_cost            NUMERIC(12, 4),

    -- Surcharges JSONB — keys: fsc, msc, ssc (all per-kg amounts)
    -- Example: [{"code": "fsc", "amount": 0.85}, {"code": "ssc", "amount": 0.38}]
    surcharges          JSONB,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rate resolution index: latest row per card+supplier
CREATE INDEX idx_air_rates_card_supplier_eff
    ON air_freight_rates (rate_card_id, supplier_id, effective_from DESC);

-- Partial index for active published rates (quotation engine hot path)
CREATE INDEX idx_air_rates_published
    ON air_freight_rates (rate_card_id, effective_from DESC)
    WHERE rate_status = 'PUBLISHED';

-- ---------------------------------------------------------------------------
-- Rate resolution pattern (reference)
--
-- Active list price for a card:
--   SELECT * FROM air_freight_rates
--   WHERE rate_card_id = :id AND supplier_id IS NULL AND rate_status = 'PUBLISHED'
--   ORDER BY effective_from DESC LIMIT 1;
--
-- Active cost for a specific supplier:
--   SELECT * FROM air_freight_rates
--   WHERE rate_card_id = :id AND supplier_id = :sid AND rate_status = 'PUBLISHED'
--   ORDER BY effective_from DESC LIMIT 1;
--
-- Breakpoint resolution at quotation time (example for chargeable weight 120 kg):
--   p100 tier applies (highest breakpoint threshold <= actual weight).
--   Use l45 when weight < 45, p45 when 45 <= weight < 100, etc.
--   Always compare: actual_weight vs (min_list_price / applicable_tier_rate)
--   and charge whichever is higher (minimum charge floor logic).
-- ---------------------------------------------------------------------------
