alter table public.ml_price_alerts
  add column if not exists read_at timestamptz;

create index if not exists idx_ml_price_alerts_unread
  on public.ml_price_alerts (fired_at desc)
  where read_at is null;
