-- Add scheduler fields to outreach_emails
alter table outreach_emails
  add column if not exists status text not null default 'sent'
    check (status in ('scheduled', 'sent', 'failed')),
  add column if not exists scheduled_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  alter column sent_at drop not null,
  alter column sent_at set default null;

-- sent_at is only set once the email is actually delivered
-- scheduled_at is the requested send time (NZ-local converted to UTC)
