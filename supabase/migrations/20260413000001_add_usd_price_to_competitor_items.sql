-- Original USD price when the competitor item's price comes from ML in USD
-- price is always stored in UYU (converted); usd_price preserves the original
alter table public.ml_competitor_items
  add column if not exists usd_price numeric(18,2);
