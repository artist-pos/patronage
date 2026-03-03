-- Migration 025: Allow patrons and partners to post opportunities on their profiles
-- Adds an optional profile_id to the existing opportunities table.

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;

-- Patrons, partners, and owners can insert opportunities linked to their own profile
CREATE POLICY "opportunities_insert_profile_owner"
  ON opportunities FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = profile_id
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('patron', 'partner', 'owner')
  );

-- Profile owners can update their own opportunities
CREATE POLICY "opportunities_update_profile_owner"
  ON opportunities FOR UPDATE
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- Profile owners can delete their own opportunities
CREATE POLICY "opportunities_delete_profile_owner"
  ON opportunities FOR DELETE
  USING (auth.uid() = profile_id);

-- Public can see profile-linked active opportunities (existing select policy already covers this)
