-- Śledzenie wysłanych powiadomień Discord o nowej rejestracji (raz na użytkownika).
alter table public.profiles
  add column if not exists discord_registration_notified_at timestamptz;

comment on column public.profiles.discord_registration_notified_at is
  'Kiedy wysłano powiadomienie Discord o rejestracji (null = jeszcze nie)';
