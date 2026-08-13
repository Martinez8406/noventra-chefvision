-- Panel informacyjny restauracji (godziny, dojazd, wydarzenia).
-- Uruchom w Supabase → SQL Editor (po tabeli profiles).

begin;

alter table public.profiles
  add column if not exists restaurant_info_enabled boolean not null default false;

alter table public.profiles
  add column if not exists restaurant_info jsonb not null default '{}'::jsonb;

comment on column public.profiles.restaurant_info_enabled is
  'Czy Panel informacyjny jest widoczny w Live Menu';

comment on column public.profiles.restaurant_info is
  'Treść Panelu informacyjnego (godziny, kontakt, dojazd, wydarzenia)';

commit;
