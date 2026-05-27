-- Kadrowanie zdjęcia cover w Live Menu (object-position + zoom)
-- Uruchom w Supabase → SQL Editor

alter table public.profiles
  add column if not exists cover_object_position text not null default 'center',
  add column if not exists cover_scale numeric not null default 1;

comment on column public.profiles.cover_object_position is 'CSS object-position covera w banerze menu';
comment on column public.profiles.cover_scale is 'Zoom covera (1.0–2.5, 1.0 = domyślnie)';
