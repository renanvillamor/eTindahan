-- One-off backfill: sets every item's stock_quantity equal to its current
-- min_threshold (including NULL -> NULL for items with no threshold set).
--
-- Overwrites any stock_quantity already set — this is a full sync to
-- min_threshold, not a fill-only-if-empty backfill. Re-running it is a
-- no-op once the two columns already match.

UPDATE item
SET stock_quantity = min_threshold;
