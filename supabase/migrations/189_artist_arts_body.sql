-- 189 — The arts body an artist names as theirs
--
-- A region can be served by more than one arts organisation, and the artist is
-- the one who knows which of them is theirs. This records that, and only that.
--
-- Deliberately not public. Consent is required when a claim is published about
-- a person, which is why a gallery listing an artist needs the artist to accept
-- (184, 186). This is the opposite direction and a weaker claim, but printing an
-- organisation's name on an artist's page would still associate the two in
-- public without the organisation agreeing. So it stays a preference: the artist
-- states it, the organisation can see who names it, nothing renders on a profile.
-- If it ever becomes a visible credit, that display is what needs the
-- organisation's confirmation, and this column is what it would hang off.
--
-- It does not affect regional pages at all. Those are decided by region_id, and
-- an artist appears on their region's page because of where they work.

alter table public.profiles
  add column if not exists arts_org_id uuid
    references public.profiles(id) on delete set null;

comment on column public.profiles.arts_org_id is
  'Regional arts organisation this artist names as theirs. Artist-chosen, not public, and confers no relationship. Null is the normal state.';

-- The only read is "artists who name us", scoped to one organisation.
create index if not exists profiles_arts_org_idx
  on public.profiles (arts_org_id)
  where arts_org_id is not null;
