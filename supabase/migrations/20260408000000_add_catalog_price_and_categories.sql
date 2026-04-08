-- Precio que ML muestra en el catálogo (puede diferir del precio de publicación)
alter table public.ml_products
  add column if not exists catalog_price numeric(18,2);

-- Tabla de nombres de categorías ML
create table if not exists public.ml_categories (
  id         varchar(50) primary key,
  name       text        not null,
  updated_at timestamptz default now()
);

alter table public.ml_categories enable row level security;

create policy "service_role only" on public.ml_categories
  for all using (auth.role() = 'service_role');

alter table public.ml_categories
  add column if not exists full_path text;
