-- Migration 071: Application status audit log + opportunity collaborators
-- Run this in the Supabase SQL Editor

-- ── Application status log ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS application_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES opportunity_applications(id) ON DELETE CASCADE NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_status_log_app ON application_status_log(application_id);
CREATE INDEX IF NOT EXISTS idx_status_log_changed_at ON application_status_log(changed_at);

ALTER TABLE application_status_log ENABLE ROW LEVEL SECURITY;

-- Partners and admins can read logs for opportunities they own/manage
CREATE POLICY "Partners can read logs for their applications"
  ON application_status_log FOR SELECT
  USING (
    application_id IN (
      SELECT oa.id FROM opportunity_applications oa
      JOIN opportunities o ON o.id = oa.opportunity_id
      WHERE o.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Only service role can insert (done via admin client in server action)
-- No INSERT policy needed for RLS — admin client bypasses RLS
