-- 218 — Deadline reminders for saved opportunities
--
-- Emails someone who saved an opportunity 7 days and 2 days before it closes.
-- Run manually in the Supabase SQL Editor.

-- Opt-out is separate from the weekly digest: someone can stop the digest and
-- still want to hear that a listing they saved is about to close.
alter table public.profiles
  add column if not exists deadline_reminders boolean not null default true;

comment on column public.profiles.deadline_reminders is
  'Email me before opportunities I saved close. Turned off by /unsubscribe?list=reminders.';

-- One row per reminder sent, so the daily cron never repeats itself and a
-- listing is reminded at most once per window.
create table if not exists public.deadline_reminder_sends (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  -- '7d' or '2d'
  reminder_window text not null,
  sent_at        timestamptz not null default now(),
  primary key (user_id, opportunity_id, reminder_window)
);

create index if not exists deadline_reminder_sends_sent_at_idx
  on public.deadline_reminder_sends (sent_at desc);

-- Written and read only by the cron job (service role). Deny-by-default.
alter table public.deadline_reminder_sends enable row level security;
