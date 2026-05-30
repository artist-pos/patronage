alter table outreach_emails
  add column if not exists cc_emails text[] not null default '{}';
