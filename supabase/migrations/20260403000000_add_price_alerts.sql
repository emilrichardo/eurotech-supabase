-- ─── Columna previous_price en ml_competitor_items ────────────────────────
alter table public.ml_competitor_items
  add column if not exists previous_price numeric(18,2);

-- ─── Enum de tipos de regla ────────────────────────────────────────────────
do $$ begin
  create type public.alert_rule_type as enum (
    'price_changed',
    'competitor_cheaper',
    'competitor_pricier',
    'price_diff_pct_above',
    'price_diff_pct_below'
  );
exception when duplicate_object then null; end $$;

-- ─── Tabla de reglas de alerta ─────────────────────────────────────────────
create table if not exists public.ml_price_alert_rules (
  id            uuid          primary key default gen_random_uuid(),
  name          text          not null,
  sku           varchar(255),                         -- NULL = global
  rule_type     alert_rule_type not null,
  threshold_pct numeric(8,2),                         -- solo para diff_pct_*
  enabled       boolean       not null default true,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);

create index if not exists idx_ml_price_alert_rules_sku     on public.ml_price_alert_rules (sku);
create index if not exists idx_ml_price_alert_rules_enabled on public.ml_price_alert_rules (enabled);

alter table public.ml_price_alert_rules enable row level security;

create policy "service_role only" on public.ml_price_alert_rules
  for all using (auth.role() = 'service_role');

-- ─── Tabla de alertas disparadas ───────────────────────────────────────────
create table if not exists public.ml_price_alerts (
  id                    uuid          primary key default gen_random_uuid(),
  rule_id               uuid          not null references public.ml_price_alert_rules(id) on delete cascade,
  our_sku               varchar(255)  not null,
  competitor_item_id    varchar(50)   not null,
  our_price             numeric(18,2),
  competitor_price_before numeric(18,2),
  competitor_price_after  numeric(18,2),
  diff_pct              numeric(8,2),                 -- (our - competitor) / our * 100
  fired_at              timestamptz   not null default now()
);

create index if not exists idx_ml_price_alerts_rule_id  on public.ml_price_alerts (rule_id);
create index if not exists idx_ml_price_alerts_sku      on public.ml_price_alerts (our_sku);
create index if not exists idx_ml_price_alerts_fired_at on public.ml_price_alerts (fired_at desc);

alter table public.ml_price_alerts enable row level security;

create policy "service_role only" on public.ml_price_alerts
  for all using (auth.role() = 'service_role');

-- ─── Actualizar cron: de cada hora a cada 2 horas ─────────────────────────
select cron.unschedule('ml-sync-competitor-hourly');

select cron.schedule(
  'ml-sync-competitor-2h',
  '0 */2 * * *',
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
