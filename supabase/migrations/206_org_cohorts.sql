-- Cohorts under an organisation: "BFA 2026", "Studio members", "Open call
-- finalists". A cohort has a join code, so a school can hand one link to a
-- year group and see how many have arrived and what is open for them.
--
-- A cohort grants the organisation nothing on the artist: it is attribution
-- plus a group count. Public roster membership (collective_members) stays a
-- separate, consented thing.
CREATE TABLE IF NOT EXISTS org_cohorts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  year           int  CHECK (year IS NULL OR year BETWEEN 1900 AND 2100),
  code           text NOT NULL UNIQUE,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_cohorts_org_idx ON org_cohorts (org_profile_id);

ALTER TABLE org_cohorts ENABLE ROW LEVEL SECURITY;

-- An organisation manages its own cohorts. Join-code lookups happen server
-- side with the service role, so the code table is not publicly readable.
DROP POLICY IF EXISTS "Organisations manage their own cohorts" ON org_cohorts;
CREATE POLICY "Organisations manage their own cohorts" ON org_cohorts
  FOR ALL
  USING (org_profile_id = auth.uid())
  WITH CHECK (org_profile_id = auth.uid());

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES org_cohorts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_cohort_idx ON profiles (cohort_id) WHERE cohort_id IS NOT NULL;
