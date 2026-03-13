-- Migration 053: Add tax columns to quotation_line_items
--
-- tax_code    — references tax_rules.tax_code (soft ref, no FK); NULL = not taxable
-- tax_rate    — rate as decimal at time of calculation (e.g. 0.0600)
-- tax_amount  — computed: effective_price_converted * tax_rate, rounded to 2dp
--               Stored on insert; not recalculated at read time.

ALTER TABLE quotation_line_items
    ADD COLUMN tax_code     VARCHAR(20)     NULL,
    ADD COLUMN tax_rate     NUMERIC(5,4)    NOT NULL DEFAULT 0,
    ADD COLUMN tax_amount   NUMERIC(12,2)   NOT NULL DEFAULT 0;
