-- Pełny reset konta po ponownej rejestracji na ten sam e-mail
-- Uruchom w Supabase → SQL Editor PRZED ponowną rejestracją (albo na istniejącym koncie).
--
-- Dlaczego: profiles jest powiązany z auth.users po UUID (id), nie po e-mailu.
-- Samo usunięcie użytkownika w Auth czasem zostawia wiersz w profiles
-- albo Supabase przywraca to samo konto (to samo id) ze starymi tokenami.

begin;

-- 1) Podgląd: co jest w bazie dla tego e-maila
select
  u.id as auth_id,
  u.email,
  u.created_at as auth_created,
  p.plan,
  p.trial_tokens,
  p.ai_credits,
  p.generations_used,
  p.trial_ends_at,
  p.subscription_status
from auth.users u
left join public.profiles p on p.id = u.id
where u.email = 'martinteam400@gmail.com';

-- 2a) OPCJA A — tylko napraw trial (zostaw konto, ustaw 50 tokenów od nowa)
-- odkomentuj blok poniżej zamię OPcji B:

/*
update public.profiles p
set
  plan = 'trial',
  subscription_status = 'trial',
  trial_tokens = 50,
  trial_ends_at = now() + interval '14 days',
  subscription_tokens = 0,
  stripe_customer_id = null,
  stripe_subscription_id = null,
  stripe_subscription_status = null,
  ai_credits = 50,
  generations_used = 0
from auth.users u
where p.id = u.id
  and u.email = 'martinteam400@gmail.com';
*/

-- 2b) OPCJA B — usuń profil(e) powiązane z e-mailem (osierocone + aktualne)
delete from public.profiles p
using auth.users u
where p.id = u.id
  and u.email = 'martinteam400@gmail.com';

delete from public.profiles
where email = 'martinteam400@gmail.com';

-- 3) Usuń użytkownika z Auth (wymaga uprawnień; w Dashboard: Authentication → Users też możesz ręcznie)
delete from auth.users
where email = 'martinteam400@gmail.com';

commit;

-- Po tym: zarejestruj się ponownie w aplikacji → nowe id → nowy profil z 50 tokenami trial.
-- W przeglądarce: wyloguj, usuń localStorage klucz chefvision_premium, Ctrl+F5.
