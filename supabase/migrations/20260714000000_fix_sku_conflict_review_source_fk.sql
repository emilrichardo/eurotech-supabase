-- Conflict reviews belong to their source record. When an obsolete source
-- record is removed during an import, its review rows must be removed too.
alter table web.sku_conflict_review_items
  drop constraint if exists sku_conflict_review_items_source_product_record_id_fkey;

alter table web.sku_conflict_review_items
  add constraint sku_conflict_review_items_source_product_record_id_fkey
  foreign key (source_product_record_id)
  references web.source_product_records(id)
  on delete cascade;
