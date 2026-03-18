-- Migration 058: Recurring opportunities
--
-- Adds recurrence fields to opportunities, a cycle log table, and a pg_cron job
-- that auto-advances deadlines rather than deleting recurring opportunities.

-- ── New columns ──────────────────────────────────────────────────────────────

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS is_recurring       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_pattern text
    CHECK (recurrence_pattern IN ('monthly','bimonthly','quarterly','biannual','annual','custom')),
  ADD COLUMN IF NOT EXISTS recurrence_open_day  integer CHECK (recurrence_open_day  BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS recurrence_close_day integer CHECK (recurrence_close_day BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS recurrence_end_date  date;

-- ── Audit log ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recurring_cycle_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  pattern         text NOT NULL,
  previous_opens_at  date,
  previous_deadline  date,
  new_opens_at    date,
  new_deadline    date,
  cycled_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recurring_cycle_log ENABLE ROW LEVEL SECURITY;

-- Admins and owners can read; no one can write from client (pg_cron writes directly)
CREATE POLICY "Admin can view cycle log"
  ON recurring_cycle_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- ── Update cleanup cron to skip recurring opportunities ──────────────────────

SELECT cron.unschedule('cleanup-expired-opportunities')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-opportunities'
);

SELECT cron.schedule(
  'cleanup-expired-opportunities',
  '0 3 * * *',
  $$
    DELETE FROM opportunities
    WHERE
      -- Published non-recurring opportunities whose deadline has passed
      (status = 'published' AND deadline IS NOT NULL AND deadline < current_date
        AND (is_recurring = false OR is_recurring IS NULL))
      OR
      -- Rejected grants whose deadline has passed
      (status = 'rejected' AND deadline IS NOT NULL AND deadline < current_date)
      OR
      -- Rejected grants with no deadline, older than 90 days
      (status = 'rejected' AND deadline IS NULL AND created_at < now() - interval '90 days');
  $$
);

-- ── Auto-advance recurring opportunities ─────────────────────────────────────
-- Runs daily at 03:05 UTC (after cleanup), finds recurring opps whose deadline
-- just passed, advances opens_at + deadline by the pattern interval, and logs.

SELECT cron.unschedule('advance-recurring-opportunities')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'advance-recurring-opportunities'
);

SELECT cron.schedule(
  'advance-recurring-opportunities',
  '5 3 * * *',
  $$
    WITH to_advance AS (
      SELECT
        id,
        recurrence_pattern,
        opens_at,
        deadline,
        CASE recurrence_pattern
          WHEN 'monthly'   THEN interval '1 month'
          WHEN 'bimonthly' THEN interval '2 months'
          WHEN 'quarterly' THEN interval '3 months'
          WHEN 'biannual'  THEN interval '6 months'
          WHEN 'annual'    THEN interval '12 months'
        END AS step
      FROM opportunities
      WHERE
        is_recurring = true
        AND is_active = true
        AND status = 'published'
        AND recurrence_pattern IS NOT NULL
        AND recurrence_pattern != 'custom'
        AND deadline IS NOT NULL
        AND deadline < current_date
        AND (recurrence_end_date IS NULL OR recurrence_end_date > current_date)
    ),
    updated AS (
      UPDATE opportunities o
      SET
        opens_at = (ta.opens_at + ta.step)::date,
        deadline = (ta.deadline + ta.step)::date
      FROM to_advance ta
      WHERE o.id = ta.id
      RETURNING
        o.id,
        ta.recurrence_pattern  AS pattern,
        ta.opens_at            AS previous_opens_at,
        ta.deadline            AS previous_deadline,
        o.opens_at             AS new_opens_at,
        o.deadline             AS new_deadline
    )
    INSERT INTO recurring_cycle_log
      (opportunity_id, pattern, previous_opens_at, previous_deadline, new_opens_at, new_deadline)
    SELECT id, pattern, previous_opens_at, previous_deadline, new_opens_at, new_deadline
    FROM updated;
  $$
);
