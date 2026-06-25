-- Rekomendacje sprzedażowe na kartach menu cyfrowego (Polecane / Popularne / W zestawie taniej).
-- Uruchom w Supabase → SQL Editor (po tabelach profiles + dishes).

begin;

create table if not exists public.dish_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dish_id uuid not null references public.dishes (id) on delete cascade,
  type text not null check (type in ('polecane', 'popularne', 'zestaw')),
  is_active boolean not null default true,
  custom_header_text text null,
  bundle_price_outside text null,
  bundle_price text null,
  currency text not null default 'PLN'
    check (
      currency in (
        'PLN', 'EUR', 'USD', 'GBP', 'CHF',
        'CZK', 'SEK', 'NOK', 'DKK', 'HUF',
        'UAH', 'ILS', 'AED', 'CAD', 'AUD'
      )
    ),
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dish_recommendations_one_per_dish unique (dish_id)
);

create index if not exists dish_recommendations_user_id_idx
  on public.dish_recommendations (user_id);

create index if not exists dish_recommendations_dish_id_idx
  on public.dish_recommendations (dish_id);

create or replace function public.set_dish_recommendations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists dish_recommendations_updated_at on public.dish_recommendations;
create trigger dish_recommendations_updated_at
  before update on public.dish_recommendations
  for each row
  execute function public.set_dish_recommendations_updated_at();

alter table public.dish_recommendations enable row level security;

-- Właściciel: pełny dostęp do swoich rekomendacji.
drop policy if exists "dish_recommendations_select_own" on public.dish_recommendations;
create policy "dish_recommendations_select_own"
  on public.dish_recommendations
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "dish_recommendations_insert_own" on public.dish_recommendations;
create policy "dish_recommendations_insert_own"
  on public.dish_recommendations
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.dishes d
      where d.id = dish_id
        and d."userId"::text = auth.uid()::text
    )
  );

drop policy if exists "dish_recommendations_update_own" on public.dish_recommendations;
create policy "dish_recommendations_update_own"
  on public.dish_recommendations
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.dishes d
      where d.id = dish_id
        and d."userId"::text = auth.uid()::text
    )
  );

drop policy if exists "dish_recommendations_delete_own" on public.dish_recommendations;
create policy "dish_recommendations_delete_own"
  on public.dish_recommendations
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Gość (menu publiczne): tylko aktywne rekomendacje dla dań online.
drop policy if exists "dish_recommendations_select_public" on public.dish_recommendations;
create policy "dish_recommendations_select_public"
  on public.dish_recommendations
  for select
  to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1 from public.dishes d
      where d.id = dish_id
        and d."userId"::text = user_id::text
        and d."isOnline" = true
    )
  );

commit;
