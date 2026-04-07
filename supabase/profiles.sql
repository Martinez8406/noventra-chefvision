-- Supabase: auto-create profiles row for each new auth user.
-- Run this in Supabase SQL Editor (Project → SQL Editor).
--
-- IMPORTANT:
-- - "Database error saving new user" during signup usually means THIS trigger/function failed.
-- - This script is defensive: it will NOT block signup even if profile creation fails.
-- - It sets fields only if the columns exist in public.profiles.

begin;

-- 1) Function to create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_email              boolean;
  has_name               boolean;
  has_ai_credits         boolean;
  has_subscription_status boolean;
  has_generations_used   boolean;
begin
  -- Always try to ensure a profiles row exists (minimal insert).
  -- If your table has extra NOT NULL columns without defaults, add defaults in the table definition.
  begin
    insert into public.profiles (id)
    values (new.id)
    on conflict (id) do nothing;
  exception
    when others then
      -- Never break signup due to profile creation issues.
      return new;
  end;

  -- Detect which columns exist, then set them safely.
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'
  ) into has_email;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'name'
  ) into has_name;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'ai_credits'
  ) into has_ai_credits;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'subscription_status'
  ) into has_subscription_status;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'generations_used'
  ) into has_generations_used;

  begin
    if has_email then
      execute 'update public.profiles set email = coalesce(email, $1) where id = $2'
      using new.email, new.id;
    end if;

    if has_name then
      execute 'update public.profiles set name = coalesce(name, $1) where id = $2'
      using coalesce(nullif(split_part(new.email, '@', 1), ''), 'Restauracja'), new.id;
    end if;

    if has_ai_credits then
      execute 'update public.profiles set ai_credits = coalesce(ai_credits, 5) where id = $1'
      using new.id;
    end if;

    if has_subscription_status then
      execute 'update public.profiles set subscription_status = coalesce(subscription_status, ''trial'') where id = $1'
      using new.id;
    end if;

    if has_generations_used then
      execute 'update public.profiles set generations_used = coalesce(generations_used, 0) where id = $1'
      using new.id;
    end if;
  exception
    when others then
      -- Still do not block signup.
      null;
  end;

  return new;
end;
$$;

-- 2) Trigger on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3) RLS policies (recommended)
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Optional: allow inserting own row from client (not required if trigger works)
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (auth.uid() = id);

commit;

