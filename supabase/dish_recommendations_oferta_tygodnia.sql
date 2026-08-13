-- Oferta tygodnia — ten sam typ wstążki co „Najlepiej sprzedawane”.
-- Uruchom w Supabase → SQL Editor.

begin;

alter table public.dish_recommendations
  drop constraint if exists dish_recommendations_type_check;

alter table public.dish_recommendations
  add constraint dish_recommendations_type_check
  check (type in ('polecane', 'popularne', 'zestaw', 'oferta_tygodnia'));

commit;
