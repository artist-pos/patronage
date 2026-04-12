-- Add invitation status to collective_members
-- Default 'accepted' so existing memberships are unaffected.
-- New invites sent by admins use status='pending' and the invitee must accept.
ALTER TABLE public.collective_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted'
  CHECK (status IN ('pending', 'accepted'));

-- Email invitations for non-Patronage users
CREATE TABLE IF NOT EXISTS public.collective_email_invitations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  collective_id uuid        NOT NULL REFERENCES collectives(id) ON DELETE CASCADE,
  email         text        NOT NULL,
  token         text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  claimed_by    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now(),
  expires_at    timestamptz DEFAULT now() + interval '30 days'
);

CREATE INDEX IF NOT EXISTS idx_collective_email_invitations_token ON collective_email_invitations(token);
CREATE INDEX IF NOT EXISTS idx_collective_email_invitations_collective ON collective_email_invitations(collective_id);

ALTER TABLE public.collective_email_invitations ENABLE ROW LEVEL SECURITY;

-- Anyone can read by token (server-side claim lookup)
CREATE POLICY "Public token lookup"
  ON collective_email_invitations FOR SELECT
  USING (true);

-- Only the inviter can insert
CREATE POLICY "Admins can create email invitations"
  ON collective_email_invitations FOR INSERT
  WITH CHECK (invited_by = auth.uid());

-- Claimed_by update is done via admin client only
