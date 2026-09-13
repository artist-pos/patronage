-- 184 — Functional organisation categories
--
-- profiles.organisation_type is left exactly as it is. It answers the legal
-- question (charity vs business), and charity verification plus the donation
-- CTA read it directly — widening it would mean auditing every one of those
-- branches for something that is really a different question.
--
-- This adds the functional axis alongside it: what the organisation actually
-- does. The two are orthogonal. A gallery can be a registered charity; a
-- council cannot. Creative Waikato is both a charity and a regional arts body
-- and now has an honest value for each.

alter table public.profiles
  add column if not exists org_category text
    check (org_category is null or org_category in (
      'regional_arts_org',
      'gallery',
      'residency',
      'council',
      'developer',
      'corporate'
    ));

comment on column public.profiles.org_category is
  'What a partner organisation does: regional_arts_org | gallery | residency | council | developer | corporate. Orthogonal to organisation_type, which records legal status (charity/business) and gates donations.';

-- Backfill the one value that was already functional rather than legal.
-- organisation_type is deliberately not cleared: existing rows keep it, and
-- the partner UI simply stops offering "gallery" on the legal axis from here.
update public.profiles
set org_category = 'gallery'
where role = 'partner'
  and org_category is null
  and organisation_type = 'gallery';

-- Regional pages look up the anchor organisation and any galleries by region.
create index if not exists profiles_org_category_region_idx
  on public.profiles (org_category, region_id)
  where org_category is not null and is_active = true;

-- ── Gallery representation ───────────────────────────────────────────────────
--
-- Galleries represent artists through the existing collectives tables rather
-- than a new join table: invitation, acceptance and revocation already work
-- there, and consent is the part that matters. An artist must accept before a
-- gallery can list them.

alter table public.collectives
  -- The partner profile this collective belongs to. created_by records who
  -- clicked the button; this records whose roster it is, which survives an
  -- admin creating it on a gallery's behalf.
  add column if not exists org_profile_id uuid
    references public.profiles(id) on delete cascade,
  -- What the membership claims. Galleries and studio programmes mean different
  -- things by it, and artists care which one is shown next to their name.
  add column if not exists relationship text not null default 'member'
    check (relationship in ('member', 'represented', 'shows_with')),
  -- Artist-run collectives stay private to their members, as today. A gallery
  -- roster is the point of the feature, so it opts in.
  add column if not exists is_public boolean not null default false;

comment on column public.collectives.org_profile_id is
  'Partner profile whose roster this is. Null for artist-run collectives.';
comment on column public.collectives.relationship is
  'What membership claims: member | represented | shows_with.';
comment on column public.collectives.is_public is
  'When true, accepted members are readable by anyone. Gallery rosters set this; artist-run collectives do not.';

create index if not exists collectives_org_profile_idx
  on public.collectives (org_profile_id)
  where org_profile_id is not null;

-- Public rosters need a read path. The existing policy only lets you see
-- memberships you are part of, which would make a gallery's roster render
-- empty for every visitor.
--
-- Accepted members only: a pending invitation is not a claim the gallery gets
-- to publish. Migration 083 added the status column.
drop policy if exists "Accepted members of public collectives are readable" on public.collective_members;
create policy "Accepted members of public collectives are readable"
  on public.collective_members for select
  using (
    status = 'accepted'
    and collective_id in (select id from public.collectives where is_public = true)
  );

-- Only the owning organisation may manage a roster, and only galleries may
-- have one. Councils, developers and corporates commission artists rather than
-- representing them, and a regional arts body serves everyone in its region
-- without claiming anyone, so none of them get a roster at all.
--
-- Residency and studio programmes are deliberately excluded for now: they
-- select artists through an application round, which the opportunity system
-- already covers. Whether a past-residents list is representation is a product
-- question, not a schema one.
drop policy if exists "Organisations manage their own roster" on public.collectives;
create policy "Organisations manage their own roster"
  on public.collectives for all
  using (
    org_profile_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'partner'
        and p.org_category = 'gallery'
    )
  );
