-- Account termination survey responses.
-- Captures why a user is leaving, recorded just before their account is deleted.
--
-- NOTE: user_id is a plain uuid with NO foreign key to auth.users. If it
-- referenced auth.users with ON DELETE CASCADE, deleting the account would also
-- delete this row — defeating the purpose. We keep the id for later analysis.

create table if not exists public.termination_surveys (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  reason      text,
  details     text,
  created_at  timestamptz not null default now()
);

-- Covering index for the user_id lookups (also keeps us clear of the
-- "unindexed foreign keys" / lookup-by-user advisories).
create index if not exists termination_surveys_user_id_idx
  on public.termination_surveys (user_id);

create index if not exists termination_surveys_created_at_idx
  on public.termination_surveys (created_at desc);

alter table public.termination_surveys enable row level security;

-- A signed-in user may record their own survey response. Admin/service-role
-- access bypasses RLS for reading aggregate results.
drop policy if exists "insert own termination survey" on public.termination_surveys;
create policy "insert own termination survey"
  on public.termination_surveys
  for insert
  to authenticated
  -- (select auth.uid()) so the auth lookup runs once per query, not per row
  -- (Supabase linter 0003_auth_rls_initplan).
  with check ((select auth.uid()) = user_id);
