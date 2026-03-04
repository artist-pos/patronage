-- Migration 031: Auto-cleanup expired and rejected opportunities via pg_cron
--
-- Rejected grants are kept as a scraper block-list (status='rejected', is_active=false)
-- so they are never re-inserted on the next scrape run. This job purges them once
-- they've expired or are old enough that they won't recur.
--
-- Run in: Supabase SQL Editor

-- Enable pg_cron (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any existing schedule with this name before (re-)creating
SELECT cron.unschedule('cleanup-expired-opportunities')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-opportunities'
);

-- Daily at 03:00 UTC
SELECT cron.schedule(
  'cleanup-expired-opportunities',
  '0 3 * * *',
  $$
    DELETE FROM opportunities
    WHERE
      -- Published grants whose deadline has passed
      (status = 'published' AND deadline IS NOT NULL AND deadline < current_date)
      OR
      -- Rejected grants whose deadline has passed (no longer needed as block-list)
      (status = 'rejected' AND deadline IS NOT NULL AND deadline < current_date)
      OR
      -- Rejected grants with no deadline, older than 90 days
      (status = 'rejected' AND deadline IS NULL AND created_at < now() - interval '90 days');
  $$
);
