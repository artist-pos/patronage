-- Migration 197: pipeline audit fixes (Oct 2026)
-- Run manually in the Supabase SQL Editor. Safe to re-run.
--
--   1. notification_queue (migration 145 was never applied in production) + fix
--      its INSERT policy, which compared a column to itself.
--   2. notification_ledger  — one row per (application, notification type) actually
--      sent, unique, so the same outcome email can never go out twice.
--   3. opportunities.archived_at — finished opportunities are archived, not deleted.
--   4. protect_opportunity_columns trigger — partners can no longer set status,
--      pipeline_paid_at, is_featured etc. directly.

-- ── 1. notification_queue ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_queue (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id    uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  application_id    uuid        NOT NULL REFERENCES opportunity_applications(id) ON DELETE CASCADE,
  recipient_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type text        NOT NULL CHECK (notification_type IN ('shortlisted', 'rejected', 'selected', 'approved_pending_assets')),
  email_subject     text,
  email_body        text,
  status            text        NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'cancelled')),
  created_by        uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  sent_at           timestamptz
);

CREATE INDEX IF NOT EXISTS notification_queue_opportunity_id_idx ON notification_queue (opportunity_id);
CREATE INDEX IF NOT EXISTS notification_queue_status_idx         ON notification_queue (opportunity_id, status);
CREATE INDEX IF NOT EXISTS notification_queue_application_idx    ON notification_queue (application_id, status);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_queue_select" ON notification_queue;
CREATE POLICY "notification_queue_select" ON notification_queue FOR SELECT USING (
  EXISTS (SELECT 1 FROM opportunities o WHERE o.id = notification_queue.opportunity_id AND o.profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM opportunity_collaborators c WHERE c.opportunity_id = notification_queue.opportunity_id AND c.profile_id = auth.uid() AND c.role = 'editor')
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner'))
);

DROP POLICY IF EXISTS "notification_queue_insert" ON notification_queue;
CREATE POLICY "notification_queue_insert" ON notification_queue FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM opportunities o WHERE o.id = notification_queue.opportunity_id AND o.profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM opportunity_collaborators c WHERE c.opportunity_id = notification_queue.opportunity_id AND c.profile_id = auth.uid() AND c.role = 'editor')
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner'))
);

DROP POLICY IF EXISTS "notification_queue_update" ON notification_queue;
CREATE POLICY "notification_queue_update" ON notification_queue FOR UPDATE USING (
  EXISTS (SELECT 1 FROM opportunities o WHERE o.id = notification_queue.opportunity_id AND o.profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM opportunity_collaborators c WHERE c.opportunity_id = notification_queue.opportunity_id AND c.profile_id = auth.uid() AND c.role = 'editor')
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner'))
);

-- ── 2. notification_ledger ───────────────────────────────────────────────────
-- Written with the admin client only (RLS on, no policies = no client access).
CREATE TABLE IF NOT EXISTS notification_ledger (
  application_id    uuid        NOT NULL REFERENCES opportunity_applications(id) ON DELETE CASCADE,
  notification_type text        NOT NULL,
  sent_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (application_id, notification_type)
);
ALTER TABLE notification_ledger ENABLE ROW LEVEL SECURITY;

-- ── 3. archive ───────────────────────────────────────────────────────────────
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS opportunities_archived_at_idx ON opportunities (archived_at) WHERE archived_at IS NOT NULL;

-- ── 4. protect sensitive opportunity columns ─────────────────────────────────
-- The owner UPDATE policy (025) has no column limits, so a partner could set
-- status = 'published' or pipeline_paid_at themselves. Service-role calls
-- (auth.uid() IS NULL) and admins are unrestricted.
CREATE OR REPLACE FUNCTION protect_opportunity_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();
  IF caller_role IN ('admin', 'owner') THEN
    RETURN NEW;
  END IF;

  IF NEW.pipeline_paid_at IS DISTINCT FROM OLD.pipeline_paid_at THEN
    RAISE EXCEPTION 'pipeline_paid_at can only be set by Patronage';
  END IF;
  IF NEW.is_featured IS DISTINCT FROM OLD.is_featured THEN
    RAISE EXCEPTION 'is_featured can only be set by Patronage';
  END IF;
  IF NEW.featured_until IS DISTINCT FROM OLD.featured_until THEN
    RAISE EXCEPTION 'featured_until can only be set by Patronage';
  END IF;
  IF NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
    RAISE EXCEPTION 'profile_id cannot be changed';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status IN ('draft', 'draft_unclaimed') AND NEW.status = 'pending')
      OR (OLD.status = 'draft' AND NEW.status = 'published' AND NEW.routing_type = 'external')
      OR (OLD.status = 'published' AND NEW.status = 'unlisted')
      OR (OLD.status = 'unlisted' AND NEW.status = 'published')
    ) THEN
      RAISE EXCEPTION 'status cannot be changed from % to % by the listing owner', OLD.status, NEW.status;
    END IF;
  END IF;

  IF NEW.is_active AND NOT COALESCE(OLD.is_active, false) AND NEW.status <> 'published' THEN
    RAISE EXCEPTION 'only published listings can be active';
  END IF;

  IF NEW.routing_type IS DISTINCT FROM OLD.routing_type AND OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'routing_type can only change while the listing is a draft';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_opportunity_columns_trg ON opportunities;
CREATE TRIGGER protect_opportunity_columns_trg
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION protect_opportunity_columns();

-- ── 5. status history visible to editor collaborators ────────────────────────
-- 071 only let the listing owner and admins read application_status_log, so a
-- committee editor saw an empty Activity tab.
DROP POLICY IF EXISTS "Collaborators can read logs for their applications" ON application_status_log;
CREATE POLICY "Collaborators can read logs for their applications"
  ON application_status_log FOR SELECT
  USING (
    application_id IN (
      SELECT oa.id FROM opportunity_applications oa
      JOIN opportunity_collaborators c ON c.opportunity_id = oa.opportunity_id
      WHERE c.profile_id = auth.uid()
    )
  );
