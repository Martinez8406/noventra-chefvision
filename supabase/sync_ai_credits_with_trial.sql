-- Jednorazowo: wyrównaj legacy ai_credits do trial_tokens (źródło prawdy dla trial).
-- Uruchom w Supabase → SQL Editor.

update public.profiles
set ai_credits = trial_tokens
where plan = 'trial' or subscription_status = 'trial';
