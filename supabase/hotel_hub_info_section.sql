-- Sekcja informacyjna Hotel Hub („Informacje o hotelu”)
-- Uruchom w Supabase SQL Editor (po hotel_hub.sql).

begin;

alter table public.hotel_hub_sections
  add column if not exists section_type text not null default 'menu';

alter table public.hotel_hub_sections
  add column if not exists info_fields jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'hotel_hub_sections_section_type_check'
  ) then
    alter table public.hotel_hub_sections
      add constraint hotel_hub_sections_section_type_check
      check (section_type in ('menu', 'info'));
  end if;
end $$;

comment on column public.hotel_hub_sections.section_type is 'menu = kategorie+produkty; info = informacje o hotelu';
comment on column public.hotel_hub_sections.info_fields is 'JSON: kontakt, adres, telefon, e-mail, godziny, check-in/out, śniadania, spa, bar, wi-fi, transport, atrakcje (maps)';

commit;
