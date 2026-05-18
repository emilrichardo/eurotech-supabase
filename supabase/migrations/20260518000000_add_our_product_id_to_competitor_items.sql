alter table ml.ml_competitor_items
  add column if not exists our_product_id varchar(50);

create index if not exists idx_ml_competitor_items_our_product_id
  on ml.ml_competitor_items (our_product_id);
