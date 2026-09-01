-- Jednorazowe kody promocyjne + sesje urządzeń ChefVision Verify.
-- Uruchom w Supabase → SQL Editor (po tabeli profiles).
-- Restauracja = public.profiles.id (= auth.users.id). Brak osobnej tabeli restaurants.

begin;

-- PIN kelnera (hash) — nigdy nie wystawiać publicznie / do widoku /verify.
alter table public.profiles
  add column if not exists waiter_pin_hash text;

alter table public.profiles
  add column if not exists waiter_pin_updated_at timestamptz;

comment on column public.profiles.waiter_pin_hash is
  'Hash PIN-u Verify (pbkdf2). Nie zwracać do frontendu.';
comment on column public.profiles.waiter_pin_updated_at is
  'Ostatnia zmiana PIN-u Verify.';

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  campaign_id uuid null,
  email text null,
  code text not null,
  reward_name text not null,
  reward_description text null,
  status text not null default 'active'
    check (status in ('active', 'used', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  used_at timestamptz null,
  used_by_device text null,
  metadata jsonb not null default '{}'::jsonb,
  constraint promo_codes_code_format
    check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ]{2}-[0-9]{4}$')
);

comment on table public.promo_codes is
  'Jednorazowe kody promocji. user_id = restauracja (profiles.id).';
comment on column public.promo_codes.campaign_id is
  'Opcjonalne ID kampanii (przyszłość — obecnie brak tabeli kampanii).';
comment on column public.promo_codes.email is
  'E-mail gościa po potwierdzeniu (DOI). Nie pokazywać kelnerowi.';

create unique index if not exists promo_codes_active_code_per_restaurant_uidx
  on public.promo_codes (user_id, code)
  where status = 'active';

create index if not exists promo_codes_user_status_idx
  on public.promo_codes (user_id, status);

create index if not exists promo_codes_user_created_idx
  on public.promo_codes (user_id, created_at desc);

create table if not exists public.verify_device_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  device_label text null
);

comment on table public.verify_device_sessions is
  'Ograniczone sesje urządzeń kelnera dla /verify. Token w plaintext tylko raz na unlock.';

create unique index if not exists verify_device_sessions_token_hash_uidx
  on public.verify_device_sessions (token_hash);

create index if not exists verify_device_sessions_user_id_idx
  on public.verify_device_sessions (user_id);

create index if not exists verify_device_sessions_expires_at_idx
  on public.verify_device_sessions (expires_at);

alter table public.promo_codes enable row level security;
alter table public.verify_device_sessions enable row level security;

-- Właściciel widzi / zarządza swoimi kodami z panelu (RLS).
-- Kelner NIE korzysta z klienta Supabase — lookup/redeem tylko przez API + service role.
-- Staff platformy też działa przez API (service role), bez zależności od is_platform_staff().

drop policy if exists "promo_codes_select_own" on public.promo_codes;
create policy "promo_codes_select_own"
  on public.promo_codes
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "promo_codes_insert_own" on public.promo_codes;
create policy "promo_codes_insert_own"
  on public.promo_codes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "promo_codes_update_own" on public.promo_codes;
create policy "promo_codes_update_own"
  on public.promo_codes
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Sesje urządzeń: brak dostępu z klienta (anon/authenticated). Tylko service_role.
drop policy if exists "verify_device_sessions_no_client" on public.verify_device_sessions;

-- Atomowa realizacja: tylko jeden UPDATE status=active przechodzi przy wyścigu.
create or replace function public.redeem_promo_code_atomic(
  p_user_id uuid,
  p_code text,
  p_used_by_device text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.promo_codes;
begin
  update public.promo_codes
  set
    status = 'used',
    used_at = now(),
    used_by_device = p_used_by_device
  where user_id = p_user_id
    and code = p_code
    and status = 'active'
    and (expires_at is null or expires_at > now())
  returning * into rec;

  if rec.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', rec.id,
    'code', rec.code,
    'reward_name', rec.reward_name,
    'reward_description', rec.reward_description,
    'used_at', rec.used_at
  );
end;
$$;

revoke all on function public.redeem_promo_code_atomic(uuid, text, text) from public;
revoke all on function public.redeem_promo_code_atomic(uuid, text, text) from anon;
revoke all on function public.redeem_promo_code_atomic(uuid, text, text) from authenticated;
grant execute on function public.redeem_promo_code_atomic(uuid, text, text) to service_role;

commit;
