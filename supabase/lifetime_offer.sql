-- ChefVision: limitowana oferta Founder Lifetime (płatność jednorazowa).
-- Uruchom w Supabase → SQL Editor.
--
-- Etapy sprzedaży (liczone po stronie serwera, nie z frontendu):
--   konta 1–10:  599 zł
--   konta 11–20: 799 zł
--   po 20:       oferta wyprzedana
--
-- Źródło prawdy puli: public.lifetime_purchases (status paid + świeże pending).

begin;

alter table public.profiles
  add column if not exists lifetime_purchased_at timestamptz,
  add column if not exists lifetime_price_pln integer;

create table if not exists public.lifetime_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slot_number integer not null,
  price_pln integer not null,
  stripe_price_id text null,
  stripe_checkout_session_id text null,
  stripe_customer_id text null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired')),
  created_at timestamptz not null default now(),
  paid_at timestamptz null
);

create unique index if not exists lifetime_purchases_active_slot_key
  on public.lifetime_purchases (slot_number)
  where status in ('pending', 'paid');

create unique index if not exists lifetime_purchases_session_key
  on public.lifetime_purchases (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists lifetime_purchases_one_paid_per_user
  on public.lifetime_purchases (user_id)
  where status = 'paid';

create index if not exists lifetime_purchases_status_idx
  on public.lifetime_purchases (status, created_at);

create index if not exists profiles_lifetime_purchased_at_idx
  on public.profiles (lifetime_purchased_at)
  where lifetime_purchased_at is not null;

alter table public.lifetime_purchases enable row level security;

drop policy if exists "lifetime_purchases_select_own" on public.lifetime_purchases;
create policy "lifetime_purchases_select_own"
  on public.lifetime_purchases
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Inserty i aktualizacje robi wyłącznie backend (service role).

commit;
