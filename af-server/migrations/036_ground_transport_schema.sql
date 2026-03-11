-- Migration 036: Ground transport schema — transport_type rename + task linkage columns

BEGIN;

-- 1. Add transport_type column
ALTER TABLE orders ADD COLUMN transport_type VARCHAR(20);

-- 2. Backfill from transport_mode (haulage stays haulage, trucking becomes general)
UPDATE orders
SET transport_type = CASE
    WHEN transport_mode = 'haulage'  THEN 'haulage'
    WHEN transport_mode = 'trucking' THEN 'general'
    ELSE transport_mode  -- future-proof: copy any unknown value as-is
END
WHERE order_type = 'transport';

-- 3. Add check constraint: transport orders must have transport_type
ALTER TABLE orders ADD CONSTRAINT chk_transport_type_required
    CHECK (order_type != 'transport' OR transport_type IS NOT NULL);

-- 4. Index on transport_type
CREATE INDEX idx_orders_transport_type ON orders(transport_type)
    WHERE transport_type IS NOT NULL;

-- 5. Add parent_shipment_id (replaces parent_order_id for transport orders)
ALTER TABLE orders ADD COLUMN parent_shipment_id VARCHAR(20) NULL;

-- 6. Backfill parent_shipment_id from parent_order_id for transport orders
--    Only copy values that look like shipment IDs (AF- prefix)
UPDATE orders
SET parent_shipment_id = parent_order_id
WHERE order_type = 'transport'
  AND parent_order_id IS NOT NULL
  AND parent_order_id LIKE 'AF-%';

CREATE INDEX idx_orders_parent_shipment_id ON orders(parent_shipment_id)
    WHERE parent_shipment_id IS NOT NULL;

-- 7. Add task_ref column (stores task_type string e.g. 'ORIGIN_HAULAGE')
ALTER TABLE orders ADD COLUMN task_ref VARCHAR(50) NULL;

CREATE INDEX idx_orders_task_ref ON orders(parent_shipment_id, task_ref)
    WHERE task_ref IS NOT NULL;

-- 8. Drop transport_mode (after transport_type is populated)
ALTER TABLE orders DROP COLUMN transport_mode;

-- 9. Drop parent_order_id (after parent_shipment_id is backfilled)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_parent_order_id_fkey;
ALTER TABLE orders DROP COLUMN parent_order_id;

COMMIT;
