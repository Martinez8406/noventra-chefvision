-- Allow staff/admin to keep editing client menus after order status = done.
-- Run in Supabase → SQL Editor (after menu_service.sql).

begin;

drop policy if exists "profiles_staff_update_menu_service" on public.profiles;
create policy "profiles_staff_update_menu_service"
  on public.profiles
  for update
  to authenticated
  using (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id = profiles.id
        and o.status in ('paid', 'in_progress', 'done')
    )
  )
  with check (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id = profiles.id
        and o.status in ('paid', 'in_progress', 'done')
    )
  );

drop policy if exists "dishes_staff_insert_menu_service" on public.dishes;
create policy "dishes_staff_insert_menu_service"
  on public.dishes
  for insert
  to authenticated
  with check (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id::text = dishes."userId"::text
        and o.status in ('paid', 'in_progress', 'done')
    )
  );

drop policy if exists "dishes_staff_update_menu_service" on public.dishes;
create policy "dishes_staff_update_menu_service"
  on public.dishes
  for update
  to authenticated
  using (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id::text = dishes."userId"::text
        and o.status in ('paid', 'in_progress', 'done')
    )
  )
  with check (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id::text = dishes."userId"::text
        and o.status in ('paid', 'in_progress', 'done')
    )
  );

drop policy if exists "dishes_staff_delete_menu_service" on public.dishes;
create policy "dishes_staff_delete_menu_service"
  on public.dishes
  for delete
  to authenticated
  using (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id::text = dishes."userId"::text
        and o.status in ('paid', 'in_progress', 'done')
    )
  );

drop policy if exists "dish_recommendations_staff_all_menu_service" on public.dish_recommendations;
create policy "dish_recommendations_staff_all_menu_service"
  on public.dish_recommendations
  for all
  to authenticated
  using (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id = dish_recommendations.user_id
        and o.status in ('paid', 'in_progress', 'done')
    )
  )
  with check (
    public.is_platform_staff()
    and exists (
      select 1 from public.menu_service_orders o
      where o.client_user_id = dish_recommendations.user_id
        and o.status in ('paid', 'in_progress', 'done')
    )
  );

commit;
