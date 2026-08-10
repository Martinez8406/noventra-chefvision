-- Statystyki otwarć widoku szczegółowego dania (7 dni / miesiąc / łącznie).
-- Uruchom w Supabase → SQL Editor (po dishes + profiles).

begin;

alter table public.dishes
  add column if not exists clicks integer not null default 0;

create table if not exists public.dish_view_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  dish_id uuid not null references public.dishes (id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists dish_view_events_owner_viewed_at_idx
  on public.dish_view_events (owner_id, viewed_at desc);

create index if not exists dish_view_events_owner_dish_viewed_at_idx
  on public.dish_view_events (owner_id, dish_id, viewed_at desc);

alter table public.dish_view_events enable row level security;

-- Zapis przez API (service role) — opcjonalnie anon insert jak menu_open (bez ujawniania).
drop policy if exists "dish_view_events_insert_public" on public.dish_view_events;
create policy "dish_view_events_insert_public"
  on public.dish_view_events
  for insert
  to anon, authenticated
  with check (owner_id is not null and dish_id is not null);

drop policy if exists "dish_view_events_select_own" on public.dish_view_events;
create policy "dish_view_events_select_own"
  on public.dish_view_events
  for select
  to authenticated
  using (auth.uid() = owner_id);

comment on table public.dish_view_events is
  'Otwarcia widoku szczegółowego dania w Live Menu (do rankingów czasowych)';

commit;
