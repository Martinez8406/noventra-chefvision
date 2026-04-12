-- Jednorazowa migracja: jeśli wcześniej uruchomiłeś tylko `profiles.sql` BEZ polityki publicznego menu,
-- wklej i uruchom ten plik w Supabase → SQL Editor.
-- Pełny, aktualny zestaw polityk jest też w `profiles.sql` (sekcja profiles_select_public_menu).
--
-- Publiczne Menu Live ładuje branding z tabeli `profiles` (kolory, logo, nazwa).
-- Domyślna polityka `profiles_select_own` pozwala na SELECT tylko gdy auth.uid() = id.
-- Gość przy stoliku nie jest zalogowany — potrzebna jest poniższa polityka, inaczej widać domyślne kolory.
--
-- Uwaga: pozwala na odczyt wszystkich kolumn przy SELECT * z API. W aplikacji prosisz tylko
-- o pola brandingowe; jeśli w `profiles` są wrażliwe dane, rozważ osobny widok lub przeniesienie ich.

begin;

drop policy if exists "profiles_select_public_menu" on public.profiles;

create policy "profiles_select_public_menu"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

commit;
