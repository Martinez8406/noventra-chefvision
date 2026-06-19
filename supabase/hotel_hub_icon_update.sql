-- Ustawia ikonę hotelu we wszystkich sekcjach Hotel Hub (opcjonalnie — panel admina robi to automatycznie).
-- Uruchom w Supabase SQL Editor.

begin;

update public.hotel_hub_sections
set icon_emoji = '/Zrzut_ekranu_2026-06-19_122743-removebg-preview.png';

commit;
