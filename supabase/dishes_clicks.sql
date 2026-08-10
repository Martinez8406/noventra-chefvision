-- Licznik kliknięć w widok szczegółowy dania (Live Menu).
-- Uruchom w Supabase → SQL Editor, jeśli kolumna clicks jeszcze nie istnieje.

begin;

alter table public.dishes
  add column if not exists clicks integer not null default 0;

comment on column public.dishes.clicks is
  'Liczba otwarć widoku szczegółowego dania w publicznym menu';

commit;
