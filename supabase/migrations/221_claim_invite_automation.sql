-- 221 — Automated claim invites
--
-- The daily claim-invite cron emails organisers whose listing we aggregated and
-- nobody has claimed. Two things it needs. Run manually in the Supabase SQL Editor.

-- Anyone who says "don't email me again" lands here, and no claim invite
-- (automated or by hand) is sent to them. Keyed by lower-cased address.
create table if not exists public.claim_invite_optouts (
  email       text primary key,
  created_at  timestamptz not null default now(),
  -- The listing's claim token they clicked from, for our own reference.
  source_token uuid
);

alter table public.claim_invite_optouts enable row level security;

comment on table public.claim_invite_optouts is
  'Addresses that declined claim invites via the link in the email. Checked before every send.';

-- Tells a cron-sent invite from one an admin sent by hand.
alter table public.opportunities
  add column if not exists claim_invite_auto boolean not null default false;

comment on column public.opportunities.claim_invite_auto is
  'True when the claim invite was sent by the daily cron rather than an admin.';
