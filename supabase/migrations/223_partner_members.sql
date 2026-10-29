-- 223: multiple owners per partner organisation.
--
-- A partner organisation (e.g. an arts society) is one profiles row
-- (role = 'partner'). Until now only that row's own login could manage it.
-- partner_members lets further people (each with their own account) manage the
-- same organisation with full owner access. There are no roles: every member is
-- an owner. The organisation's own login always has access and cannot be
-- removed, so an organisation can never end up with nobody in charge.
--
-- Existing policies are NOT rewritten. Postgres ORs permissive policies
-- together, so this migration only ADDS "members can ..." policies next to the
-- existing owner ones. Nothing changes for organisations with a single login.
--
-- Run in the Supabase SQL Editor BEFORE deploying the code that reads
-- partner_members. Safe to re-run.

-- ── 1. Table ─────────────────────────────────────────────────────────────────
create table if not exists public.partner_members (
  id          uuid        primary key default gen_random_uuid(),
  partner_id  uuid        not null references public.profiles(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  added_by    uuid        references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (partner_id, user_id),
  check (partner_id <> user_id)
);

create index if not exists partner_members_user_id_idx  on public.partner_members (user_id);
create index if not exists partner_members_added_by_idx on public.partner_members (added_by)
  where added_by is not null;

alter table public.partner_members enable row level security;

-- ── 2. Helper ────────────────────────────────────────────────────────────────
-- True when the signed-in user IS the organisation's own login or has been added
-- as a member. security definer so policies can call it without recursing into
-- partner_members' own RLS (same reason as migration 192).
create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select org is not null and (
    org = auth.uid()
    or exists (
      select 1 from public.partner_members m
      where m.partner_id = org and m.user_id = auth.uid()
    )
  );
$$;

grant execute on function public.is_org_member(uuid) to authenticated;

-- Members see who else is in their organisation, and their own memberships.
-- Adding and removing members goes through server actions (service role) after
-- the caller is verified, so there are no client write policies.
drop policy if exists "partner_members_select" on public.partner_members;
create policy "partner_members_select" on public.partner_members
  for select using (user_id = auth.uid() or public.is_org_member(partner_id));

-- ── 3. The organisation's own profile ────────────────────────────────────────
-- Members can edit the organisation's profile and settings. Limited to partner
-- profiles, and the role cannot be changed through this path.
drop policy if exists "profiles_update_org_member" on public.profiles;
create policy "profiles_update_org_member" on public.profiles
  for update
  using (role = 'partner' and public.is_org_member(id))
  with check (role = 'partner' and public.is_org_member(id));

-- ── 4. Listings ──────────────────────────────────────────────────────────────
drop policy if exists "opportunities_select_org_member" on public.opportunities;
create policy "opportunities_select_org_member" on public.opportunities
  for select using (public.is_org_member(profile_id));

drop policy if exists "opportunities_insert_org_member" on public.opportunities;
create policy "opportunities_insert_org_member" on public.opportunities
  for insert with check (public.is_org_member(profile_id));

-- The protect_opportunity_columns trigger (197) still applies: members cannot
-- set status, featured flags or payment fields, and cannot move a listing to
-- another organisation.
drop policy if exists "opportunities_update_org_member" on public.opportunities;
create policy "opportunities_update_org_member" on public.opportunities
  for update using (public.is_org_member(profile_id));

drop policy if exists "opportunities_delete_org_member" on public.opportunities;
create policy "opportunities_delete_org_member" on public.opportunities
  for delete using (public.is_org_member(profile_id));

-- ── 5. Applications and review ───────────────────────────────────────────────
drop policy if exists "applications_select_org_member" on public.opportunity_applications;
create policy "applications_select_org_member" on public.opportunity_applications
  for select using (exists (
    select 1 from public.opportunities o
    where o.id = opportunity_applications.opportunity_id and public.is_org_member(o.profile_id)
  ));

drop policy if exists "applications_update_org_member" on public.opportunity_applications;
create policy "applications_update_org_member" on public.opportunity_applications
  for update using (exists (
    select 1 from public.opportunities o
    where o.id = opportunity_applications.opportunity_id and public.is_org_member(o.profile_id)
  ));

drop policy if exists "status_log_select_org_member" on public.application_status_log;
create policy "status_log_select_org_member" on public.application_status_log
  for select using (exists (
    select 1 from public.opportunity_applications oa
    join public.opportunities o on o.id = oa.opportunity_id
    where oa.id = application_status_log.application_id and public.is_org_member(o.profile_id)
  ));

drop policy if exists "decisions_select_org_member" on public.application_decisions;
create policy "decisions_select_org_member" on public.application_decisions
  for select using (exists (
    select 1 from public.opportunities o
    where o.id = application_decisions.opportunity_id and public.is_org_member(o.profile_id)
  ));

drop policy if exists "assignments_select_org_member" on public.application_assignments;
create policy "assignments_select_org_member" on public.application_assignments
  for select using (exists (
    select 1 from public.opportunities o
    where o.id = application_assignments.opportunity_id and public.is_org_member(o.profile_id)
  ));

drop policy if exists "recusals_select_org_member" on public.application_recusals;
create policy "recusals_select_org_member" on public.application_recusals
  for select using (exists (
    select 1 from public.opportunities o
    where o.id = application_recusals.opportunity_id and public.is_org_member(o.profile_id)
  ));

drop policy if exists "scores_select_org_member" on public.application_scores;
create policy "scores_select_org_member" on public.application_scores
  for select using (exists (
    select 1 from public.opportunity_applications oa
    join public.opportunities o on o.id = oa.opportunity_id
    where oa.id = application_scores.application_id and public.is_org_member(o.profile_id)
  ));

drop policy if exists "scores_write_org_member" on public.application_scores;
create policy "scores_write_org_member" on public.application_scores
  for all
  using (exists (
    select 1 from public.opportunity_applications oa
    join public.opportunities o on o.id = oa.opportunity_id
    where oa.id = application_scores.application_id and public.is_org_member(o.profile_id)
  ))
  with check (exists (
    select 1 from public.opportunity_applications oa
    join public.opportunities o on o.id = oa.opportunity_id
    where oa.id = application_scores.application_id and public.is_org_member(o.profile_id)
  ));

drop policy if exists "rubric_org_member" on public.rubric_criteria;
create policy "rubric_org_member" on public.rubric_criteria
  for all
  using (exists (
    select 1 from public.opportunities o
    where o.id = rubric_criteria.opportunity_id and public.is_org_member(o.profile_id)
  ))
  with check (exists (
    select 1 from public.opportunities o
    where o.id = rubric_criteria.opportunity_id and public.is_org_member(o.profile_id)
  ));

drop policy if exists "notification_queue_org_member" on public.notification_queue;
create policy "notification_queue_org_member" on public.notification_queue
  for all
  using (exists (
    select 1 from public.opportunities o
    where o.id = notification_queue.opportunity_id and public.is_org_member(o.profile_id)
  ))
  with check (exists (
    select 1 from public.opportunities o
    where o.id = notification_queue.opportunity_id and public.is_org_member(o.profile_id)
  ));

drop policy if exists "partner_documents_org_member" on public.partner_documents;
create policy "partner_documents_org_member" on public.partner_documents
  for all
  using (exists (
    select 1 from public.opportunities o
    where o.id = partner_documents.opportunity_id and public.is_org_member(o.profile_id)
  ))
  with check (exists (
    select 1 from public.opportunities o
    where o.id = partner_documents.opportunity_id and public.is_org_member(o.profile_id)
  ));

drop policy if exists "opportunity_collaborators_org_member" on public.opportunity_collaborators;
create policy "opportunity_collaborators_org_member" on public.opportunity_collaborators
  for all
  using (exists (
    select 1 from public.opportunities o
    where o.id = opportunity_collaborators.opportunity_id and public.is_org_member(o.profile_id)
  ))
  with check (exists (
    select 1 from public.opportunities o
    where o.id = opportunity_collaborators.opportunity_id and public.is_org_member(o.profile_id)
  ));

-- ── 6. Campaigns linked to the organisation's listings ───────────────────────
drop policy if exists "campaigns_select_org_member" on public.campaigns;
create policy "campaigns_select_org_member" on public.campaigns
  for select using (
    public.is_org_member(partner_profile_id)
    or exists (
      select 1 from public.opportunities o
      where o.id = campaigns.opportunity_id and public.is_org_member(o.profile_id)
    )
  );

-- ── 7. Payments (receipts) ───────────────────────────────────────────────────
drop policy if exists "pep_select_org_member" on public.pipeline_entry_payments;
create policy "pep_select_org_member" on public.pipeline_entry_payments
  for select using (public.is_org_member(partner_id));

drop policy if exists "flp_select_org_member" on public.featured_listing_payments;
create policy "flp_select_org_member" on public.featured_listing_payments
  for select using (public.is_org_member(partner_id));

-- ── 8. Roster, cohorts and artist invitations ────────────────────────────────
-- Mirrors the category rules of "Organisations manage their own roster" (203).
drop policy if exists "Org members manage their roster" on public.collectives;
create policy "Org members manage their roster"
  on public.collectives for all
  using (
    public.is_org_member(org_profile_id)
    and exists (
      select 1 from public.profiles p
      where p.id = collectives.org_profile_id
        and p.role = 'partner'
        and p.org_category in ('gallery', 'residency', 'art_society', 'school')
    )
  )
  with check (
    public.is_org_member(org_profile_id)
    and exists (
      select 1 from public.profiles p
      where p.id = collectives.org_profile_id
        and p.role = 'partner'
        and (
          (p.org_category = 'gallery'     and collectives.relationship in ('represented', 'shows_with'))
          or (p.org_category = 'residency'   and collectives.relationship = 'participant')
          or (p.org_category = 'art_society' and collectives.relationship = 'member')
          or (p.org_category = 'school'      and collectives.relationship = 'participant')
        )
    )
  );

drop policy if exists "Org members manage cohorts" on public.org_cohorts;
create policy "Org members manage cohorts" on public.org_cohorts
  for all
  using (public.is_org_member(org_profile_id))
  with check (public.is_org_member(org_profile_id));

drop policy if exists "Org members read invite batches" on public.artist_invite_batches;
create policy "Org members read invite batches" on public.artist_invite_batches
  for select using (public.is_org_member(org_profile_id));

drop policy if exists "Org members read invitations" on public.artist_invitations;
create policy "Org members read invitations" on public.artist_invitations
  for select using (public.is_org_member(org_profile_id));
