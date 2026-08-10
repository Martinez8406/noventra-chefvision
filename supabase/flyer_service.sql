-- ChefVision: zlecenia ulotki QR (projekt graficzny).
-- Uruchom w Supabase → SQL Editor.
-- Wymaga wcześniej uruchomionego menu_service.sql (funkcja is_platform_staff).

begin;

create table if not exists public.flyer_service_orders (
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

commit;
