-- Event tips (Explore > Events card). Anyone can point us at an event; people
-- with a profile can post their own as a studio update instead. Tips go to the
-- admin list at /admin/event-tips and are added by hand.
--
-- Written only by the server (service role), read only by admins, so RLS is on
-- with no public policies.

create table if not exists public.event_tips (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  event_date date,
  venue text check (venue is null or char_length(venue) <= 200),
  link text check (link is null or char_length(link) <= 500),
  submitter_email text check (submitter_email is null or char_length(submitter_email) <= 254),
  status text not null default 'new' check (status in ('new', 'added', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists event_tips_status_created_idx
  on public.event_tips (status, created_at desc);

alter table public.event_tips enable row level security;
