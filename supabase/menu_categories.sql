-- Add menu categories + translations storage to profiles
-- Run once in Supabase SQL Editor.

alter table public.profiles
  add column if not exists menu_categories text[] not null default '{}';

alter table public.profiles
  add column if not exists menu_category_translations jsonb not null default '{}'::jsonb;

