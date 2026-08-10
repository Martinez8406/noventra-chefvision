-- Admin/staff: dostęp do profili klientów Premium (podłączenie kelnera bez zlecenia menu).
-- Uruchom w Supabase → SQL Editor.

begin;

-- Staff widzi wszystkie profile (potrzebne do listy klientów Premium).
drop policy if exists "profiles_staff_select_all" on public.profiles;
create policy "profiles_staff_select_all"
  on public.profiles
  for select
  to authenticated
  using (public.is_platform_staff());

-- Staff może aktualizować profile (webhook kelnera, branding klienta itd.).
drop policy if exists "profiles_staff_update_all" on public.profiles;
create policy "profiles_staff_update_all"
  on public.profiles
  for update
  to authenticated
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

commit;
