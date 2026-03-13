-- Migration 058: DG class charges two-tier schema
-- Splits dg_class_charges into dg_class_charge_cards (card identity) + dg_class_charges (rate rows with FK)

-- Step 1: Create dg_class_charge_cards table
CREATE TABLE dg_class_charge_cards (
    id                SERIAL PRIMARY KEY,
    rate_card_key     VARCHAR(200) NOT NULL UNIQUE,
    port_code         VARCHAR(10)  NOT NULL REFERENCES ports(un_code) ON DELETE RESTRICT,
    trade_direction   VARCHAR(10)  NOT NULL,
    shipment_type     VARCHAR(10)  NOT NULL DEFAULT 'ALL',
    dg_class_code     VARCHAR(10)  NOT NULL,
    container_size    VARCHAR(10)  NOT NULL DEFAULT 'ALL',
    container_type    VARCHAR(10)  NOT NULL DEFAULT 'ALL',
    charge_code       VARCHAR(20)  NOT NULL,
    description       VARCHAR(255) NOT NULL,
    currency          VARCHAR(3)   NOT NULL DEFAULT 'MYR',
    uom               VARCHAR(20)  NOT NULL,
    is_domestic       BOOLEAN      NOT NULL DEFAULT FALSE,
    is_international  BOOLEAN      NOT NULL DEFAULT TRUE,
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT dgcc_direction_check      CHECK (trade_direction IN ('IMPORT', 'EXPORT')),
    CONSTRAINT dgcc_shipment_check       CHECK (shipment_type IN ('FCL', 'LCL', 'AIR', 'CB', 'ALL')),
    CONSTRAINT dgcc_dg_class_check       CHECK (dg_class_code IN ('DG-2', 'DG-3')),
    CONSTRAINT dgcc_container_size_check CHECK (container_size IN ('20', '40', 'ALL')),
    CONSTRAINT dgcc_container_type_check CHECK (container_type IN ('GP', 'HC', 'RF', 'FF', 'OT', 'FR', 'PL', 'ALL')),
    CONSTRAINT dgcc_uom_check            CHECK (uom IN ('CONTAINER', 'CBM', 'KG', 'W/M', 'SET', 'BL')),
    CONSTRAINT dgcc_unique               UNIQUE (port_code, trade_direction, shipment_type, dg_class_code,
                                                 container_size, container_type, charge_code,
                                                 is_domestic, is_international)
);

-- Step 2: Backfill dg_class_charge_cards from existing data
INSERT INTO dg_class_charge_cards (
    rate_card_key, port_code, trade_direction, shipment_type,
    dg_class_code, container_size, container_type,
    charge_code, description, currency, uom,
    is_domestic, is_international, is_active,
    created_at, updated_at
)
SELECT DISTINCT ON (port_code, trade_direction, shipment_type, dg_class_code,
                    container_size, container_type, charge_code, is_domestic, is_international)
    port_code || '|' || trade_direction || '|' || shipment_type || '|' || dg_class_code || '|' ||
    container_size || '|' || container_type || '|' || charge_code || '|' ||
    is_domestic::text || '|' || is_international::text,
    port_code, trade_direction, shipment_type,
    dg_class_code, container_size, container_type,
    charge_code, description, currency, uom,
    is_domestic, is_international, is_active,
    created_at, updated_at
FROM dg_class_charges
ORDER BY port_code, trade_direction, shipment_type, dg_class_code,
         container_size, container_type, charge_code, is_domestic, is_international,
         effective_from DESC;

-- Step 3: Add rate_card_id FK to dg_class_charges
ALTER TABLE dg_class_charges
    ADD COLUMN rate_card_id INTEGER REFERENCES dg_class_charge_cards(id) ON DELETE RESTRICT;

-- Step 4: Populate rate_card_id
UPDATE dg_class_charges dc
SET rate_card_id = (
    SELECT id FROM dg_class_charge_cards dcc
    WHERE dcc.port_code        = dc.port_code
      AND dcc.trade_direction  = dc.trade_direction
      AND dcc.shipment_type    = dc.shipment_type
      AND dcc.dg_class_code    = dc.dg_class_code
      AND dcc.container_size   = dc.container_size
      AND dcc.container_type   = dc.container_type
      AND dcc.charge_code      = dc.charge_code
      AND dcc.is_domestic      = dc.is_domestic
      AND dcc.is_international = dc.is_international
);

-- Step 5: Make rate_card_id NOT NULL, add indexes
ALTER TABLE dg_class_charges
    ALTER COLUMN rate_card_id SET NOT NULL;

CREATE INDEX idx_dg_class_charges_card ON dg_class_charges (rate_card_id);
CREATE INDEX idx_dg_class_charges_effective ON dg_class_charges (rate_card_id, effective_from DESC);
CREATE INDEX idx_dg_class_charge_cards_port ON dg_class_charge_cards (port_code);
CREATE INDEX idx_dg_class_charge_cards_active ON dg_class_charge_cards (is_active, port_code);

-- Step 6: Drop card-identity columns from dg_class_charges
ALTER TABLE dg_class_charges
    DROP COLUMN port_code,
    DROP COLUMN trade_direction,
    DROP COLUMN shipment_type,
    DROP COLUMN dg_class_code,
    DROP COLUMN container_size,
    DROP COLUMN container_type,
    DROP COLUMN charge_code,
    DROP COLUMN description,
    DROP COLUMN currency,
    DROP COLUMN uom,
    DROP COLUMN is_domestic,
    DROP COLUMN is_international,
    DROP COLUMN is_active;

-- Step 7: Replace unique constraint on dg_class_charges
ALTER TABLE dg_class_charges DROP CONSTRAINT IF EXISTS dgc_unique;
ALTER TABLE dg_class_charges ADD CONSTRAINT dgc_unique
    UNIQUE (rate_card_id, effective_from);
