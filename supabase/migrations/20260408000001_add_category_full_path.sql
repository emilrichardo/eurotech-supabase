alter table public.ml_categories
  add column if not exists full_path text;
