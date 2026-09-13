-- 186 — Residency alumni
--
-- 184 gave galleries a consented roster and deliberately left residency and
-- studio programmes out, on the grounds that a past-residents list might be a
-- different claim from representation. It is.
--
-- "Was here in 2024" is not "represents me". The artist wants the credit on a
-- CV, the residency wants to show its track record, and neither is a commercial
-- relationship. So it rides on the same collectives infrastructure — invitation,
-- acceptance, revocation all already work there — as its own relationship type
-- carrying the thing that makes it meaningful: when.

-- ── The relationship ────────────────────────────────────────────────────────

alter table public.collectives
  drop constraint if exists collectives_relationship_check;

alter table public.collectives
  add constraint collectives_relationship_check
  check (relationship in ('member', 'represented', 'shows_with', 'participant'));

comment on column public.collectives.relationship is
  'What membership claims: member (artist-run) | represented, shows_with (gallery) | participant (residency alumni).';

-- ── When ────────────────────────────────────────────────────────────────────
-- On the membership, not the roster: every artist has their own dates, and the
-- temporal element is the whole point of an alumni list. A null end_year means
-- still there, which is how a current resident differs from a past one.
--
-- Years rather than full dates. A residency is remembered and cited by year,
-- and asking for exact dates would produce guesses.

alter table public.collective_members
  add column if not exists start_year integer,
  add column if not exists end_year   integer;

alter table public.collective_members
  drop constraint if exists collective_members_years_check;

alter table public.collective_members
  add constraint collective_members_years_check
  check (
    (start_year is null or start_year between 1900 and 2200)
    and (end_year is null or end_year between 1900 and 2200)
    and (start_year is null or end_year is null or end_year >= start_year)
  );

comment on column public.collective_members.start_year is
  'Year the artist joined or arrived. Null for rosters where time is not the point, e.g. gallery representation.';
comment on column public.collective_members.end_year is
  'Year they left. Null while ongoing, which is what marks a current resident.';

-- An alumni list renders newest first.
create index if not exists collective_members_timeline_idx
  on public.collective_members (collective_id, start_year desc nulls last);

-- ── Who may keep a roster ───────────────────────────────────────────────────
-- Extends 184 to residencies, and pins each category to the claims it is
-- allowed to make. Without the WITH CHECK half, a residency could open a roster
-- and label it "represented", which is exactly the conflation 184 was avoiding.
--
-- Councils, developers and corporates still get nothing: they commission, and
-- the opportunity system already records that. A regional arts body serves
-- everyone in its region without claiming anyone.

drop policy if exists "Organisations manage their own roster" on public.collectives;
create policy "Organisations manage their own roster"
  on public.collectives for all
  using (
    org_profile_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'partner'
        and p.org_category in ('gallery', 'residency')
    )
  )
  with check (
    org_profile_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'partner'
        and (
          (p.org_category = 'gallery'   and collectives.relationship in ('represented', 'shows_with'))
          or
          (p.org_category = 'residency' and collectives.relationship = 'participant')
        )
    )
  );
