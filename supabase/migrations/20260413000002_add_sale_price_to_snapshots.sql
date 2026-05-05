-- Add sale_price column to ml_tracked_snapshots
-- ML uses sale_price for campaign/deal promotions (separate from seller discounts in original_price)
ALTER TABLE IF EXISTS public.ml_tracked_snapshots
  ADD COLUMN IF NOT EXISTS sale_price numeric;
