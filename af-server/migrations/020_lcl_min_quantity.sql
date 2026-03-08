-- Migration 020: Rename min_cost to min_quantity on lcl_rates
-- LCL rates use a minimum chargeable W/M quantity defined by the supplier.
-- min_cost was a misnomer — it is a quantity floor, not a cost floor.
-- FCL has no minimum concept; fcl_rates.min_list_price and fcl_rates.min_cost remain but are unused.
ALTER TABLE lcl_rates RENAME COLUMN min_cost TO min_quantity;
