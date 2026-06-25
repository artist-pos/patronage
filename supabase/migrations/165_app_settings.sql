-- Global key/value settings, readable by everyone, writable only via the
-- service-role (admin) client. First use: how many "Works for sale" tiles to
-- show on /support.

create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

-- Anyone can read settings (they drive public page rendering).
drop policy if exists "app_settings public read" on app_settings;
create policy "app_settings public read" on app_settings
  for select using (true);

-- No insert/update/delete policy: normal users can't write. The admin client
-- (SUPABASE_SERVICE_ROLE_KEY) bypasses RLS for the save action.

insert into app_settings (key, value)
values ('support_works_limit', '12'::jsonb)
on conflict (key) do nothing;
