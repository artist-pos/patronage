-- Migration 063: profile_achievements table
-- Verified career credentials auto-populated from pipeline approvals;
-- supplements the existing received_grants text array.

CREATE TABLE IF NOT EXISTS profile_achievements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opportunity_id  uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  opportunity_title text NOT NULL,
  organisation    text NOT NULL,
  type            text NOT NULL, -- Grant, Residency, Commission, Prize, etc.
  year            int  NOT NULL DEFAULT extract(year FROM now()),
  verified        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for profile lookups
CREATE INDEX IF NOT EXISTS profile_achievements_profile_id_idx
  ON profile_achievements(profile_id);

-- Prevent duplicate pipeline achievements per application
CREATE UNIQUE INDEX IF NOT EXISTS profile_achievements_opportunity_profile_unique
  ON profile_achievements(profile_id, opportunity_id)
  WHERE opportunity_id IS NOT NULL;

-- RLS
ALTER TABLE profile_achievements ENABLE ROW LEVEL SECURITY;

-- Anyone can read achievements (public profile data)
CREATE POLICY "achievements_public_read"
  ON profile_achievements FOR SELECT
  USING (true);

-- Artists can insert/update/delete their own non-verified achievements
CREATE POLICY "achievements_owner_insert"
  ON profile_achievements FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid() AND verified = false);

CREATE POLICY "achievements_owner_update"
  ON profile_achievements FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid() AND verified = false)
  WITH CHECK (profile_id = auth.uid() AND verified = false);

CREATE POLICY "achievements_owner_delete"
  ON profile_achievements FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());

-- Service role (used by partner approval action) can insert verified achievements
-- This is handled via the admin client which bypasses RLS entirely.
