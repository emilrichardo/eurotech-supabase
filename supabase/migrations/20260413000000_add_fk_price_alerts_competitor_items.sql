-- FK from ml_price_alerts.competitor_item_id → ml_competitor_items.id
-- Needed for PostgREST to resolve the join in the history query
alter table public.ml_price_alerts
  add constraint fk_price_alerts_competitor_item
  foreign key (competitor_item_id)
  references public.ml_competitor_items(id)
  on delete cascade;

create index if not exists idx_ml_price_alerts_competitor_item_id
  on public.ml_price_alerts (competitor_item_id);
