-- 220 — Weekly "your profile was viewed" email
--
-- Opt-out for the Monday email telling an artist how many people viewed their
-- profile. Run manually in the Supabase SQL Editor.

alter table public.profiles
  add column if not exists profile_view_emails boolean not null default true;

comment on column public.profiles.profile_view_emails is
  'Email me weekly when my profile has been viewed. Turned off by /unsubscribe?list=views or the settings toggle.';
