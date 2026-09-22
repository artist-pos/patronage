-- 194 — Local board arts brokers
--
-- Auckland's 21 local boards each fund community arts and often have an
-- arts adviser/broker. Te Taumata Toi-a-Iwi (184) already anchors the whole
-- Auckland region as a 'regional_arts_org'. This adds a second, narrower
-- kind of organisation profile — one per local board — without touching that
-- region-level anchor.
--
-- A new category rather than reusing 'regional_arts_org' with local_board_id
-- set: region-coverage.ts picks a single organisation to anchor each region
-- by org_category + region_id, and a board broker sharing that category would
-- collide with Te Taumata for the same region_id.

alter table public.profiles
  drop constraint if exists profiles_org_category_check;

alter table public.profiles
  add constraint profiles_org_category_check
    check (org_category is null or org_category in (
      'regional_arts_org',
      'local_board_arts_org',
      'gallery',
      'residency',
      'council',
      'developer',
      'corporate'
    ));

comment on column public.profiles.org_category is
  'What a partner organisation does: regional_arts_org | local_board_arts_org | gallery | residency | council | developer | corporate. Orthogonal to organisation_type, which records legal status (charity/business) and gates donations.';

-- An invited artist inherits the inviting organisation's board the same way
-- they already inherit its region (187).
alter table public.artist_invitations
  add column if not exists local_board_id uuid
    references public.local_boards(id) on delete set null;

comment on column public.artist_invitations.local_board_id is
  'The inviting organisation''s own local_board_id at send time, carried onto the new artist profile at signup alongside region_id.';
