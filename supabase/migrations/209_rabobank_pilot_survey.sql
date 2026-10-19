-- Rabobank Te Puke pilot, phase 1: access tokens, settings and the staff survey.
-- Shortlist tables follow in a later migration.
--
-- Every table has RLS enabled and no policies, so anon and authenticated
-- requests cannot read or write them through PostgREST. All access goes through
-- server code using the service-role client, after a token or admin check.

-- One row, id = 1. Dates are timestamptz (UTC); the app shows them in
-- Pacific/Auckland. 2026 Rabobank pilot defaults are seeded below.
create table if not exists public.rabobank_settings (
  id integer primary key default 1 check (id = 1),
  survey_open_at timestamptz,
  survey_close_at timestamptz,
  shortlist_open_at timestamptz,
  shortlist_close_at timestamptz,
  -- 'required' | 'optional' | 'off': whether the survey asks for a first name.
  collect_first_name text not null default 'required'
    check (collect_first_name in ('required', 'optional', 'off')),
  -- Null means the generated default for the current name setting.
  survey_intro text,
  shortlist_intro text,
  comment_summary text,
  show_raw_comments_to_client boolean not null default false,
  names_deleted_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.rabobank_settings enable row level security;

-- Survey 21 Oct 2026 (NZDT, UTC+13) to Fri 30 Oct 5pm; shortlist Mon 2 Nov to Fri 6 Nov 5pm.
-- 2026-10-21 00:00 NZDT = 2026-10-20 11:00 UTC. 17:00 NZDT = 04:00 UTC.
insert into public.rabobank_settings (id, survey_open_at, survey_close_at, shortlist_open_at, shortlist_close_at)
values (
  1,
  '2026-10-20 11:00:00+00',
  '2026-10-30 04:00:00+00',
  '2026-11-01 11:00:00+00',
  '2026-11-06 04:00:00+00'
)
on conflict (id) do nothing;

-- Unguessable links. Only a SHA-256 hash of the token is stored.
create table if not exists public.rabobank_access_token (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('survey', 'staff', 'client')),
  token_hash text not null unique,
  label text,
  expires_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.rabobank_access_token enable row level security;

create table if not exists public.rabobank_survey_response (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- A label, not a key. Nulled by the admin "delete all names" action.
  first_name text check (first_name is null or char_length(first_name) <= 60),
  q1 text check (q1 is null or char_length(q1) <= 300),
  q2 text[] not null default '{}' check (cardinality(q2) <= 2),
  q2_other text check (q2_other is null or char_length(q2_other) <= 100),
  q3 text check (q3 is null or char_length(q3) <= 500),
  q4 text check (q4 is null or char_length(q4) <= 500),
  q5 boolean,
  completion_seconds integer check (completion_seconds is null or completion_seconds >= 0)
);

alter table public.rabobank_survey_response enable row level security;

create index if not exists rabobank_survey_response_created_idx
  on public.rabobank_survey_response (created_at desc);
