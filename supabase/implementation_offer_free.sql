-- Oferta wdrożeniowa 0 zł: status pending + payment_status/price/currency.
-- Uruchom w Supabase → SQL Editor.
-- Nie zmienia webhooków Stripe ani istniejących zleceń płatnych.

begin;

-- MENU
alter table public.menu_service_orders
  drop constraint if exists menu_service_orders_status_check;

alter table public.menu_service_orders
  add constraint menu_service_orders_status_check
  check (status in ('pending', 'paid', 'in_progress', 'done', 'cancelled'));

alter table public.menu_service_orders
  add column if not exists payment_status text not null default 'stripe';

alter table public.menu_service_orders
  drop constraint if exists menu_service_orders_payment_status_check;

alter table public.menu_service_orders
  add constraint menu_service_orders_payment_status_check
  check (payment_status in ('stripe', 'free'));

alter table public.menu_service_orders
  add column if not exists price numeric(10, 2);

alter table public.menu_service_orders
  add column if not exists currency text not null default 'PLN';

-- FLYER — utwórz tabelę, jeśli jeszcze nie istnieje (supabase/flyer_service.sql nie był odpalony)
create table if not exists public.flyer_service_orders (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'paid',
  stripe_checkout_session_id text null unique,
  stripe_customer_id text null,
  assigned_to uuid null references auth.users (id) on delete set null,
  notes text null,
  paid_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists flyer_service_orders_client_idx
  on public.flyer_service_orders (client_user_id);

create index if not exists flyer_service_orders_status_idx
  on public.flyer_service_orders (status);

create or replace function public.set_flyer_service_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists flyer_service_orders_updated_at on public.flyer_service_orders;
create trigger flyer_service_orders_updated_at
  before update on public.flyer_service_orders
  for each row
  execute function public.set_flyer_service_orders_updated_at();

alter table public.flyer_service_orders enable row level security;

drop policy if exists "flyer_service_orders_select_own" on public.flyer_service_orders;
create policy "flyer_service_orders_select_own"
  on public.flyer_service_orders
  for select
  to authenticated
  using (auth.uid() = client_user_id or public.is_platform_staff());

drop policy if exists "flyer_service_orders_update_staff" on public.flyer_service_orders;
create policy "flyer_service_orders_update_staff"
  on public.flyer_service_orders
  for update
  to authenticated
  using (public.is_platform_staff())
  with check (public.is_platform_staff());

drop policy if exists "flyer_service_orders_insert_staff" on public.flyer_service_orders;
create policy "flyer_service_orders_insert_staff"
  on public.flyer_service_orders
  for insert
  to authenticated
  with check (public.is_platform_staff());

alter table public.flyer_service_orders
  drop constraint if exists flyer_service_orders_status_check;

alter table public.flyer_service_orders
  add constraint flyer_service_orders_status_check
  check (status in ('pending', 'paid', 'in_progress', 'done', 'cancelled'));

alter table public.flyer_service_orders
  add column if not exists payment_status text not null default 'stripe';

alter table public.flyer_service_orders
  drop constraint if exists flyer_service_orders_payment_status_check;

alter table public.flyer_service_orders
  add constraint flyer_service_orders_payment_status_check
  check (payment_status in ('stripe', 'free'));

alter table public.flyer_service_orders
  add column if not exists price numeric(10, 2);

alter table public.flyer_service_orders
  add column if not exists currency text not null default 'PLN';

-- Staff może realizować zlecenia pending tak samo jak paid
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
        and o.status in ('pending', 'paid', 'in_progress', 'done')
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
        and o.status in ('pending', 'paid', 'in_progress', 'done')
    )
  )
  with check (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id = profiles.id
        and o.status in ('pending', 'paid', 'in_progress', 'done')
    )
  );

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
        and o.status in ('pending', 'paid', 'in_progress', 'done')
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
        and o.status in ('pending', 'paid', 'in_progress', 'done')
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
        and o.status in ('pending', 'paid', 'in_progress', 'done')
    )
  )
  with check (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id::text = dishes."userId"::text
        and o.status in ('pending', 'paid', 'in_progress', 'done')
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
        and o.status in ('pending', 'paid', 'in_progress', 'done')
    )
  );

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
        and o.status in ('pending', 'paid', 'in_progress', 'done')
    )
  )
  with check (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id = dish_recommendations.user_id
        and o.status in ('pending', 'paid', 'in_progress', 'done')
    )
  );

commit;
