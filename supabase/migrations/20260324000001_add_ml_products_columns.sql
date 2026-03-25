-- Columnas adicionales descubiertas en la respuesta real de la API de MercadoLibre
alter table public.ml_products
  add column if not exists family_name       text,
  add column if not exists family_id         varchar(50),
  add column if not exists user_product_id   varchar(100),
  add column if not exists inventory_id      varchar(100),
  add column if not exists seller_contact    jsonb,
  add column if not exists warnings          jsonb,
  add column if not exists item_relations    jsonb,
  add column if not exists channels          jsonb;
