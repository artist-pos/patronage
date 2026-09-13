-- 182 — NZ region + city taxonomy
--
-- Replaces the freeform profiles.city text with a structured pair of tables so
-- artists can be grouped, counted and given a regional page. The original
-- freeform value is kept: it is the only record of what a person actually
-- typed, and the auto-matcher in 183 is not trusted enough to throw it away.
--
-- Boundaries follow the 16 regional council areas. Te reo names are stored
-- alongside the English ones rather than concatenated, so a page can render
-- them separately ("Waikato" / "Te Tai Tokerau") without string surgery.

-- ── Regions ──────────────────────────────────────────────────────────────────

create table if not exists public.regions (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  name_maori  text,
  island      text not null check (island in ('north', 'south')),
  -- Fixed display order, north to south, so every region list agrees.
  sort_order  integer not null,
  created_at  timestamptz not null default now()
);

comment on table public.regions is
  'The 16 NZ regional council areas. Public read; written only by migration.';

-- ── Cities ───────────────────────────────────────────────────────────────────

create table if not exists public.cities (
  id          uuid primary key default gen_random_uuid(),
  region_id   uuid not null references public.regions(id) on delete cascade,
  slug        text not null unique,
  name        text not null,
  name_maori  text,
  -- Alternative spellings and older names the matcher should also accept
  -- (e.g. "Akl", "Palmy"). Lowercased on write by the matcher, not by a trigger.
  aliases     text[] not null default '{}',
  -- Larger centres win when two cities share an alias or a fuzzy match.
  is_major    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists cities_region_idx on public.cities (region_id);
-- Type-to-search hits this constantly; the taxonomy is small enough that a
-- plain lowered-name index outperforms trigram machinery here.
create index if not exists cities_name_lower_idx on public.cities (lower(name));

comment on table public.cities is
  'Cities and towns, each belonging to one region. Public read; written only by migration.';

-- ── Profile links ────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists region_id uuid references public.regions(id) on delete set null,
  add column if not exists city_id   uuid references public.cities(id)  on delete set null,
  -- Set when the 183 backfill could not confidently match profiles.city.
  -- Admin reviews these by hand; nothing is deleted either way.
  add column if not exists location_needs_review boolean not null default false;

comment on column public.profiles.city is
  'Original freeform location text. Retained as the source of truth for what the artist typed; city_id/region_id are the structured reading of it.';
comment on column public.profiles.location_needs_review is
  'True when the freeform city could not be auto-matched to the taxonomy.';

-- Regional pages count and list artists by region.
create index if not exists profiles_region_idx
  on public.profiles (region_id)
  where region_id is not null and is_active = true;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- The taxonomy is public reference data: everyone reads, nobody writes through
-- the API. Inserts below run as the migration role, which bypasses RLS.

alter table public.regions enable row level security;
alter table public.cities  enable row level security;

drop policy if exists "regions are publicly readable" on public.regions;
create policy "regions are publicly readable"
  on public.regions for select using (true);

drop policy if exists "cities are publicly readable" on public.cities;
create policy "cities are publicly readable"
  on public.cities for select using (true);

-- ── Seed: regions ────────────────────────────────────────────────────────────

insert into public.regions (slug, name, name_maori, island, sort_order) values
  ('northland',          'Northland',          'Te Tai Tokerau',        'north',  1),
  ('auckland',           'Auckland',           'Tāmaki Makaurau',       'north',  2),
  ('waikato',            'Waikato',            null,                    'north',  3),
  ('bay-of-plenty',      'Bay of Plenty',      'Te Moana-a-Toi',        'north',  4),
  ('gisborne',           'Gisborne',           'Tairāwhiti',            'north',  5),
  ('hawkes-bay',         'Hawke''s Bay',       'Te Matau-a-Māui',       'north',  6),
  ('taranaki',           'Taranaki',           null,                    'north',  7),
  ('manawatu-whanganui', 'Manawatū-Whanganui', null,                    'north',  8),
  ('wellington',         'Wellington',         'Te Whanganui-a-Tara',   'north',  9),
  ('tasman',             'Tasman',             null,                    'south', 10),
  ('nelson',             'Nelson',             'Whakatū',               'south', 11),
  ('marlborough',        'Marlborough',        null,                    'south', 12),
  ('west-coast',         'West Coast',         'Te Tai Poutini',        'south', 13),
  ('canterbury',         'Canterbury',         'Waitaha',               'south', 14),
  ('otago',              'Otago',              'Ōtākou',                'south', 15),
  ('southland',          'Southland',          'Murihiku',              'south', 16)
on conflict (slug) do update
  set name       = excluded.name,
      name_maori = excluded.name_maori,
      island     = excluded.island,
      sort_order = excluded.sort_order;

-- ── Seed: cities ─────────────────────────────────────────────────────────────

insert into public.cities (region_id, slug, name, name_maori, aliases, is_major)
select r.id, c.slug, c.name, c.name_maori, c.aliases, c.is_major
from (values
  -- Northland
  ('northland', 'whangarei',       'Whangārei',      'Whangārei',      array['whangarei'],            true),
  ('northland', 'kerikeri',        'Kerikeri',       null,             array[]::text[],               false),
  ('northland', 'paihia',          'Paihia',         null,             array[]::text[],               false),
  ('northland', 'dargaville',      'Dargaville',     null,             array[]::text[],               false),
  ('northland', 'kaitaia',         'Kaitaia',        'Kaitāia',        array['kaitaia'],              false),
  ('northland', 'russell',         'Russell',        'Kororāreka',     array['kororareka'],           false),

  -- Auckland
  ('auckland',  'auckland',        'Auckland',       'Tāmaki Makaurau', array['akl','tamaki makaurau','auckland city','central auckland'], true),
  ('auckland',  'manukau',         'Manukau',        null,             array['south auckland'],       true),
  ('auckland',  'north-shore',     'North Shore',    null,             array['takapuna','devonport'], true),
  ('auckland',  'waitakere',       'Waitākere',      'Waitākere',      array['waitakere','west auckland','henderson'], true),
  ('auckland',  'papakura',        'Papakura',       null,             array[]::text[],               false),
  ('auckland',  'titirangi',       'Titirangi',      null,             array[]::text[],               false),
  ('auckland',  'waiheke-island',  'Waiheke Island', null,             array['waiheke'],              false),
  ('auckland',  'pukekohe',        'Pukekohe',       null,             array[]::text[],               false),
  ('auckland',  'warkworth',       'Warkworth',      null,             array[]::text[],               false),

  -- Waikato
  ('waikato',   'hamilton',        'Hamilton',       'Kirikiriroa',    array['kirikiriroa'],          true),
  ('waikato',   'cambridge',       'Cambridge',      'Kemureti',       array['kemureti'],             false),
  ('waikato',   'te-awamutu',      'Te Awamutu',     null,             array[]::text[],               false),
  ('waikato',   'taupo',           'Taupō',          'Taupō',          array['taupo'],                true),
  ('waikato',   'matamata',        'Matamata',       null,             array[]::text[],               false),
  ('waikato',   'thames',          'Thames',         null,             array[]::text[],               false),
  ('waikato',   'raglan',          'Raglan',         'Whāingaroa',     array['whaingaroa'],           false),
  ('waikato',   'tokoroa',         'Tokoroa',        null,             array[]::text[],               false),
  ('waikato',   'huntly',          'Huntly',         'Rahui Pokeka',   array[]::text[],               false),
  ('waikato',   'coromandel',      'Coromandel',     null,             array[]::text[],               false),

  -- Bay of Plenty
  ('bay-of-plenty', 'tauranga',    'Tauranga',       null,             array[]::text[],               true),
  ('bay-of-plenty', 'rotorua',     'Rotorua',        'Te Rotorua-nui-a-Kahumatamomoe', array[]::text[], true),
  ('bay-of-plenty', 'whakatane',   'Whakatāne',      'Whakatāne',      array['whakatane'],            false),
  ('bay-of-plenty', 'te-puke',     'Te Puke',        null,             array[]::text[],               false),
  ('bay-of-plenty', 'mount-maunganui', 'Mount Maunganui', 'Mauao',     array['mt maunganui','the mount','mauao'], false),
  ('bay-of-plenty', 'opotiki',     'Ōpōtiki',        'Ōpōtiki',        array['opotiki'],              false),
  ('bay-of-plenty', 'kawerau',     'Kawerau',        null,             array[]::text[],               false),

  -- Gisborne
  ('gisborne',  'gisborne',        'Gisborne',       'Tūranga-nui-a-Kiwa', array['turanga','tairawhiti'], true),
  ('gisborne',  'ruatoria',        'Ruatōria',       'Ruatōria',       array['ruatoria'],             false),
  ('gisborne',  'tolaga-bay',      'Tolaga Bay',     'Ūawa',           array['uawa'],                 false),

  -- Hawke's Bay
  ('hawkes-bay', 'napier',         'Napier',         'Ahuriri',        array['ahuriri'],              true),
  ('hawkes-bay', 'hastings',       'Hastings',       'Heretaunga',     array['heretaunga'],           true),
  ('hawkes-bay', 'havelock-north', 'Havelock North', null,             array[]::text[],               false),
  ('hawkes-bay', 'waipukurau',     'Waipukurau',     null,             array[]::text[],               false),
  ('hawkes-bay', 'wairoa',         'Wairoa',         null,             array[]::text[],               false),

  -- Taranaki
  ('taranaki',  'new-plymouth',    'New Plymouth',   'Ngāmotu',        array['ngamotu'],              true),
  ('taranaki',  'hawera',          'Hāwera',         'Hāwera',         array['hawera'],               false),
  ('taranaki',  'stratford',       'Stratford',      null,             array[]::text[],               false),
  ('taranaki',  'inglewood',       'Inglewood',      null,             array[]::text[],               false),
  ('taranaki',  'opunake',         'Ōpunake',        'Ōpunake',        array['opunake'],              false),

  -- Manawatū-Whanganui
  ('manawatu-whanganui', 'palmerston-north', 'Palmerston North', 'Te Papa-i-Oea', array['palmy','palmerston'], true),
  ('manawatu-whanganui', 'whanganui',        'Whanganui',        null,   array['wanganui'],           true),
  ('manawatu-whanganui', 'levin',            'Levin',            'Taitoko', array[]::text[],          false),
  ('manawatu-whanganui', 'feilding',         'Feilding',         null,   array[]::text[],             false),
  ('manawatu-whanganui', 'taihape',          'Taihape',          null,   array[]::text[],             false),
  ('manawatu-whanganui', 'ohakune',          'Ohakune',          null,   array[]::text[],             false),
  ('manawatu-whanganui', 'dannevirke',       'Dannevirke',       null,   array[]::text[],             false),

  -- Wellington
  ('wellington', 'wellington',     'Wellington',     'Te Whanganui-a-Tara', array['wgtn','welly','te whanganui-a-tara'], true),
  ('wellington', 'lower-hutt',     'Lower Hutt',     'Te Awa Kairangi ki Tai', array['hutt','hutt valley'], true),
  ('wellington', 'upper-hutt',     'Upper Hutt',     'Te Awa Kairangi ki Uta', array[]::text[],       false),
  ('wellington', 'porirua',        'Porirua',        null,             array[]::text[],               true),
  ('wellington', 'kapiti-coast',   'Kāpiti Coast',   'Kāpiti',         array['kapiti','paraparaumu','waikanae'], false),
  ('wellington', 'masterton',      'Masterton',      'Whakaoriori',    array[]::text[],               false),
  ('wellington', 'martinborough',  'Martinborough',  null,             array['wairarapa'],            false),
  ('wellington', 'greytown',       'Greytown',       null,             array[]::text[],               false),

  -- Tasman
  ('tasman',    'richmond',        'Richmond',       null,             array[]::text[],               true),
  ('tasman',    'motueka',         'Motueka',        null,             array[]::text[],               false),
  ('tasman',    'takaka',          'Tākaka',         'Tākaka',         array['takaka','golden bay'],  false),
  ('tasman',    'mapua',           'Māpua',          'Māpua',          array['mapua'],                false),

  -- Nelson
  ('nelson',    'nelson',          'Nelson',         'Whakatū',        array['whakatu'],              true),

  -- Marlborough
  ('marlborough', 'blenheim',      'Blenheim',       'Waiharakeke',    array[]::text[],               true),
  ('marlborough', 'picton',        'Picton',         'Waitohi',        array[]::text[],               false),
  ('marlborough', 'renwick',       'Renwick',        null,             array[]::text[],               false),

  -- West Coast
  ('west-coast', 'greymouth',      'Greymouth',      'Māwhera',        array['mawhera'],              true),
  ('west-coast', 'hokitika',       'Hokitika',       null,             array[]::text[],               false),
  ('west-coast', 'westport',       'Westport',       'Kawatiri',       array[]::text[],               false),
  ('west-coast', 'reefton',        'Reefton',        null,             array[]::text[],               false),

  -- Canterbury
  ('canterbury', 'christchurch',   'Christchurch',   'Ōtautahi',       array['chch','otautahi','christchurch city'], true),
  ('canterbury', 'timaru',         'Timaru',         'Te Tihi-o-Maru', array[]::text[],               true),
  ('canterbury', 'ashburton',      'Ashburton',      'Hakatere',       array[]::text[],               false),
  ('canterbury', 'rangiora',       'Rangiora',       null,             array[]::text[],               false),
  ('canterbury', 'kaikoura',       'Kaikōura',       'Kaikōura',       array['kaikoura'],             false),
  ('canterbury', 'lyttelton',      'Lyttelton',      'Ōhinehou',       array[]::text[],               false),
  ('canterbury', 'akaroa',         'Akaroa',         null,             array['banks peninsula'],      false),
  ('canterbury', 'geraldine',      'Geraldine',      null,             array[]::text[],               false),

  -- Otago
  ('otago',     'dunedin',         'Dunedin',        'Ōtepoti',        array['otepoti'],              true),
  ('otago',     'queenstown',      'Queenstown',     'Tāhuna',         array['tahuna'],               true),
  ('otago',     'wanaka',          'Wānaka',         'Wānaka',         array['wanaka'],               false),
  ('otago',     'oamaru',          'Oamaru',         'Te Oha-a-Maru',  array[]::text[],               false),
  ('otago',     'alexandra',       'Alexandra',      'Areketanara',    array['central otago'],        false),
  ('otago',     'balclutha',       'Balclutha',      'Iwikatea',       array[]::text[],               false),
  ('otago',     'arrowtown',       'Arrowtown',      null,             array[]::text[],               false),

  -- Southland
  ('southland', 'invercargill',    'Invercargill',   'Waihōpai',       array['waihopai'],             true),
  ('southland', 'gore',            'Gore',           'Maruawai',       array[]::text[],               false),
  ('southland', 'te-anau',         'Te Anau',        null,             array['fiordland'],            false),
  ('southland', 'bluff',           'Bluff',          'Motupōhue',      array[]::text[],               false),
  ('southland', 'stewart-island',  'Stewart Island', 'Rakiura',        array['rakiura'],              false),
  ('southland', 'riverton',        'Riverton',       'Aparima',        array[]::text[],               false)
) as c(region_slug, slug, name, name_maori, aliases, is_major)
join public.regions r on r.slug = c.region_slug
on conflict (slug) do update
  set region_id  = excluded.region_id,
      name       = excluded.name,
      name_maori = excluded.name_maori,
      aliases    = excluded.aliases,
      is_major   = excluded.is_major;
