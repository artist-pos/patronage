-- Migration 072: Opportunity collaborators (multi-user pipeline access)
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS opportunity_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE CASCADE NOT NULL,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  invited_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  invited_at timestamptz DEFAULT now(),
  UNIQUE(opportunity_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_collab_opportunity ON opportunity_collaborators(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_collab_profile ON opportunity_collaborators(profile_id);

ALTER TABLE opportunity_collaborators ENABLE ROW LEVEL SECURITY;

-- Users can view their own collaborator records
CREATE POLICY "Users can view their own collaborator records"
  ON opportunity_collaborators FOR SELECT
  USING (profile_id = auth.uid());

-- Opportunity owners can manage collaborators
CREATE POLICY "Opportunity owners can manage collaborators"
  ON opportunity_collaborators FOR ALL
  USING (
    opportunity_id IN (
      SELECT id FROM opportunities WHERE profile_id = auth.uid()
    )
  );

-- Admins have full access
CREATE POLICY "Admins have full access to collaborators"
  ON opportunity_collaborators FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );
