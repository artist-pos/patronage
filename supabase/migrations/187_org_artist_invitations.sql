-- 187 — Organisation artist invitations
--
-- A regional arts body already holds the list Patronage is trying to build.
-- Creative Waikato knows every artist in the Waikato. An invitation that comes
-- from them converts in a way a cold email from us never will, because the
-- artist already knows and trusts the sender and the ask is small.
--
-- This is acquisition, not representation. Nothing here claims an artist on
-- behalf of the inviting organisation: a regional arts body's relationship to
-- artists is geographic, and the invited artist appears on their region's page
-- because of where they work, not because anyone listed them. The only lasting
-- record is attribution, which is what lets us tell the next regional body how
-- many artists the last one brought.
--
-- Rosters are the separate thing, and only galleries and residencies get one
-- (184, 186).

-- ── Batches ─────────────────────────────────────────────────────────────────
-- One row per upload. Kept because the org needs to see what a given file did,
-- and because "186 invited, 12 already here" is a number they should be able to
-- look up again rather than remember from a toast.

create table if not exists public.artist_invite_batches (
  id               uuid primary key default gen_random_uuid(),
  org_profile_id   uuid not null references public.profiles(id) on delete cascade,
  -- Who clicked upload. Distinct from the organisation, which is what the
  -- invitation is attributed to.
  created_by       uuid not null references public.profiles(id) on delete set null,
  filename         text,
  -- Counts as shown in the preview the org confirmed, so the record matches
  -- what they agreed to rather than what a later query would recompute.
  row_count        integer not null default 0,
  new_count        integer not null default 0,
  existing_count   integer not null default 0,
  invalid_count    integer not null default 0,
  sent_at          timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists artist_invite_batches_org_idx
  on public.artist_invite_batches (org_profile_id, created_at desc);

-- ── Invitations ─────────────────────────────────────────────────────────────

create table if not exists public.artist_invitations (
  id                  uuid primary key default gen_random_uuid(),
  batch_id            uuid references public.artist_invite_batches(id) on delete set null,
  org_profile_id      uuid not null references public.profiles(id) on delete cascade,
  email               text not null,
  full_name           text,
  -- Whatever the spreadsheet held. Carried into signup so the artist is not
  -- retyping what their regional body already knows.
  disciplines         text[] not null default '{}',
  city                text,
  region_id           uuid references public.regions(id) on delete set null,
  -- The secret in the invitation link.
  token               uuid not null default gen_random_uuid(),
  -- pending: created, not yet emailed. sent: emailed. opened: link followed.
  -- joined: an account exists. existing: already had an account at import, so
  -- no invitation was sent. bounced: Resend told us the address is dead.
  status              text not null default 'pending'
    check (status in ('pending', 'sent', 'opened', 'joined', 'existing', 'bounced')),
  -- Set when the address already belonged to an account at import time.
  existing_profile_id uuid references public.profiles(id) on delete set null,
  -- Set when this invitation produced an account.
  joined_profile_id   uuid references public.profiles(id) on delete set null,
  sent_at             timestamptz,
  opened_at           timestamptz,
  joined_at           timestamptz,
  created_at          timestamptz not null default now(),
  -- One live invitation per address per organisation. A second upload
  -- containing the same person updates rather than mails them again.
  unique (org_profile_id, email)
);

create unique index if not exists artist_invitations_token_idx
  on public.artist_invitations (token);
create index if not exists artist_invitations_org_status_idx
  on public.artist_invitations (org_profile_id, status);
create index if not exists artist_invitations_email_idx
  on public.artist_invitations (email);

comment on table public.artist_invitations is
  'Artists an organisation has invited onto Patronage. Attribution only: it grants the organisation no claim over the artist.';

-- ── Attribution on the resulting account ────────────────────────────────────
-- 181 records which surface produced a signup. This records which organisation
-- did, which is the number that sells the next regional body on doing the same.

alter table public.profiles
  add column if not exists invited_by_org_id uuid
    references public.profiles(id) on delete set null;

create index if not exists profiles_invited_by_org_idx
  on public.profiles (invited_by_org_id, created_at desc)
  where invited_by_org_id is not null;

comment on column public.profiles.invited_by_org_id is
  'Organisation whose invitation produced this account. Attribution for artist acquisition; confers no relationship.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Both tables are written by server actions using the service role. The only
-- read path that needs a policy is an organisation looking at its own results.

alter table public.artist_invite_batches enable row level security;
alter table public.artist_invitations   enable row level security;

drop policy if exists "Organisations read their own invite batches" on public.artist_invite_batches;
create policy "Organisations read their own invite batches"
  on public.artist_invite_batches for select
  using (org_profile_id = auth.uid());

drop policy if exists "Organisations read their own invitations" on public.artist_invitations;
create policy "Organisations read their own invitations"
  on public.artist_invitations for select
  using (org_profile_id = auth.uid());
