create table grants (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  organiser text,
  amount_cents integer,
  currency text default 'NZD',
  year integer,
  notes text,
  opportunity_id uuid references opportunities(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  created_at timestamptz default now()
);
create index on grants(profile_id);
alter table grants enable row level security;
create policy "Owner can manage own grants"
  on grants for all using (auth.uid() = profile_id);
create policy "Public can view grants"
  on grants for select using (true);
