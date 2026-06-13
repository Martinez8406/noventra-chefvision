-- Opinie i sugestie gości (Guest Feedback)
-- Uruchom w Supabase SQL Editor (bezpieczna wersja — bez DROP).

alter table public.profiles
  add column if not exists feedback_enabled boolean not null default true;

alter table public.profiles
  add column if not exists feedback_email text;

-- Flaga widoczna publicznie bez ujawniania adresu e-mail managera.
-- Dodawana tylko gdy jeszcze nie istnieje (bez usuwania kolumn).
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'feedback_available'
  ) then
    alter table public.profiles
      add column feedback_available boolean
      generated always as (
        coalesce(feedback_enabled, false)
        and feedback_email is not null
        and length(trim(feedback_email)) > 0
      ) stored;
  end if;
end $$;

comment on column public.profiles.feedback_enabled is 'Czy goście mogą wysyłać opinie z Live Menu';
comment on column public.profiles.feedback_email is 'Adres e-mail managera — tylko backend (Resend)';
comment on column public.profiles.feedback_available is 'Publiczna flaga: feedback włączony i e-mail skonfigurowany';
