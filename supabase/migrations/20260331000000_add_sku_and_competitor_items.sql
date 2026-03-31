-- ─── SKU en ml_products ────────────────────────────────────────────────────
-- El SKU viene del atributo SELLER_SKU en la API de ML
alter table public.ml_products
  add column if not exists sku varchar(255);

create index if not exists idx_ml_products_sku on public.ml_products (sku);

-- ─── Tabla de productos de la competencia ──────────────────────────────────
create table if not exists public.ml_competitor_items (
  id            varchar(50)   primary key,          -- MLU/MLA... del competidor
  our_sku       varchar(255)  not null,              -- SKU de nuestro producto relacionado
  title         text,
  price         numeric(18,2),
  original_price numeric(18,2),
  currency_id   varchar(10),
  available_quantity integer,
  sold_quantity  integer,
  status        varchar(30),
  condition     varchar(20),
  listing_type_id varchar(50),
  category_id   varchar(50),
  permalink     text,
  thumbnail     text,
  seller_id     bigint,
  health        numeric(5,4),
  synced_at     timestamptz   default now(),
  created_at    timestamptz   default now()
);

create index if not exists idx_ml_competitor_items_sku    on public.ml_competitor_items (our_sku);
create index if not exists idx_ml_competitor_items_status on public.ml_competitor_items (status);

-- ─── RLS ───────────────────────────────────────────────────────────────────
alter table public.ml_competitor_items enable row level security;

create policy "service_role only" on public.ml_competitor_items
  for all using (auth.role() = 'service_role');

-- ─── Cron: actualizar precios competencia cada hora ────────────────────────
select cron.schedule(
  'ml-sync-competitor-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://ncgvyabucowccaddyjna.functions.supabase.co/ml-sync-competitor',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_service_key' limit 1)
    ),
    body    := '{}'::jsonb
  );
  $$
);
