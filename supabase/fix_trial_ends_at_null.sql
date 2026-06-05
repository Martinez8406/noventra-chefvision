-- Naprawa kont trial bez daty końca (trial_ends_at IS NULL → trial nigdy nie wygasa).
-- Uruchom w Supabase → SQL Editor.
--
-- Przyczyna: profil utworzony przed migracją stripe_subscription.sql
-- albo insert bez trial_ends_at (trigger działa tylko przy INSERT).

begin;

-- 1) Podgląd dotkniętych kont
select
  u.email,
  u.created_at as signup_at,
  p.plan,
  p.subscription_status,
  p.trial_tokens,
  p.trial_ends_at,
  u.created_at + interval '14 days' as proposed_trial_ends_at
from auth.users u
join public.profiles p on p.id = u.id
where (p.plan = 'trial' or p.subscription_status = 'trial')
  and p.trial_ends_at is null
order by u.created_at;

-- 2) Ustaw datę końca trialu: 14 dni od rejestracji (auth.users.created_at)
update public.profiles p
set
  trial_ends_at = u.created_at + interval '14 days',
  trial_tokens = coalesce(p.trial_tokens, 50),
  plan = coalesce(p.plan, 'trial'),
  subscription_status = coalesce(p.subscription_status, 'trial'),
  ai_credits = coalesce(p.ai_credits, p.trial_tokens, 50)
from auth.users u
where p.id = u.id
  and (p.plan = 'trial' or p.subscription_status = 'trial')
  and p.trial_ends_at is null;

-- 3) Opcjonalnie: jedno konto (odkomentuj i zmień e-mail)
/*
update public.profiles p
set trial_ends_at = u.created_at + interval '14 days'
from auth.users u
where p.id = u.id
  and u.email = 'cityplacebistro@gmail.com';
*/

-- 4) Wygasłe triale → plan darmowy w tabeli profiles (trial_ends_at < teraz)
-- Uruchom osobno, gdy w Supabase wciąż widać plan = trial mimo minionej daty.

/*
-- Podgląd wygasłych trialów:
select
  u.email,
  p.trial_ends_at,
  p.plan,
  p.subscription_status
from auth.users u
join public.profiles p on p.id = u.id
where (p.plan = 'trial' or p.subscription_status = 'trial')
  and p.trial_ends_at is not null
  and p.trial_ends_at < now()
  and p.stripe_subscription_id is null
order by p.trial_ends_at;

-- Wszyscy z wygasłym trialem:
update public.profiles p
set
  plan = 'free',
  subscription_status = 'free_limited'
from auth.users u
where p.id = u.id
  and (p.plan = 'trial' or p.subscription_status = 'trial')
  and p.trial_ends_at is not null
  and p.trial_ends_at < now()
  and p.stripe_subscription_id is null;

-- Jedno konto (np. jankoniuszko@interia.pl):
update public.profiles p
set
  plan = 'free',
  subscription_status = 'free_limited'
from auth.users u
where p.id = u.id
  and u.email = 'jankoniuszko@interia.pl'
  and p.trial_ends_at < now()
  and p.stripe_subscription_id is null;
*/

commit;

-- Weryfikacja:
-- select u.email, p.trial_ends_at, p.plan from auth.users u join profiles p on p.id = u.id where u.email = 'cityplacebistro@gmail.com';
