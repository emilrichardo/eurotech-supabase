alter table public.ml_products
  add column if not exists user_product_id varchar(100);

create index if not exists ml_products_user_product_id_idx
  on public.ml_products (user_product_id)
  where user_product_id is not null;
