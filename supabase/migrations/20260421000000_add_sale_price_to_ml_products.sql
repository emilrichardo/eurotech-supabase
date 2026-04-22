-- Precio promocional aplicado por ML (deals/campañas) — el que el cliente ve en la publicación
-- cuando hay una oferta activa. Distinto de `original_price` (descuento del vendedor).
alter table public.ml_products
  add column if not exists sale_price numeric(18,2);
