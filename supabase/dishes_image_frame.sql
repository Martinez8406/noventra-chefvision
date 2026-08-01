-- Kadrowanie zdjęć dań w menu cyfrowym (CSS object-position + scale).
-- Uruchom w Supabase → SQL Editor.

alter table public.dishes
  add column if not exists image_object_position text not null default 'center';

alter table public.dishes
  add column if not exists image_scale numeric not null default 1;

comment on column public.dishes.image_object_position is
  'CSS object-position zdjęcia dania w menu: top|center|bottom + left|right';

comment on column public.dishes.image_scale is
  'Powiększenie kadru zdjęcia dania w menu (1 = 100%, max ok. 2.5)';
