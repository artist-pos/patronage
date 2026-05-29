-- Migration 151: Claim tokens
-- Standalone claim token system for pre-built artist/partner profile ownership transfers.
-- Separate from the per-opportunity claim_token column used for the /claim-listing flow.

CREATE TYPE claim_entity_type  AS ENUM ('partner', 'artist');
CREATE TYPE claim_token_status AS ENUM ('pending', 'sent', 'claimed', 'expired');

CREATE TABLE claim_tokens (
  id                  uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  token               text               UNIQUE NOT NULL,
  entity_type         claim_entity_type  NOT NULL,
  entity_id           uuid               NOT NULL,
  recipient_email     text,
  recipient_name      text,
  status              claim_token_status NOT NULL DEFAULT 'pending',
  sent_at             timestamptz,
  claimed_at          timestamptz,
  claimed_by          uuid               REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at          timestamptz,
  outreach_contact_id uuid               REFERENCES outreach_contacts(id) ON DELETE SET NULL,
  notes               text,
  created_at          timestamptz        NOT NULL DEFAULT now()
);

CREATE INDEX claim_tokens_entity_id_idx          ON claim_tokens (entity_id);
CREATE INDEX claim_tokens_status_idx             ON claim_tokens (status);
CREATE INDEX claim_tokens_outreach_contact_idx   ON claim_tokens (outreach_contact_id);

ALTER TABLE claim_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "claim_tokens_admin_select" ON claim_tokens FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "claim_tokens_admin_insert" ON claim_tokens FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "claim_tokens_admin_update" ON claim_tokens FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "claim_tokens_admin_delete" ON claim_tokens FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));
