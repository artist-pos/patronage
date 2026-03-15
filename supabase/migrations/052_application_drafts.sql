create table opportunity_application_drafts (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  artist_id uuid not null references auth.users(id) on delete cascade,
  artwork_id uuid references artworks(id) on delete set null,
  submitted_image_url text,
  custom_answers jsonb default '{}',
  updated_at timestamptz default now(),
  unique (opportunity_id, artist_id)
);

alter table opportunity_application_drafts enable row level security;

create policy "Artists manage own drafts"
  on opportunity_application_drafts
  for all using (artist_id = auth.uid());
