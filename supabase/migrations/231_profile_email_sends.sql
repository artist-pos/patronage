-- 231 — Log of the profile before-and-after in the Monday email
--
-- The weekly "how your work was received" email can show an artist their
-- profile next to a stronger one. That block is limited so it never turns into
-- nagging: it shows for at most three weekly emails, and new artists with no
-- news yet get one first-look email, once. This table is the memory for both.
--
--   kind = 'weekly_comparison'  the before-and-after rode along on a weekly email
--   kind = 'first_look'         the one-off first email for a new artist
--
-- It replaces the day-2 / day-7 activation nudges (205). Anyone who already
-- received one of those is not sent a first-look email.
--
-- Server only. RLS is on with no policies, so only the service role reads it.
--
-- Run manually in the Supabase SQL Editor BEFORE deploying the code.
-- Additive and re-runnable.

create table if not exists public.profile_email_sends (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('weekly_comparison', 'first_look')),
  sent_at    timestamptz not null default now()
);

create index if not exists profile_email_sends_profile_idx
  on public.profile_email_sends (profile_id, kind);

alter table public.profile_email_sends enable row level security;
