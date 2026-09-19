-- Kampanie e-mail Klubu gości Premium. Uruchom w Supabase → SQL Editor
-- (po supabase/promo_leads.sql). Nie miesza się z kodami Verify.

begin;

create table if not exists public.guest_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  template_type text not null,
  subject text not null,
  headline text not null,
  message text not null default '',
  offer_text text null,
  valid_from text null,
  valid_until text null,
  dish_id uuid null references public.dishes (id) on delete set null,
  cta_label text not null default 'Zobacz w menu',
  cta_url text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sending', 'sent', 'failed')),
  recipient_count integer not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.guest_campaigns is
  'Jednorazowe kampanie e-mail do potwierdzonych członków Klubu gości Premium.';

create index if not exists guest_campaigns_user_created_idx
  on public.guest_campaigns (user_id, created_at desc);

create table if not exists public.guest_campaign_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.guest_campaigns (id) on delete cascade,
  lead_id uuid not null references public.promo_leads (id) on delete cascade,
  email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  error text null,
  created_at timestamptz not null default now(),
  sent_at timestamptz null
);

comment on table public.guest_campaign_deliveries is
  'Log wysyłki per kontakt. Open/click tracking celowo pominięte w MVP.';

create unique index if not exists guest_campaign_deliveries_campaign_lead_uidx
  on public.guest_campaign_deliveries (campaign_id, lead_id);

create index if not exists guest_campaign_deliveries_campaign_status_idx
  on public.guest_campaign_deliveries (campaign_id, status);

alter table public.guest_campaigns enable row level security;
alter table public.guest_campaign_deliveries enable row level security;

drop policy if exists "guest_campaigns_select_own" on public.guest_campaigns;
create policy "guest_campaigns_select_own"
  on public.guest_campaigns
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Insert/update/send wyłącznie przez API + service role.

drop policy if exists "guest_campaign_deliveries_select_own" on public.guest_campaign_deliveries;
create policy "guest_campaign_deliveries_select_own"
  on public.guest_campaign_deliveries
  for select
  to authenticated
  using (
    exists (
      select 1 from public.guest_campaigns c
      where c.id = campaign_id
        and c.user_id = auth.uid()
    )
  );

commit;
