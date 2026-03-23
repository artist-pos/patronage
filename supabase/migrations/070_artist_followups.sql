-- Migration 070: Artist follow-up tracking for longitudinal ESG impact reporting

-- Track when an application was moved to 'selected' status (used by cron to schedule follow-ups)
ALTER TABLE opportunity_applications ADD COLUMN IF NOT EXISTS selected_at timestamptz;

-- Artist follow-up survey responses (6-month and 12-month post-selection)
CREATE TABLE IF NOT EXISTS artist_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) NOT NULL,
  opportunity_id uuid REFERENCES opportunities(id) NOT NULL,
  application_id uuid REFERENCES opportunity_applications(id) NOT NULL,
  followup_type text NOT NULL CHECK (followup_type IN ('6_month', '12_month')),
  sent_at timestamptz,
  completed_at timestamptz,
  -- Survey responses (all optional)
  further_opportunities text,
  exhibitions text,
  press_coverage text,
  income_from_practice text CHECK (income_from_practice IN ('Increased', 'Stayed the same', 'Decreased', 'Not applicable', NULL)),
  community_projects text,
  testimonial text,
  testimonial_consent boolean DEFAULT false,
  additional_notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_followups_profile ON artist_followups(profile_id);
CREATE INDEX IF NOT EXISTS idx_followups_opportunity ON artist_followups(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_followups_application ON artist_followups(application_id);
CREATE INDEX IF NOT EXISTS idx_followups_sent_at ON artist_followups(sent_at);

-- RLS: artists can read and update their own follow-ups; service role handles inserts via cron
ALTER TABLE artist_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Artists can read own followups" ON artist_followups
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Artists can update own followups" ON artist_followups
  FOR UPDATE USING (profile_id = auth.uid());
