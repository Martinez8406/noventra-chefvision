-- Kolumna JSONB na tłumaczenia nazwy i opisu (en, uk, de) w tabeli dishes.
-- Uruchom w Supabase → SQL Editor.

alter table public.dishes
  add column if not exists translations jsonb default null;

comment on column public.dishes.translations is
  'Tłumaczenia menu: {"en":{"name":"...","description":"..."},"uk":{...},"de":{...}}';
