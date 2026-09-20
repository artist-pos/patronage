-- 193 — Auckland local boards
--
-- Auckland Council's 21 local boards sit under the Auckland region, and the
-- boards' arts brokers work at that scale rather than region-wide. An artist
-- who is in Auckland can name their board, and only then. It is optional: most
-- people will not know it, and leaving it blank costs them nothing.
--
-- Structured like the region taxonomy (182): public reference data, written
-- only by migration. Nothing here is Auckland-specific in the schema, so a
-- region could gain sub-areas later without changing it — but only Auckland is
-- seeded, because that is the only place the need exists.
--
-- Not shown on public profiles. It is what an organisation with a stake in a
-- board (the Auckland arts trust, a board's arts broker) sees when it looks at
-- who works in its area.

create table if not exists public.local_boards (
  id          uuid primary key default gen_random_uuid(),
  region_id   uuid not null references public.regions(id) on delete cascade,
  slug        text not null unique,
  name        text not null,
  name_maori  text,
  created_at  timestamptz not null default now()
);

create index if not exists local_boards_region_idx on public.local_boards (region_id);

comment on table public.local_boards is
  'Sub-areas of a region (Auckland''s 21 local boards). Public read; written only by migration.';

alter table public.local_boards enable row level security;

drop policy if exists "local boards are publicly readable" on public.local_boards;
create policy "local boards are publicly readable"
  on public.local_boards for select using (true);

alter table public.profiles
  add column if not exists local_board_id uuid
    references public.local_boards(id) on delete set null;

comment on column public.profiles.local_board_id is
  'Auckland local board the artist chose, if they did. Optional and never public; must belong to the profile''s region_id.';

create index if not exists profiles_local_board_idx
  on public.profiles (local_board_id)
  where local_board_id is not null;

insert into public.local_boards (region_id, slug, name, name_maori)
select r.id, b.slug, b.name, b.name_maori
from (values
  ('albert-eden',          'Albert-Eden',           null),
  ('aotea-great-barrier',  'Aotea / Great Barrier', 'Aotea'),
  ('devonport-takapuna',   'Devonport-Takapuna',     null),
  ('franklin',             'Franklin',              null),
  ('henderson-massey',     'Henderson-Massey',      null),
  ('hibiscus-and-bays',    'Hibiscus and Bays',     null),
  ('howick',               'Howick',                null),
  ('kaipatiki',            'Kaipātiki',             'Kaipātiki'),
  ('mangere-otahuhu',      'Māngere-Ōtāhuhu',       'Māngere-Ōtāhuhu'),
  ('manurewa',             'Manurewa',              null),
  ('maungakiekie-tamaki',  'Maungakiekie-Tāmaki',   'Maungakiekie-Tāmaki'),
  ('orakei',               'Ōrākei',                'Ōrākei'),
  ('otara-papatoetoe',     'Ōtara-Papatoetoe',      'Ōtara-Papatoetoe'),
  ('papakura',             'Papakura',              null),
  ('puketapapa',           'Puketāpapa',            'Puketāpapa'),
  ('rodney',               'Rodney',                null),
  ('upper-harbour',        'Upper Harbour',         null),
  ('waiheke',              'Waiheke',               null),
  ('waitakere-ranges',     'Waitākere Ranges',      'Waitākere Ranges'),
  ('waitemata',            'Waitematā',             'Waitematā'),
  ('whau',                 'Whau',                  null)
) as b(slug, name, name_maori)
join public.regions r on r.slug = 'auckland'
on conflict (slug) do update
  set region_id  = excluded.region_id,
      name       = excluded.name,
      name_maori = excluded.name_maori;
