-- Naprawa konta: trial 50 tokenów / 14 dni (np. martinteam400@gmail.com)
-- Uruchom w Supabase → SQL Editor. Zamień e-mail na swój.

begin;

update public.profiles p
set
  plan = 'trial',
  subscription_status = 'trial',
  trial_tokens = 50,
  trial_ends_at = now() + interval '14 days',
  subscription_tokens = 0,
  stripe_subscription_id = null,
  stripe_subscription_status = null,
  ai_credits = 50,
  generations_used = 0
from auth.users u
where p.id = u.id
  and u.email = 'martinteam400@gmail.com';

commit;
