-- Lead gościa + konfiguracja promocji na Live Menu (Double Opt-In).
-- Uruchom w Supabase → SQL Editor (po supabase/promo_codes.sql).

begin;

alter table public.profiles
  add column if not exists guest_promo jsonb not null default '{}'::jsonb;

comment on column public.profiles.guest_promo is
  'MVP promocji gościa: {active, reward_name, reward_description, expires_in_days, max_per_email}. Nie wystawiać hashy/PIN.';

create table if not exists public.promo_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  first_name text not null,
  email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'unsubscribed', 'blocked')),
  terms_accepted_at timestamptz null,
  marketing_consent_at timestamptz null,
  confirmation_token_hash text not null,
  confirmation_sent_at timestamptz null,
  confirmation_expires_at timestamptz not null,
  confirmed_at timestamptz null,
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz null,
  promo_code_id uuid null references public.promo_codes (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.promo_leads is
  'Zapisy gości do promocji (DOI). 1 email = 1 bonus na restaurację (MVP).';
comment on column public.promo_leads.confirmation_token_hash is
  'SHA-256 tokenu z maila. Surowego tokenu nie przechowujemy.';
comment on column public.promo_leads.email is
  'Zawsze trim + lowercase.';

create unique index if not exists promo_leads_restaurant_email_uidx
  on public.promo_leads (user_id, email);

create unique index if not exists promo_leads_token_hash_uidx
  on public.promo_leads (confirmation_token_hash);

create index if not exists promo_leads_user_status_idx
  on public.promo_leads (user_id, status);

create index if not exists promo_leads_promo_code_id_idx
  on public.promo_leads (promo_code_id);

alter table public.promo_leads enable row level security;

drop policy if exists "promo_leads_select_own" on public.promo_leads;
create policy "promo_leads_select_own"
  on public.promo_leads
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Zapis / potwierdzenie wyłącznie przez API + service role.

commit;
