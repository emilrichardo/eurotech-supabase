-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- MercadoLibre token storage (persists refresh_token entre reinicios)
create table if not exists public.ml_tokens (
  id           serial primary key,
  access_token text not null,
  refresh_token text,
  expires_at   timestamptz not null,
  user_id      bigint not null,
  updated_at   timestamptz default now()
);

-- ⚠️ Insertar el token manualmente desde el SQL Editor después del deploy:
-- insert into public.ml_tokens (access_token, refresh_token, expires_at, user_id)
-- values ('TU_ACCESS_TOKEN', 'TU_REFRESH_TOKEN', now() + interval '6 hours', 92078889);

-- Tabla principal de productos MercadoLibre con todas las columnas disponibles
create table if not exists public.ml_products (
  -- Identificadores
  id                          varchar(50) primary key,
  site_id                     varchar(10),
  catalog_product_id          varchar(50),
  parent_item_id              varchar(50),
  seller_custom_field         varchar(255),
  domain_id                   varchar(100),

  -- Información básica
  title                       text,
  subtitle                    text,
  condition                   varchar(20),
  listing_type_id             varchar(50),
  buying_mode                 varchar(50),
  status                      varchar(30),
  sub_status                  jsonb,
  tags                        jsonb,
  listing_source              varchar(100),
  international_delivery_mode varchar(50),

  -- Precios
  price                       numeric(18, 2),
  base_price                  numeric(18, 2),
  original_price              numeric(18, 2),
  currency_id                 varchar(10),

  -- Stock
  initial_quantity            integer,
  available_quantity          integer,
  sold_quantity               integer,

  -- Seller & Store
  seller_id                   bigint,
  official_store_id           integer,

  -- Categoría
  category_id                 varchar(50),

  -- URLs y media
  permalink                   text,
  thumbnail                   text,
  thumbnail_id                varchar(100),
  video_id                    varchar(100),
  pictures                    jsonb,

  -- Fechas
  start_time                  timestamptz,
  stop_time                   timestamptz,
  end_time                    timestamptz,
  expiration_time             timestamptz,
  date_created                timestamptz,
  last_updated                timestamptz,

  -- Pagos y envíos
  accepts_mercadopago         boolean,
  non_mercado_pago_payment_methods jsonb,
  shipping                    jsonb,

  -- Atributos y variaciones
  attributes                  jsonb,
  variations                  jsonb,
  sale_terms                  jsonb,
  descriptions                jsonb,

  -- Garantía
  warranty                    text,

  -- Ubicación
  seller_address              jsonb,
  location                    jsonb,
  geolocation                 jsonb,
  coverage_areas              jsonb,

  -- Métricas
  health                      numeric(5, 4),
  catalog_listing             boolean,
  automatic_relist            boolean,
  differential_pricing        jsonb,
  deal_ids                    jsonb,

  -- Sync metadata
  synced_at                   timestamptz default now(),
  raw_data                    jsonb
);

-- Índices para búsquedas frecuentes
create index if not exists idx_ml_products_seller_id    on public.ml_products (seller_id);
create index if not exists idx_ml_products_category_id  on public.ml_products (category_id);
create index if not exists idx_ml_products_status       on public.ml_products (status);
create index if not exists idx_ml_products_last_updated on public.ml_products (last_updated desc);
create index if not exists idx_ml_products_price        on public.ml_products (price);
create index if not exists idx_ml_products_synced_at    on public.ml_products (synced_at desc);

-- RLS
alter table public.ml_products enable row level security;
alter table public.ml_tokens   enable row level security;

-- Solo service_role puede acceder
create policy "service_role only" on public.ml_products
  for all using (auth.role() = 'service_role');

create policy "service_role only" on public.ml_tokens
  for all using (auth.role() = 'service_role');

-- Cron: ejecutar edge function cada 2 horas
-- Usa vault.secrets o configura las variables con ALTER DATABASE SET
select cron.schedule(
  'ml-sync-every-2h',
  '0 */2 * * *',
  $$
  select net.http_post(
    url     := 'https://ncgvyabucowccaddyjna.functions.supabase.co/ml-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'supabase_service_key'
        limit 1
      )
    ),
    body    := '{}'::jsonb
  );
  $$
);
