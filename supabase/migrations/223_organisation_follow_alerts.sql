-- 223 — Follow organisations: opportunity alerts
--
-- Following an organisation (the existing follows table, 016) now means hearing
-- when it posts an opportunity. A daily cron emails each follower once per new
-- listing linked to that organisation through organiser_profile_id (195).
-- See docs/social-phase-1.md, feature 1. Run manually in the Supabase SQL Editor
-- BEFORE deploying the code that reads these columns.

-- Opt-out, separate from the digest and deadline reminders.
alter table public.profiles
  add column if not exists opportunity_alerts boolean not null default true;

comment on column public.profiles.opportunity_alerts is
  'Email me when an organisation I follow posts an opportunity. Turned off by /unsubscribe?list=alerts or the settings toggle.';

-- Set once the cron has alerted followers about a listing. Every listing that
-- exists today is marked as done, so linking organisers on old listings later
-- never sends a backlog of alerts.
alter table public.opportunities
  add column if not exists followers_alerted_at timestamptz;

update public.opportunities
set followers_alerted_at = now()
where followers_alerted_at is null;

create index if not exists opportunities_followers_alert_pending_idx
  on public.opportunities (organiser_profile_id)
  where followers_alerted_at is null and organiser_profile_id is not null;

-- In-app notification for the same alert.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'sale', 'support', 'transfer_request', 'transfer_accepted', 'note',
    'roster_invite', 'roster_accepted', 'roster_declined', 'roster_left', 'roster_removed',
    'org_opportunity'
  ));
