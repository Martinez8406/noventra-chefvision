-- ChefVision: Stripe subscription + token columns on profiles.
-- Run in Supabase SQL Editor after deploying the webhook.
--
-- Token buckets:
--   trial_tokens         — 50 on signup, expire when trial_ends_at passes
--   subscription_tokens  — 50 per billing period (reset via webhook on renewal)
--   extra_tokens         — purchased add-ons, never expire
--
-- Plan values: trial | premium | free
-- subscription_status kept for backward compatibility with existing app code.

begin;

alter table public.profiles
  add column if not exists plan text default 'trial',
  add column if not exists trial_tokens integer default 50,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists subscription_tokens integer default 0,
  add column if not exists extra_tokens integer default 0,
  add column if not exists tokens_reset_at timestamptz,
  add column if not exists subscription_period_start bigint,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_status text,
  add column if not exists current_period_end timestamptz,
  add column if not exists payment_failed_at timestamptz;

create unique index if not exists profiles_stripe_customer_id_key
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- Trial defaults for new signups (14 days, 50 trial tokens)
create or replace function public.set_trial_defaults_on_profile()
returns trigger
language plpgsql
as $$
begin
  if new.trial_ends_at is null then
    new.trial_ends_at := now() + interval '14 days';
  end if;
  if new.trial_tokens is null then
    new.trial_tokens := 50;
  end if;
  if new.plan is null then
    new.plan := 'trial';
  end if;
  if new.subscription_status is null then
    new.subscription_status := 'trial';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_set_trial_defaults on public.profiles;
create trigger profiles_set_trial_defaults
  before insert or update on public.profiles
  for each row execute function public.set_trial_defaults_on_profile();

commit;
