alter table public.ml_products
  add column if not exists buybox_price numeric(12, 2),
  add column if not exists buybox_seller_id bigint;
