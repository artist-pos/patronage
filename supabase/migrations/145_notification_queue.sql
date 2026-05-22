-- Migration 145: notification_queue
-- Decouples status changes from email delivery. Emails are rendered at queue time
-- and held until the partner explicitly sends them (or auto-sent if defaults = 'send').

CREATE TABLE notification_queue (
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

CREATE INDEX notification_queue_opportunity_id_idx ON notification_queue (opportunity_id);
CREATE INDEX notification_queue_status_idx         ON notification_queue (opportunity_id, status);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- Opportunity owner + editor collaborators + admins can read
CREATE POLICY "notification_queue_select" ON notification_queue FOR SELECT USING (
  EXISTS (SELECT 1 FROM opportunities WHERE id = notification_queue.opportunity_id AND profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM opportunity_collaborators WHERE opportunity_id = notification_queue.opportunity_id AND profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);

-- Opportunity owner + editor collaborators + admins can insert
CREATE POLICY "notification_queue_insert" ON notification_queue FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM opportunities WHERE id = opportunity_id AND profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM opportunity_collaborators WHERE opportunity_id = opportunity_id AND profile_id = auth.uid() AND role = 'editor')
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);

-- Opportunity owner + editor collaborators + admins can update (to edit subject/body or cancel)
CREATE POLICY "notification_queue_update" ON notification_queue FOR UPDATE USING (
  EXISTS (SELECT 1 FROM opportunities WHERE id = notification_queue.opportunity_id AND profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM opportunity_collaborators WHERE opportunity_id = notification_queue.opportunity_id AND profile_id = auth.uid() AND role = 'editor')
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
