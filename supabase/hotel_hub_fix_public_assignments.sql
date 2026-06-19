-- Poprawka: gość widzi przypisania Hotel Hub nawet gdy manager zapomniał włączyć visible_in_hotel_hub.
-- Uruchom w Supabase SQL Editor (po hotel_hub.sql).

begin;

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
