-- ─── Preguntas y respuestas ────────────────────────────────────────────────
create table if not exists public.ml_questions (
  id                    bigint primary key,
  item_id               varchar(50) not null,
  seller_id             bigint,
  from_user_id          bigint,
  status                varchar(30),
  text                  text,
  tags                  jsonb,
  hold                  boolean,
  deleted_from_listing  boolean,
  date_created          timestamptz,

  -- Respuesta
  answer_text           text,
  answer_status         varchar(30),
  answer_date_created   timestamptz,

  synced_at             timestamptz default now()
);

create index if not exists idx_ml_questions_item_id   on public.ml_questions (item_id);
create index if not exists idx_ml_questions_seller_id on public.ml_questions (seller_id);
create index if not exists idx_ml_questions_status    on public.ml_questions (status);
create index if not exists idx_ml_questions_created   on public.ml_questions (date_created desc);

-- ─── Reputación e info del vendedor ────────────────────────────────────────
create table if not exists public.ml_seller (
  id                        bigint primary key,
  nickname                  varchar(100),
  first_name                varchar(100),
  last_name                 varchar(100),
  email                     text,
  contact_email             text,
  registration_date         timestamptz,
  country_id                varchar(10),
  site_id                   varchar(10),
  user_type                 varchar(50),
  seller_experience         varchar(50),
  points                    integer,
  permalink                 text,
  tags                      jsonb,
  logo                      text,
  address                   jsonb,
  phone                     jsonb,
  identification            jsonb,

  -- Reputación
  reputation_level          varchar(20),
  power_seller_status       varchar(30),
  sales_period              varchar(30),
  sales_completed           integer,
  claims_rate               numeric(8,6),
  claims_value              integer,
  delayed_handling_rate     numeric(8,6),
  delayed_handling_value    integer,
  cancellations_rate        numeric(8,6),
  cancellations_value       integer,
  transactions_total        integer,
  transactions_completed    integer,
  transactions_canceled     integer,
  ratings_positive          numeric(5,4),
  ratings_neutral           numeric(5,4),
  ratings_negative          numeric(5,4),

  synced_at                 timestamptz default now()
);

-- ─── Visitas diarias (nivel cuenta) ────────────────────────────────────────
create table if not exists public.ml_seller_visits (
  id          serial primary key,
  date        date not null,
  total       integer not null,
  synced_at   timestamptz default now(),
  unique (date)
);

create index if not exists idx_ml_seller_visits_date on public.ml_seller_visits (date desc);

-- ─── Visitas por item ───────────────────────────────────────────────────────
create table if not exists public.ml_item_visits (
  item_id     varchar(50) not null,
  date        date not null,
  visits      integer not null default 0,
  synced_at   timestamptz default now(),
  primary key (item_id, date)
);

create index if not exists idx_ml_item_visits_item on public.ml_item_visits (item_id);
create index if not exists idx_ml_item_visits_date on public.ml_item_visits (date desc);

-- ─── RLS ───────────────────────────────────────────────────────────────────
alter table public.ml_questions      enable row level security;
alter table public.ml_seller         enable row level security;
alter table public.ml_seller_visits  enable row level security;
alter table public.ml_item_visits    enable row level security;

create policy "service_role only" on public.ml_questions
  for all using (auth.role() = 'service_role');
create policy "service_role only" on public.ml_seller
  for all using (auth.role() = 'service_role');
create policy "service_role only" on public.ml_seller_visits
  for all using (auth.role() = 'service_role');
create policy "service_role only" on public.ml_item_visits
  for all using (auth.role() = 'service_role');

-- ─── Crons adicionales ─────────────────────────────────────────────────────
-- Preguntas: cada 2 horas
select cron.schedule(
  'ml-sync-questions-every-2h',
  '30 */2 * * *',
  $$
  select net.http_post(
    url     := 'https://ncgvyabucowccaddyjna.functions.supabase.co/ml-sync-questions',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_service_key' limit 1)
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Vendedor y visitas: 1 vez por día
select cron.schedule(
  'ml-sync-seller-daily',
  '0 6 * * *',
  $$
  select net.http_post(
    url     := 'https://ncgvyabucowccaddyjna.functions.supabase.co/ml-sync-seller',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_service_key' limit 1)
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Visitas por item: 1 vez por día (dispara la cadena automática)
select cron.schedule(
  'ml-sync-item-visits-daily',
  '30 6 * * *',
  $$
  select net.http_post(
    url     := 'https://ncgvyabucowccaddyjna.functions.supabase.co/ml-sync-item-visits',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_service_key' limit 1)
    ),
    body    := '{"page":0}'::jsonb
  );
  $$
);
