-- Move MercadoLibre objects out of public into their own schema.
create schema if not exists ml;

grant usage on schema ml to anon, authenticated, service_role;

do $$
declare
  table_name text;
begin
  for table_name in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename like 'ml\_%' escape '\'
  loop
    execute format('alter table public.%I set schema ml', table_name);
  end loop;
end $$;

do $$
begin
  alter type public.alert_rule_type set schema ml;
exception
  when undefined_object then null;
  when duplicate_object then null;
end $$;

grant all privileges on all tables in schema ml to service_role;
grant all privileges on all sequences in schema ml to service_role;
grant execute on all functions in schema ml to service_role;

alter default privileges in schema ml grant all on tables to service_role;
alter default privileges in schema ml grant all on sequences to service_role;
alter default privileges in schema ml grant execute on functions to service_role;
