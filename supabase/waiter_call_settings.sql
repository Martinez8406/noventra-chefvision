-- Wezwanie kelnera / rachunek (Discord webhook per restauracja)
-- Uruchom w Supabase SQL Editor (bezpieczna wersja — bez DROP).

alter table public.profiles
  add column if not exists waiter_call_enabled boolean not null default false;

alter table public.profiles
  add column if not exists discord_waiter_webhook_url text;

alter table public.profiles
  add column if not exists waiter_table_count integer;

-- Flaga widoczna publicznie bez ujawniania URL webhooka.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'waiter_call_available'
  ) then
    alter table public.profiles
      add column waiter_call_available boolean
      generated always as (
        coalesce(waiter_call_enabled, false)
        and discord_waiter_webhook_url is not null
        and length(trim(discord_waiter_webhook_url)) > 0
      ) stored;
  end if;
end $$;

comment on column public.profiles.waiter_call_enabled is 'Czy goście mogą wołać kelnera / prosić o rachunek z Live Menu';
comment on column public.profiles.discord_waiter_webhook_url is 'Discord webhook URL — tylko backend i właściciel (nie wystawiać publicznie)';
comment on column public.profiles.waiter_call_available is 'Publiczna flaga: funkcja włączona i webhook skonfigurowany';
comment on column public.profiles.waiter_table_count is 'Liczba stolików do generatora QR (opcjonalnie)';
