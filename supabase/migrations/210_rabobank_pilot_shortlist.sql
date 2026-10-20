-- Rabobank Te Puke pilot, phase 2: artist shortlist, staff reactions, event log.
-- Same access model as 209: RLS on, no policies, service-role server code only.

-- The artist card. Nothing commercial lives here, so a query for the staff
-- page cannot return a fee by accident.
create table if not exists public.rabobank_artist (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) <= 120),
  region text check (region is null or char_length(region) <= 120),
  medium text check (medium is null or char_length(medium) <= 200),
  curator_note text check (curator_note is null or char_length(curator_note) <= 800),
  website_url text check (website_url is null or char_length(website_url) <= 300),
  sort_order integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.rabobank_artist enable row level security;

-- Fee and timeline, client and admin views only.
create table if not exists public.rabobank_artist_commercial (
  artist_id uuid primary key references public.rabobank_artist(id) on delete cascade,
  fee_indicative text check (fee_indicative is null or char_length(fee_indicative) <= 200),
  timeline_indicative text check (timeline_indicative is null or char_length(timeline_indicative) <= 200)
);

alter table public.rabobank_artist_commercial enable row level security;

create table if not exists public.rabobank_work (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.rabobank_artist(id) on delete cascade,
  image_url text not null,
  thumb_url text,
  title text check (title is null or char_length(title) <= 200),
  size text check (size is null or char_length(size) <= 100),
  year text check (year is null or char_length(year) <= 20),
  medium text check (medium is null or char_length(medium) <= 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.rabobank_work enable row level security;

create index if not exists rabobank_work_artist_idx on public.rabobank_work (artist_id, sort_order);

-- One current reaction per device per artist. respondent_id is a random id kept
-- in the visitor's browser; first_name is a label, nulled by "delete all names".
create table if not exists public.rabobank_reaction (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.rabobank_artist(id) on delete cascade,
  respondent_id text not null check (char_length(respondent_id) between 16 and 64),
  first_name text check (first_name is null or char_length(first_name) <= 60),
  reaction text not null check (reaction in ('speaks', 'unsure', 'not_for_space')),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artist_id, respondent_id)
);

alter table public.rabobank_reaction enable row level security;

create table if not exists public.rabobank_event_log (
  id uuid primary key default gen_random_uuid(),
  stage text not null check (stage in (
    'brief', 'research', 'outreach', 'survey', 'shortlist', 'recommendation',
    'contracting', 'development', 'framing', 'install'
  )),
  minutes integer not null check (minutes >= 0 and minutes <= 5000),
  note text check (note is null or char_length(note) <= 1000),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.rabobank_event_log enable row level security;

-- Public bucket for shortlist artwork. Objects are served by URL; no select
-- policy is created on storage.objects for it, so the bucket cannot be listed.
insert into storage.buckets (id, name, public)
values ('rabobank-pilot', 'rabobank-pilot', true)
on conflict (id) do nothing;
