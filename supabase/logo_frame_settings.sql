-- Kadrowanie logo w Live Menu (object-position + zoom)
-- Uruchom w Supabase → SQL Editor

alter table public.profiles
  add column if not exists logo_object_position text not null default 'center',
  add column if not exists logo_scale numeric not null default 1;

comment on column public.profiles.logo_object_position is 'CSS object-position: top|center|bottom + left|right';
comment on column public.profiles.logo_scale is 'Skala logo w ramce (0.45–2.0, 1.0 = domyślnie)';
