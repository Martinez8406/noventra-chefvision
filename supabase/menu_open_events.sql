-- Statystyki otwarć menu cyfrowego (dziennie/miesięcznie)
-- Uruchom w Supabase SQL Editor.

begin;

create table if not exists public.menu_open_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  opened_at timestamptz not null default now(),
  source text null
);

create index if not exists menu_open_events_owner_opened_at_idx
  on public.menu_open_events(owner_id, opened_at desc);

alter table public.menu_open_events enable row level security;

-- Publiczne menu może dopisać zdarzenie otwarcia bez logowania.
drop policy if exists "menu_open_events_insert_public" on public.menu_open_events;
create policy "menu_open_events_insert_public"
  on public.menu_open_events
  for insert
  to anon, authenticated
  with check (owner_id is not null);

-- Właściciel widzi tylko swoje statystyki.
drop policy if exists "menu_open_events_select_own" on public.menu_open_events;
create policy "menu_open_events_select_own"
  on public.menu_open_events
  for select
  to authenticated
  using (auth.uid() = owner_id);

commit;

