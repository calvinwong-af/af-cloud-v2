-- Migration 055: Customs two-tier schema
-- Splits customs_rates into customs_rate_cards (card identity) + customs_rates (rate rows with FK)

-- Step 1: Create customs_rate_cards table
CREATE TABLE customs_rate_cards (
    id               SERIAL PRIMARY KEY,
    rate_card_key    VARCHAR(120) NOT NULL UNIQUE,
    port_code        VARCHAR(10)  NOT NULL REFERENCES ports(un_code) ON DELETE RESTRICT,
    trade_direction  VARCHAR(10)  NOT NULL,
    shipment_type    VARCHAR(10)  NOT NULL,
    charge_code      VARCHAR(20)  NOT NULL,
    description      VARCHAR(255) NOT NULL,
    currency         VARCHAR(3)   NOT NULL DEFAULT 'MYR',
    uom              VARCHAR(20)  NOT NULL,
    is_domestic      BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT customs_rate_cards_direction_check CHECK (trade_direction IN ('IMPORT', 'EXPORT')),
    CONSTRAINT customs_rate_cards_shipment_check  CHECK (shipment_type IN ('FCL', 'LCL', 'AIR', 'CB', 'ALL')),
    CONSTRAINT customs_rate_cards_uom_check       CHECK (uom IN ('CONTAINER', 'CBM', 'KG', 'W/M', 'CW_KG', 'SET', 'BL')),
    CONSTRAINT customs_rate_cards_unique          UNIQUE (port_code, trade_direction, shipment_type, charge_code, is_domestic)
);

-- Step 2: Backfill customs_rate_cards from existing customs_rates data
INSERT INTO customs_rate_cards (
    rate_card_key, port_code, trade_direction, shipment_type,
    charge_code, description, currency, uom, is_domestic, is_active,
    created_at, updated_at
)
SELECT DISTINCT ON (port_code, trade_direction, shipment_type, charge_code, is_domestic)
    port_code || '|' || trade_direction || '|' || shipment_type || '|' || charge_code || '|' || is_domestic::text,
    port_code, trade_direction, shipment_type,
    charge_code, description, currency, uom, is_domestic, is_active,
    created_at, updated_at
FROM customs_rates
ORDER BY port_code, trade_direction, shipment_type, charge_code, is_domestic, effective_from DESC;

-- Step 3: Add rate_card_id FK column to customs_rates
ALTER TABLE customs_rates
    ADD COLUMN rate_card_id INTEGER REFERENCES customs_rate_cards(id) ON DELETE RESTRICT;

-- Step 4: Populate rate_card_id on all existing rows
UPDATE customs_rates cr
SET rate_card_id = (
    SELECT id FROM customs_rate_cards crc
    WHERE crc.port_code        = cr.port_code
      AND crc.trade_direction  = cr.trade_direction
      AND crc.shipment_type    = cr.shipment_type
      AND crc.charge_code      = cr.charge_code
      AND crc.is_domestic      = cr.is_domestic
);

-- Step 5: Make rate_card_id NOT NULL and add indexes
ALTER TABLE customs_rates
    ALTER COLUMN rate_card_id SET NOT NULL;

CREATE INDEX idx_customs_rates_card ON customs_rates (rate_card_id);
CREATE INDEX idx_customs_rates_effective ON customs_rates (rate_card_id, effective_from DESC);

-- Step 6: Drop card-identity columns from customs_rates (now redundant)
ALTER TABLE customs_rates
    DROP COLUMN port_code,
    DROP COLUMN trade_direction,
    DROP COLUMN shipment_type,
    DROP COLUMN charge_code,
    DROP COLUMN description,
    DROP COLUMN currency,
    DROP COLUMN uom,
    DROP COLUMN is_domestic;

-- Step 7: Replace unique constraint on customs_rates
ALTER TABLE customs_rates DROP CONSTRAINT IF EXISTS customs_rates_unique;
ALTER TABLE customs_rates ADD CONSTRAINT customs_rates_unique
    UNIQUE (rate_card_id, effective_from);

-- Step 8: Indexes on customs_rate_cards for port lookups
CREATE INDEX idx_customs_rate_cards_port ON customs_rate_cards (port_code);
CREATE INDEX idx_customs_rate_cards_active ON customs_rate_cards (is_active, port_code);
