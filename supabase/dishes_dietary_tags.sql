-- Oznaczenia dietetyczne i poziom ostrości w tabeli dishes.
-- Uruchom w Supabase → SQL Editor.

alter table public.dishes
  add column if not exists dietary_tags text[] not null default '{}';

alter table public.dishes
  add column if not exists spice_level text;

comment on column public.dishes.dietary_tags is
  'Oznaczenia dietetyczne: vegetarian, vegan, halal, kosher, gluten_free, lactose_free';

comment on column public.dishes.spice_level is
  'Poziom ostrości: mild, medium, hot (null = brak)';
