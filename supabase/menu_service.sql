-- ChefVision: zlecenie wykonania menu cyfrowego + role admin/staff.
-- Uruchom w Supabase → SQL Editor.
--
-- Po migracji ustaw sobie i pracownikom role ręcznie, np.:
--   update public.profiles set platform_role = 'admin' where email = 'twoj@email.pl';
--   update public.profiles set platform_role = 'staff' where email = 'pracownik@email.pl';

begin;

-- 1) Rola platformowa na profilu (user | admin | staff)
alter table public.profiles
  add column if not exists platform_role text not null default 'user';

alter table public.profiles
  drop constraint if exists profiles_platform_role_check;

alter table public.profiles
  add constraint profiles_platform_role_check
  check (platform_role in ('user', 'admin', 'staff'));

create index if not exists profiles_platform_role_idx
  on public.profiles (platform_role);

-- 2) Helper: czy zalogowany użytkownik to admin lub pracownik
create or replace function public.is_platform_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.platform_role in ('admin', 'staff')
  );
$$;

revoke all on function public.is_platform_staff() from public;
grant execute on function public.is_platform_staff() to authenticated;

-- 3) Zlecenia wykonania menu (klient płaci → Ty/pracownicy realizujecie)
create table if not exists public.menu_service_orders (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'paid'
    check (status in ('paid', 'in_progress', 'done', 'cancelled')),
  stripe_checkout_session_id text null unique,
  stripe_customer_id text null,
  assigned_to uuid null references auth.users (id) on delete set null,
  notes text null,
  paid_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists menu_service_orders_client_idx
  on public.menu_service_orders (client_user_id);

create index if not exists menu_service_orders_status_idx
  on public.menu_service_orders (status);

create or replace function public.set_menu_service_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists menu_service_orders_updated_at on public.menu_service_orders;
create trigger menu_service_orders_updated_at
  before update on public.menu_service_orders
  for each row
  execute function public.set_menu_service_orders_updated_at();

alter table public.menu_service_orders enable row level security;

-- Klient widzi własne zlecenia
drop policy if exists "menu_service_orders_select_own" on public.menu_service_orders;
create policy "menu_service_orders_select_own"
  on public.menu_service_orders
  for select
  to authenticated
  using (auth.uid() = client_user_id or public.is_platform_staff());

-- Tylko staff aktualizuje status / notatki / przypisanie
drop policy if exists "menu_service_orders_update_staff" on public.menu_service_orders;
create policy "menu_service_orders_update_staff"
  on public.menu_service_orders
  for update
  to authenticated
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

-- Inserty robi webhook (service role) — opcjonalnie staff też może dodać ręczne zlecenie
drop policy if exists "menu_service_orders_insert_staff" on public.menu_service_orders;
create policy "menu_service_orders_insert_staff"
  on public.menu_service_orders
  for insert
  to authenticated
  with check (public.is_platform_staff());

-- 4) Staff może czytać i edytować profile klientów ze zleceniem
drop policy if exists "profiles_staff_select_menu_service" on public.profiles;
create policy "profiles_staff_select_menu_service"
  on public.profiles
  for select
  to authenticated
  using (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id = profiles.id
        and o.status in ('paid', 'in_progress', 'done')
    )
  );

drop policy if exists "profiles_staff_update_menu_service" on public.profiles;
create policy "profiles_staff_update_menu_service"
  on public.profiles
  for update
  to authenticated
  using (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id = profiles.id
        and o.status in ('paid', 'in_progress', 'done')
    )
  )
  with check (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id = profiles.id
        and o.status in ('paid', 'in_progress', 'done')
    )
  );

-- 5) Staff CRUD na daniach klienta ze zleceniem (paid / in_progress / done)
drop policy if exists "dishes_staff_select_menu_service" on public.dishes;
create policy "dishes_staff_select_menu_service"
  on public.dishes
  for select
  to authenticated
  using (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id::text = dishes."userId"::text
        and o.status in ('paid', 'in_progress', 'done')
    )
  );

drop policy if exists "dishes_staff_insert_menu_service" on public.dishes;
create policy "dishes_staff_insert_menu_service"
  on public.dishes
  for insert
  to authenticated
  with check (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id::text = dishes."userId"::text
        and o.status in ('paid', 'in_progress', 'done')
    )
  );

drop policy if exists "dishes_staff_update_menu_service" on public.dishes;
create policy "dishes_staff_update_menu_service"
  on public.dishes
  for update
  to authenticated
  using (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id::text = dishes."userId"::text
        and o.status in ('paid', 'in_progress', 'done')
    )
  )
  with check (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id::text = dishes."userId"::text
        and o.status in ('paid', 'in_progress', 'done')
    )
  );

drop policy if exists "dishes_staff_delete_menu_service" on public.dishes;
create policy "dishes_staff_delete_menu_service"
  on public.dishes
  for delete
  to authenticated
  using (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id::text = dishes."userId"::text
        and o.status in ('paid', 'in_progress', 'done')
    )
  );

-- 6) Staff CRUD na rekomendacjach klienta ze zleceniem
drop policy if exists "dish_recommendations_staff_all_menu_service" on public.dish_recommendations;
create policy "dish_recommendations_staff_all_menu_service"
  on public.dish_recommendations
  for all
  to authenticated
  using (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id = dish_recommendations.user_id
        and o.status in ('paid', 'in_progress', 'done')
    )
  )
  with check (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id = dish_recommendations.user_id
        and o.status in ('paid', 'in_progress', 'done')
    )
  );

commit;

-- OPCJONALNIE (Storage): jeśli upload zdjęć do folderu klienta nie działa,
-- w Supabase → Storage → Policies dodaj politykę insert/update dla bucketu dish-images:
--   public.is_platform_staff() AND (storage.foldername(name))[1] IN (
--     select client_user_id::text from menu_service_orders where status in ('paid','in_progress')
--   )
