alter table public.ml_competitor_items
  add column if not exists seller_name varchar(255);
