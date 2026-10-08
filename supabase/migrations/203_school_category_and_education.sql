-- 203 — Schools, and an education section on profiles
--
-- 1. A new organisation category, 'school' (secondary schools, art schools and
--    universities). Its roster is its students and alumni. It reuses the
--    'participant' relationship that residencies already use: a dated "was here,
--    2023 to 2024" record the person accepts. Under-18s are never named on a
--    public roster (migration 202 / getOrgRoster), whatever the school.
-- 2. profiles.education: the person's own education entries, for places that
--    have no Patronage page. Same shape and handling as exhibition_history.

alter table public.profiles
  add column if not exists education jsonb not null default '[]'::jsonb;

comment on column public.profiles.education is
  'Own education entries: [{ level: "Secondary"|"Tertiary"|"Short course", institution, course, start_year, end_year }]. Shown on the CV tab. Schools with a Patronage page also appear through an accepted roster entry.';

alter table public.profiles
  drop constraint if exists profiles_org_category_check;

alter table public.profiles
  add constraint profiles_org_category_check
    check (org_category is null or org_category in (
      'regional_arts_org',
      'local_board_arts_org',
      'gallery',
      'residency',
      'art_society',
      'school',
      'council',
      'developer',
      'corporate'
    ));

comment on column public.profiles.org_category is
  'What a partner organisation does: regional_arts_org | local_board_arts_org | gallery | residency | art_society | school | council | developer | corporate. Orthogonal to organisation_type, which records legal status (charity/business) and gates donations.';

drop policy if exists "Organisations manage their own roster" on public.collectives;
create policy "Organisations manage their own roster"
  on public.collectives for all
  using (
    org_profile_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'partner'
        and p.org_category in ('gallery', 'residency', 'art_society', 'school')
    )
  )
  with check (
    org_profile_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'partner'
        and (
          (p.org_category = 'gallery'     and collectives.relationship in ('represented', 'shows_with'))
          or
          (p.org_category = 'residency'   and collectives.relationship = 'participant')
          or
          (p.org_category = 'art_society' and collectives.relationship = 'member')
          or
          (p.org_category = 'school'      and collectives.relationship = 'participant')
        )
    )
  );
