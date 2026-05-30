create table if not exists opportunity_artist_matches (
  id              uuid primary key default gen_random_uuid(),
  artist_id       uuid not null references profiles(id) on delete cascade,
  opportunity_id  uuid not null references opportunities(id) on delete cascade,
  score           integer not null check (score between 0 and 100),
  reason          text,
  scored_at       timestamptz not null default now(),
  unique (artist_id, opportunity_id)
);

create index if not exists opportunity_artist_matches_artist_score
  on opportunity_artist_matches (artist_id, score desc);

create index if not exists opportunity_artist_matches_opportunity
  on opportunity_artist_matches (opportunity_id);

alter table opportunity_artist_matches enable row level security;

-- Artists can read their own matches
create policy "artists read own matches"
  on opportunity_artist_matches for select
  using (artist_id = auth.uid());
