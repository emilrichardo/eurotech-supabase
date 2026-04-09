alter table public.ml_competitor_items
  add column if not exists paused boolean not null default false;
