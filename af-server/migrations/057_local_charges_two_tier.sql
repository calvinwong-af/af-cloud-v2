-- Migration 057: Local charges two-tier schema
-- Splits local_charges into local_charge_cards (card identity) + local_charges (rate rows with FK)
-- Also drops deprecated paid_with_freight column

-- Step 1: Create local_charge_cards table
CREATE TABLE local_charge_cards (
    id                SERIAL PRIMARY KEY,
    rate_card_key     VARCHAR(200) NOT NULL UNIQUE,
    port_code         VARCHAR(10)  NOT NULL REFERENCES ports(un_code) ON DELETE RESTRICT,
    trade_direction   VARCHAR(10)  NOT NULL,
    shipment_type     VARCHAR(10)  NOT NULL DEFAULT 'ALL',
    container_size    VARCHAR(10)  NOT NULL DEFAULT 'ALL',
    container_type    VARCHAR(10)  NOT NULL DEFAULT 'ALL',
    dg_class_code     VARCHAR(10)  NOT NULL DEFAULT 'NON-DG',
    charge_code       VARCHAR(20)  NOT NULL,
    description       VARCHAR(255) NOT NULL,
    currency          VARCHAR(3)   NOT NULL DEFAULT 'MYR',
    uom               VARCHAR(20)  NOT NULL,
    is_domestic       BOOLEAN      NOT NULL DEFAULT FALSE,
    is_international  BOOLEAN      NOT NULL DEFAULT TRUE,
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT lcc_direction_check      CHECK (trade_direction IN ('IMPORT', 'EXPORT')),
    CONSTRAINT lcc_shipment_check       CHECK (shipment_type IN ('FCL', 'LCL', 'AIR', 'CB', 'ALL')),
    CONSTRAINT lcc_container_size_check CHECK (container_size IN ('20', '40', 'ALL')),
    CONSTRAINT lcc_container_type_check CHECK (container_type IN ('GP', 'HC', 'RF', 'FF', 'OT', 'FR', 'PL', 'ALL')),
    CONSTRAINT lcc_dg_class_check       CHECK (dg_class_code IN ('NON-DG', 'DG-2', 'DG-3', 'ALL')),
    CONSTRAINT lcc_uom_check            CHECK (uom IN ('CONTAINER', 'CBM', 'KG', 'W/M', 'CW_KG', 'SET', 'BL', 'QTL', 'RAIL_3KG')),
    CONSTRAINT lcc_unique               UNIQUE (port_code, trade_direction, shipment_type, container_size,
                                                container_type, dg_class_code, charge_code, is_domestic, is_international)
);

-- Step 2: Backfill local_charge_cards from existing local_charges data
INSERT INTO local_charge_cards (
    rate_card_key, port_code, trade_direction, shipment_type,
    container_size, container_type, dg_class_code,
    charge_code, description, currency, uom,
    is_domestic, is_international, is_active,
    created_at, updated_at
)
SELECT DISTINCT ON (port_code, trade_direction, shipment_type, container_size, container_type,
                    dg_class_code, charge_code, is_domestic, is_international)
    port_code || '|' || trade_direction || '|' || shipment_type || '|' ||
    container_size || '|' || container_type || '|' || dg_class_code || '|' ||
    charge_code || '|' || is_domestic::text || '|' || is_international::text,
    port_code, trade_direction, shipment_type,
    container_size, container_type, dg_class_code,
    charge_code, description, currency, uom,
    is_domestic, is_international, is_active,
    created_at, updated_at
FROM local_charges
ORDER BY port_code, trade_direction, shipment_type, container_size, container_type,
         dg_class_code, charge_code, is_domestic, is_international, effective_from DESC;

-- Step 3: Add rate_card_id FK to local_charges
ALTER TABLE local_charges
    ADD COLUMN rate_card_id INTEGER REFERENCES local_charge_cards(id) ON DELETE RESTRICT;

-- Step 4: Populate rate_card_id
UPDATE local_charges lc
SET rate_card_id = (
    SELECT id FROM local_charge_cards lcc
    WHERE lcc.port_code        = lc.port_code
      AND lcc.trade_direction  = lc.trade_direction
      AND lcc.shipment_type    = lc.shipment_type
      AND lcc.container_size   = lc.container_size
      AND lcc.container_type   = lc.container_type
      AND lcc.dg_class_code    = lc.dg_class_code
      AND lcc.charge_code      = lc.charge_code
      AND lcc.is_domestic      = lc.is_domestic
      AND lcc.is_international = lc.is_international
);

-- Step 5: Make rate_card_id NOT NULL, add indexes
ALTER TABLE local_charges
    ALTER COLUMN rate_card_id SET NOT NULL;

CREATE INDEX idx_local_charges_card ON local_charges (rate_card_id);
CREATE INDEX idx_local_charges_effective ON local_charges (rate_card_id, effective_from DESC);
CREATE INDEX idx_local_charge_cards_port ON local_charge_cards (port_code);
CREATE INDEX idx_local_charge_cards_active ON local_charge_cards (is_active, port_code);

-- Step 6: Drop card-identity columns AND deprecated paid_with_freight from local_charges
ALTER TABLE local_charges
    DROP COLUMN port_code,
    DROP COLUMN trade_direction,
    DROP COLUMN shipment_type,
    DROP COLUMN container_size,
    DROP COLUMN container_type,
    DROP COLUMN dg_class_code,
    DROP COLUMN charge_code,
    DROP COLUMN description,
    DROP COLUMN currency,
    DROP COLUMN uom,
    DROP COLUMN is_domestic,
    DROP COLUMN is_international,
    DROP COLUMN paid_with_freight,
    DROP COLUMN is_active;

-- Step 7: Replace unique constraint on local_charges
ALTER TABLE local_charges DROP CONSTRAINT IF EXISTS lc_unique;
ALTER TABLE local_charges ADD CONSTRAINT lc_unique
    UNIQUE (rate_card_id, effective_from);
