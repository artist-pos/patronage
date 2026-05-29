-- Migration 150: Outreach CRM
-- Tables for tracking business development outreach contacts and activity log.

CREATE TYPE outreach_category AS ENUM (
  'corporate', 'council_govt', 'arts_sector', 'education',
  'developer', 'investor', 'media_platform', 'other'
);

CREATE TYPE outreach_status AS ENUM (
  'not_started', 'contacted', 'no_response', 'replied',
  'meeting_booked', 'in_conversation', 'rejected', 'completed', 'paused', 'bounced'
);

CREATE TYPE outreach_channel AS ENUM (
  'email', 'linkedin', 'phone', 'in_person',
  'contact_form', 'intro_email', 'instagram', 'other'
);

CREATE TYPE outreach_sent_from AS ENUM ('personal', 'patronage');

CREATE TYPE outreach_activity_type AS ENUM (
  'email_sent', 'email_received', 'meeting', 'phone_call',
  'linkedin_message', 'note', 'status_change'
);

-- ── outreach_contacts ─────────────────────────────────────────────────────────

CREATE TABLE outreach_contacts (
  id                 uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  company            text             NOT NULL,
  contact_name       text,
  role               text,
  email              text,
  linkedin_url       text,
  category           outreach_category NOT NULL DEFAULT 'other',
  status             outreach_status   NOT NULL DEFAULT 'not_started',
  channel            outreach_channel,
  warm_intro_via     text,
  first_contact_date date,
  last_activity_date date,
  follow_up_date     date,
  meeting_date       timestamptz,
  their_response     text,
  next_action        text,
  notes              text,
  sent_from          outreach_sent_from NOT NULL DEFAULT 'patronage',
  created_at         timestamptz       NOT NULL DEFAULT now(),
  updated_at         timestamptz       NOT NULL DEFAULT now()
);

CREATE INDEX outreach_contacts_status_idx         ON outreach_contacts (status);
CREATE INDEX outreach_contacts_follow_up_date_idx ON outreach_contacts (follow_up_date);
CREATE INDEX outreach_contacts_last_activity_idx  ON outreach_contacts (last_activity_date);
CREATE INDEX outreach_contacts_email_idx          ON outreach_contacts (email);

ALTER TABLE outreach_contacts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION set_outreach_contacts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER outreach_contacts_updated_at
  BEFORE UPDATE ON outreach_contacts
  FOR EACH ROW EXECUTE FUNCTION set_outreach_contacts_updated_at();

CREATE POLICY "outreach_contacts_admin_select" ON outreach_contacts FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "outreach_contacts_admin_insert" ON outreach_contacts FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "outreach_contacts_admin_update" ON outreach_contacts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "outreach_contacts_admin_delete" ON outreach_contacts FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));

-- ── outreach_activity ─────────────────────────────────────────────────────────

CREATE TABLE outreach_activity (
  id            uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id    uuid                  NOT NULL REFERENCES outreach_contacts(id) ON DELETE CASCADE,
  activity_type outreach_activity_type NOT NULL,
  description   text                  NOT NULL,
  created_at    timestamptz           NOT NULL DEFAULT now()
);

CREATE INDEX outreach_activity_contact_id_idx ON outreach_activity (contact_id, created_at DESC);

ALTER TABLE outreach_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outreach_activity_admin_select" ON outreach_activity FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "outreach_activity_admin_insert" ON outreach_activity FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "outreach_activity_admin_delete" ON outreach_activity FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));
