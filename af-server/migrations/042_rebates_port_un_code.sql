-- Migration 042: Add port_un_code to haulage_supplier_rebates
--
-- Rebates are port-specific. Penang and Port Klang rebates differ even for the
-- same supplier and container size. Adding port_un_code as a required dimension.

-- Add column (no existing rows, so NOT NULL with no default is safe)
ALTER TABLE haulage_supplier_rebates
    ADD COLUMN port_un_code VARCHAR(10) NOT NULL;

-- Drop old unique constraint
ALTER TABLE haulage_supplier_rebates
    DROP CONSTRAINT haulage_supplier_rebates_unique;

-- New unique constraint includes port
ALTER TABLE haulage_supplier_rebates
    ADD CONSTRAINT haulage_supplier_rebates_unique
        UNIQUE (supplier_id, port_un_code, container_size, effective_from);

-- Drop old resolution index
DROP INDEX IF EXISTS idx_haulage_supplier_rebates_effective;

-- New resolution index includes port
CREATE INDEX idx_haulage_supplier_rebates_effective
    ON haulage_supplier_rebates (supplier_id, port_un_code, container_size, effective_from DESC);
