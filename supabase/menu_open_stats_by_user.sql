-- Podsumowanie otwarć menu (QR / link) dla wszystkich użytkowników.
-- Uruchom w Supabase → SQL Editor.
--
-- Po migracji: Table Editor → public → menu_open_stats_by_user
-- (widok tylko dla panelu Supabase — bez dostępu dla anon / zalogowanych klientów aplikacji)

begin;

create or replace view public.menu_open_stats_by_user as
select
  u.id as owner_id,
  coalesce(u.email, p.email) as email,
  p.restaurant_name,
  count(m.id) as total_opens,
  count(m.id) filter (
    where m.opened_at >= date_trunc('day', now())
  ) as opens_today,
  count(m.id) filter (
    where m.opened_at >= date_trunc('month', now())
  ) as opens_this_month,
  min(m.opened_at) as first_open,
  max(m.opened_at) as last_open
from auth.users u
left join public.profiles p on p.id = u.id
left join public.menu_open_events m on m.owner_id = u.id
group by u.id, u.email, p.email, p.restaurant_name
order by total_opens desc, email asc;

comment on view public.menu_open_stats_by_user is
  'Agregat otwarć menu cyfrowego per użytkownik (admin / SQL Editor).';

-- Widok tylko dla operatora projektu w Supabase Dashboard.
revoke all on public.menu_open_stats_by_user from public;
revoke all on public.menu_open_stats_by_user from anon, authenticated;
grant select on public.menu_open_stats_by_user to service_role;

commit;

-- Szybki podgląd:
-- select * from public.menu_open_stats_by_user;
