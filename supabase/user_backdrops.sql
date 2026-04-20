-- Tła użytkownika (Studio Tła) — max 5 rekordów na użytkownika (egzekwowane w aplikacji przy zapisie).
-- Uruchom w Supabase: SQL Editor → wklej → Run.
--
-- Po utworzeniu tabeli: zdjęcia trafiają do istniejącego bucketa dish-images / food-images
-- (ścieżka `{userId}/backdrops/{uuid}.png`) — te same polityki co dla zdjęć dań (folder = user id).

create table if not exists public.user_backdrops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  image_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists user_backdrops_user_id_created_at_idx
  on public.user_backdrops (user_id, created_at desc);

alter table public.user_backdrops enable row level security;

drop policy if exists "user_backdrops_select_own" on public.user_backdrops;
create policy "user_backdrops_select_own"
  on public.user_backdrops
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_backdrops_insert_own" on public.user_backdrops;
create policy "user_backdrops_insert_own"
  on public.user_backdrops
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_backdrops_delete_own" on public.user_backdrops;
create policy "user_backdrops_delete_own"
  on public.user_backdrops
  for delete
  using (auth.uid() = user_id);
