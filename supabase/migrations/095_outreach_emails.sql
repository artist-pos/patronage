create table if not exists outreach_emails (
  id uuid primary key default gen_random_uuid(),
  sent_by uuid references auth.users(id) on delete set null,
  to_name text not null,
  to_email text not null,
  subject text not null,
  body text not null,
  sent_at timestamptz not null default now()
);

alter table outreach_emails enable row level security;

-- Admins only (owner role) — enforced in code, RLS as belt-and-braces
create policy "admin full access" on outreach_emails
  for all using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role in ('admin', 'owner')
    )
  );
