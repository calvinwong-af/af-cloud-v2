-- Migration 039: Hard FK Retrofit — supplier_id on rate tables
--
-- Adds REFERENCES companies(id) ON DELETE RESTRICT to supplier_id on:
--   fcl_rates, lcl_rates, port_transport_rates, haulage_rates
--
-- Pre-flight diagnostic (2026-03-11) confirmed zero orphan supplier_id values
-- across all four tables. Migration is safe to apply without data cleanup.
--
-- NULL supplier_id rows are unaffected — Postgres FK constraints skip NULLs.
-- NULL = list price reference row (AF selling price, no supplier dimension).

ALTER TABLE fcl_rates
    ADD CONSTRAINT fk_fcl_rates_supplier
    FOREIGN KEY (supplier_id)
    REFERENCES companies(id)
    ON DELETE RESTRICT;

ALTER TABLE lcl_rates
    ADD CONSTRAINT fk_lcl_rates_supplier
    FOREIGN KEY (supplier_id)
    REFERENCES companies(id)
    ON DELETE RESTRICT;

ALTER TABLE port_transport_rates
    ADD CONSTRAINT fk_port_transport_rates_supplier
    FOREIGN KEY (supplier_id)
    REFERENCES companies(id)
    ON DELETE RESTRICT;

ALTER TABLE haulage_rates
    ADD CONSTRAINT fk_haulage_rates_supplier
    FOREIGN KEY (supplier_id)
    REFERENCES companies(id)
    ON DELETE RESTRICT;
