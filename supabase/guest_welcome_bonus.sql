-- Jednorazowy rabat powitalny Klubu gości: jeden kod na adres e-mail w lokalu.
-- Uruchom w Supabase → SQL Editor po supabase/promo_codes.sql i supabase/promo_leads.sql.
-- Nie nadaje bonusów istniejącym kontaktom.

begin;

create unique index if not exists promo_codes_welcome_email_uidx
  on public.promo_codes (user_id, email)
  where coalesce(metadata->>'kind', '') = 'guest_club_welcome';

comment on index public.promo_codes_welcome_email_uidx is
  'Jeden rabat powitalny Klubu na adres e-mail w danym lokalu. Nie dotyczy innych kodów Verify.';

commit;
