-- 185 — One mailing list
--
-- Two tables have been claiming the same people. Every artist was copied into
-- `subscribers` by a trigger, while `profiles.weekly_digest` recorded the same
-- intent separately, and the two drifted: one profile was flagged as
-- subscribed while absent from the list, six were on the list while flagged
-- off. Sending read the list, the settings toggle wrote to both, and the
-- unsubscribe link wrote only to the list.
--
-- After this migration:
--   profiles.weekly_digest  — the only truth for anyone with an account
--   subscribers             — only emails belonging to nobody (home page capture)
--
-- Subscribers cannot simply be folded into profiles: profiles.id is a foreign
-- key to auth.users and username is unique and not null, so an address with no
-- account has nowhere to live there. Fabricating accounts for them would put
-- ghosts in the artists directory, which is worse than keeping a small table.

-- ── Unsubscribe token on profiles ───────────────────────────────────────────
-- An account holder clicking unsubscribe in an email is not signed in, so the
-- link needs a secret that identifies them without a session. Subscribers have
-- had one since 088; profiles never needed one while sending read the list.

alter table public.profiles
  add column if not exists digest_unsubscribe_token uuid;

update public.profiles
set digest_unsubscribe_token = gen_random_uuid()
where digest_unsubscribe_token is null;

alter table public.profiles
  alter column digest_unsubscribe_token set default gen_random_uuid(),
  alter column digest_unsubscribe_token set not null;

create unique index if not exists profiles_digest_unsubscribe_token_idx
  on public.profiles (digest_unsubscribe_token);

comment on column public.profiles.digest_unsubscribe_token is
  'Secret in the digest footer link. Lets a signed-out account holder unsubscribe without exposing their id.';

-- ── Reconcile intent before profiles becomes authoritative ──────────────────
-- `subscribers` is what actually received mail up to now, so it is the honest
-- record of consent. Copying it onto the flag preserves today's behaviour
-- exactly. Without this step everyone who ever used the unsubscribe link
-- starts receiving the digest again, because that link never touched the flag.

update public.profiles p
set weekly_digest = exists (
  select 1 from public.subscribers s
  where s.email = lower(trim(p.email))
)
where p.email is not null;

-- Profiles with no email cannot be mailed at all; do not leave them flagged on.
update public.profiles
set weekly_digest = false
where email is null and weekly_digest;

-- ── Stop the duplication at the source ──────────────────────────────────────

drop trigger if exists trg_artist_subscriber_sync on public.profiles;
drop function if exists public.sync_artist_to_subscribers();

-- Anyone with an account is now represented by their profile. Removing their
-- duplicate row is what stops the two lists drifting again, and what stops a
-- send addressing the same person twice.
delete from public.subscribers s
using public.profiles p
where p.email is not null
  and lower(trim(p.email)) = s.email;

comment on table public.subscribers is
  'Email addresses with no Patronage account, captured from the home page form. Account holders live in profiles.weekly_digest instead.';

-- ── Send log ────────────────────────────────────────────────────────────────
-- Two jobs. It anchors "listed since the last digest", which previously had
-- nothing to measure against. And it lets a send skip what a given person has
-- already been shown, which is the current digest's real quality problem:
-- selection is deadline-first and deterministic, so the same listings resurface
-- week after week until they close.

create table if not exists public.digest_sends (
  id                uuid primary key default gen_random_uuid(),
  sent_at           timestamptz not null default now(),
  -- 'cron' | 'manual' | 'welcome'
  trigger           text not null,
  recipient_count   integer not null default 0,
  opportunity_count integer not null default 0
);

create index if not exists digest_sends_sent_at_idx
  on public.digest_sends (sent_at desc);

comment on table public.digest_sends is
  'One row per digest run. The newest cron/manual row is the anchor for "new since last digest".';

create table if not exists public.digest_items (
  id             uuid primary key default gen_random_uuid(),
  send_id        uuid not null references public.digest_sends(id) on delete cascade,
  -- Keyed by address rather than profile id so the same table covers account
  -- holders and the handful of subscribers who have no profile.
  email          text not null,
  profile_id     uuid references public.profiles(id) on delete set null,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  created_at     timestamptz not null default now()
);

-- The suppression lookup: everything this address has been sent recently.
create index if not exists digest_items_email_created_idx
  on public.digest_items (email, created_at desc);
create index if not exists digest_items_send_idx
  on public.digest_items (send_id);

comment on table public.digest_items is
  'Which listings went to which address. Read back to avoid repeating a listing to the same person.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Nothing here is public. Both tables are written by the send job and read by
-- admin screens, both of which use the service role and bypass RLS. Enabling
-- it with no policy is the deny-by-default we want.

alter table public.digest_sends enable row level security;
alter table public.digest_items enable row level security;
