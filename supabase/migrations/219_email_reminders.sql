-- 219 — Email-only deadline reminders
--
-- "Remind me before this closes" on an opportunity page, no account needed.
-- Account holders are handled by saving the listing for them (218); this table
-- is for addresses that belong to nobody yet. Run manually in the Supabase SQL Editor.

create table if not exists public.email_reminders (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  opportunity_id    uuid not null references public.opportunities(id) on delete cascade,
  -- In every reminder's footer. Stops all reminders for this address.
  unsubscribe_token uuid not null default gen_random_uuid(),
  -- '7d' and/or '2d' once sent, so the daily cron never repeats a reminder.
  sent_windows      text[] not null default '{}',
  created_at        timestamptz not null default now(),
  unique (email, opportunity_id)
);

create index if not exists email_reminders_opportunity_idx
  on public.email_reminders (opportunity_id);
create unique index if not exists email_reminders_token_idx
  on public.email_reminders (unsubscribe_token);

-- Written and read by server actions and the cron (service role). Deny-by-default.
alter table public.email_reminders enable row level security;

comment on table public.email_reminders is
  'Email-only "remind me before this closes" requests from opportunity pages. Addresses with an account are saved via user_saved_opportunities instead.';
