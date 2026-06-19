-- Hotel Hub — sekcje gościa, kategorie sekcji i przypisania istniejących dań (bez duplikowania produktów).
-- Uruchom w Supabase → SQL Editor (po tabelach profiles + dishes).

begin;

-- Włącznik modułu na profilu restauracji / hotelu
alter table public.profiles
  add column if not exists hotel_hub_enabled boolean not null default false;

comment on column public.profiles.hotel_hub_enabled is 'Czy moduł Hotel Hub jest widoczny w Live Menu';

-- Widoczność dania w Hotel Hub (isOnline pozostaje widocznością w menu restauracji)
alter table public.dishes
  add column if not exists visible_in_hotel_hub boolean not null default false;

comment on column public.dishes.visible_in_hotel_hub is 'Czy danie jest widoczne w sekcjach Hotel Hub';

-- Sekcje Hotel Hub (Room Service, Bar, Spa, własne…)
create table if not exists public.hotel_hub_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  icon_emoji text not null default '🏨',
  hero_image_url text null,
  description text not null default '',
  is_visible boolean not null default true,
  availability_mode text not null default '24h' check (availability_mode in ('24h', 'custom')),
  availability_from time null,
  availability_to time null,
  service_notes text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hotel_hub_sections_user_id_idx
  on public.hotel_hub_sections (user_id);

create index if not exists hotel_hub_sections_user_sort_idx
  on public.hotel_hub_sections (user_id, sort_order);

-- Kategorie wewnątrz sekcji Hotel Hub
create table if not exists public.hotel_hub_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  section_id uuid not null references public.hotel_hub_sections (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists hotel_hub_categories_section_id_idx
  on public.hotel_hub_categories (section_id);

create index if not exists hotel_hub_categories_user_id_idx
  on public.hotel_hub_categories (user_id);

-- Przypisania istniejących dań do sekcji + kategorii Hotel Hub
create table if not exists public.product_section_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dish_id uuid not null references public.dishes (id) on delete cascade,
  section_id uuid not null references public.hotel_hub_sections (id) on delete cascade,
  category_id uuid not null references public.hotel_hub_categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint product_section_assignments_unique unique (dish_id, section_id, category_id)
);

create index if not exists product_section_assignments_dish_id_idx
  on public.product_section_assignments (dish_id);

create index if not exists product_section_assignments_section_id_idx
  on public.product_section_assignments (section_id);

create index if not exists product_section_assignments_user_id_idx
  on public.product_section_assignments (user_id);

-- updated_at dla sekcji
create or replace function public.set_hotel_hub_sections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hotel_hub_sections_updated_at on public.hotel_hub_sections;
create trigger hotel_hub_sections_updated_at
  before update on public.hotel_hub_sections
  for each row
  execute function public.set_hotel_hub_sections_updated_at();

-- RLS
alter table public.hotel_hub_sections enable row level security;
alter table public.hotel_hub_categories enable row level security;
alter table public.product_section_assignments enable row level security;

-- Właściciel: pełny dostęp do sekcji
drop policy if exists "hotel_hub_sections_select_own" on public.hotel_hub_sections;
create policy "hotel_hub_sections_select_own"
  on public.hotel_hub_sections for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "hotel_hub_sections_insert_own" on public.hotel_hub_sections;
create policy "hotel_hub_sections_insert_own"
  on public.hotel_hub_sections for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "hotel_hub_sections_update_own" on public.hotel_hub_sections;
create policy "hotel_hub_sections_update_own"
  on public.hotel_hub_sections for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "hotel_hub_sections_delete_own" on public.hotel_hub_sections;
create policy "hotel_hub_sections_delete_own"
  on public.hotel_hub_sections for delete to authenticated
  using (auth.uid() = user_id);

-- Gość: widoczne sekcje gdy Hotel Hub włączony
drop policy if exists "hotel_hub_sections_select_public" on public.hotel_hub_sections;
create policy "hotel_hub_sections_select_public"
  on public.hotel_hub_sections for select to anon, authenticated
  using (
    is_visible = true
    and exists (
      select 1 from public.profiles p
      where p.id = user_id
        and coalesce(p.hotel_hub_enabled, false) = true
    )
  );

-- Kategorie: właściciel
drop policy if exists "hotel_hub_categories_select_own" on public.hotel_hub_categories;
create policy "hotel_hub_categories_select_own"
  on public.hotel_hub_categories for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "hotel_hub_categories_insert_own" on public.hotel_hub_categories;
create policy "hotel_hub_categories_insert_own"
  on public.hotel_hub_categories for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "hotel_hub_categories_update_own" on public.hotel_hub_categories;
create policy "hotel_hub_categories_update_own"
  on public.hotel_hub_categories for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "hotel_hub_categories_delete_own" on public.hotel_hub_categories;
create policy "hotel_hub_categories_delete_own"
  on public.hotel_hub_categories for delete to authenticated
  using (auth.uid() = user_id);

-- Gość: kategorie widocznych sekcji
drop policy if exists "hotel_hub_categories_select_public" on public.hotel_hub_categories;
create policy "hotel_hub_categories_select_public"
  on public.hotel_hub_categories for select to anon, authenticated
  using (
    exists (
      select 1 from public.hotel_hub_sections s
      join public.profiles p on p.id = s.user_id
      where s.id = section_id
        and s.is_visible = true
        and coalesce(p.hotel_hub_enabled, false) = true
    )
  );

-- Przypisania: właściciel
drop policy if exists "product_section_assignments_select_own" on public.product_section_assignments;
create policy "product_section_assignments_select_own"
  on public.product_section_assignments for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "product_section_assignments_insert_own" on public.product_section_assignments;
create policy "product_section_assignments_insert_own"
  on public.product_section_assignments for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.dishes d
      where d.id = dish_id and d."userId"::text = auth.uid()::text
    )
  );

drop policy if exists "product_section_assignments_update_own" on public.product_section_assignments;
create policy "product_section_assignments_update_own"
  on public.product_section_assignments for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "product_section_assignments_delete_own" on public.product_section_assignments;
create policy "product_section_assignments_delete_own"
  on public.product_section_assignments for delete to authenticated
  using (auth.uid() = user_id);

-- Gość: przypisania dań w widocznych sekcjach (nie wymaga visible_in_hotel_hub — wystarczy przypisanie)
drop policy if exists "product_section_assignments_select_public" on public.product_section_assignments;
create policy "product_section_assignments_select_public"
  on public.product_section_assignments for select to anon, authenticated
  using (
    exists (
      select 1
      from public.hotel_hub_sections s
      join public.profiles p on p.id = s.user_id
      where s.id = section_id
        and s.is_visible = true
        and coalesce(p.hotel_hub_enabled, false) = true
    )
    and exists (
      select 1 from public.dishes d
      where d.id = dish_id
        and d."userId"::text = user_id::text
    )
  );

commit;
