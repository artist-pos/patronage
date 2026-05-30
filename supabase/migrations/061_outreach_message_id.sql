alter table outreach_emails
  add column if not exists message_id text;
