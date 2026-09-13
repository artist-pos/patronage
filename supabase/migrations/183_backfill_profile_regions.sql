-- 183 — Backfill profiles.region_id / city_id from the freeform location text
--
-- Runs after 182. Nothing is destructive: profiles.city keeps whatever the
-- artist typed, and rows that cannot be matched confidently are flagged with
-- location_needs_review rather than guessed at.
--
-- Matching is deliberately conservative. Three passes, each stricter about
-- what counts as a hit than a fuzzy-distance approach would be, because a
-- wrong region silently files an artist under the wrong regional page — worse
-- than leaving them unfiled where an admin can see it.

-- Macron-insensitive, punctuation-insensitive comparison key. Written as
-- translate() rather than unaccent() so the migration does not depend on an
-- extension being enabled on the project.
create or replace function public.location_key(input text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      translate(lower(trim(coalesce(input, ''))),
                'āēīōūÄĒĪŌŪàáâäèéêëìíîïòóôöùúûü',
                'aeiouAEIOUaaaaeeeeiiiioooouuuu'),
      '[^a-z0-9 ]', '', 'g'
    ),
    ''
  );
$$;

comment on function public.location_key(text) is
  'Normalises a location string for comparison: lowercased, macrons folded, punctuation stripped.';

-- ── Pass 1: exact match on city name, te reo name, or a declared alias ───────

with candidate as (
  select
    c.id          as city_id,
    c.region_id   as region_id,
    c.is_major    as is_major,
    k.key         as key
  from public.cities c
  cross join lateral (
    select public.location_key(c.name) as key
    union
    select public.location_key(c.name_maori) where c.name_maori is not null
    union
    select public.location_key(a) from unnest(c.aliases) as a
  ) k
  where k.key is not null
),
-- An alias shared by two towns resolves to the larger one rather than at random.
ranked as (
  select distinct on (key) key, city_id, region_id
  from candidate
  order by key, is_major desc, city_id
)
update public.profiles p
set region_id = r.region_id,
    city_id   = r.city_id,
    location_needs_review = false
from ranked r
where p.city_id is null
  and public.location_key(p.city) = r.key;

-- ── Pass 2: "City, Country" and "Suburb, City" forms ────────────────────────
-- Splits on the comma and retries each fragment. Covers the common
-- "Auckland, New Zealand" and "Grey Lynn, Auckland" shapes.

with candidate as (
  select
    c.id          as city_id,
    c.region_id   as region_id,
    c.is_major    as is_major,
    k.key         as key
  from public.cities c
  cross join lateral (
    select public.location_key(c.name) as key
    union
    select public.location_key(c.name_maori) where c.name_maori is not null
    union
    select public.location_key(a) from unnest(c.aliases) as a
  ) k
  where k.key is not null
),
ranked as (
  select distinct on (key) key, city_id, region_id
  from candidate
  order by key, is_major desc, city_id
),
fragments as (
  select p.id as profile_id,
         public.location_key(f.fragment) as key,
         f.ordinality as position
  from public.profiles p
  cross join lateral unnest(string_to_array(p.city, ',')) with ordinality as f(fragment, ordinality)
  where p.city_id is null and p.city is not null
),
-- Earliest fragment that matches wins: "Grey Lynn, Auckland" should land on
-- Auckland, and "Auckland, New Zealand" also lands on Auckland.
best as (
  select distinct on (fr.profile_id) fr.profile_id, rk.city_id, rk.region_id
  from fragments fr
  join ranked rk on rk.key = fr.key
  order by fr.profile_id, fr.position
)
update public.profiles p
set region_id = b.region_id,
    city_id   = b.city_id,
    location_needs_review = false
from best b
where p.id = b.profile_id
  and p.city_id is null;

-- ── Pass 3: the text names a region but no city we hold ─────────────────────
-- e.g. "Waikato" or "Hawke's Bay". Region is set, city stays null.

with region_keys as (
  select r.id as region_id, k.key
  from public.regions r
  cross join lateral (
    select public.location_key(r.name) as key
    union
    select public.location_key(r.name_maori) where r.name_maori is not null
  ) k
  where k.key is not null
)
update public.profiles p
set region_id = rk.region_id,
    location_needs_review = false
from region_keys rk
where p.region_id is null
  and p.city is not null
  and public.location_key(p.city) = rk.key;

-- ── Flag the remainder for manual review ────────────────────────────────────
-- Someone who wrote "Berlin", "based between Auckland and Melbourne", or left
-- it blank. The text is untouched; an admin decides.
--
-- Scoped to people who plausibly live here. The taxonomy is NZ-only, so an
-- artist in São Paulo or South Hedland has nothing wrong with their location
-- and must not land in an admin queue implying they do. Null country is
-- included because it is unset, not foreign.

update public.profiles
set location_needs_review = true
where region_id is null
  and city is not null
  and public.location_key(city) is not null
  and (country is null or country = 'NZ');
