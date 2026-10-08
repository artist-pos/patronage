-- 201 — Art societies and clubs
--
-- A new organisation category whose roster is its members. Relationship 'member'
-- is already allowed on collectives (184/186). Like a gallery or residency roster,
-- every entry still has to be accepted by the artist before it shows anywhere.

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
      'council',
      'developer',
      'corporate'
    ));

comment on column public.profiles.org_category is
  'What a partner organisation does: regional_arts_org | local_board_arts_org | gallery | residency | art_society | council | developer | corporate. Orthogonal to organisation_type, which records legal status (charity/business) and gates donations.';

drop policy if exists "Organisations manage their own roster" on public.collectives;
create policy "Organisations manage their own roster"
  on public.collectives for all
  using (
    org_profile_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'partner'
        and p.org_category in ('gallery', 'residency', 'art_society')
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
        )
    )
  );
