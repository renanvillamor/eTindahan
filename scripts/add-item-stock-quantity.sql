-- Adds `stock_quantity` to `item`: the target par level for an item — how
-- many (in pack units) it should have on hand to be considered well
-- stocked. Used by the Low Inventory report to compute a suggested Order
-- Qty (`stock_quantity - on_hand`) for items at or below `min_threshold`.
--
-- Distinct from `min_threshold` (the reorder trigger point) and
-- `max_threshold` (the overstock flag) — this is the target to restock up
-- to, not another boundary.
--
-- Purely additive: one new NULLABLE column on `item`. Safe to re-run.

ALTER TABLE item
  ADD COLUMN IF NOT EXISTS stock_quantity numeric;

-- IMPORTANT (manual step): `item` is read by the app through the
-- `vw_item_price` view, not queried directly. This view isn't tracked in
-- this repo (see docs/APP_NOTES.md, "Supabase views") — after running this
-- script, also edit `vw_item_price` in the Supabase SQL editor to add
-- `i.stock_quantity` to its SELECT list (same way `min_threshold` /
-- `max_threshold` are already exposed there), otherwise the app will never
-- see the new column.
