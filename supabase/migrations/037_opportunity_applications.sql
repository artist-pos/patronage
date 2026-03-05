-- Migration 037: Native application pipeline

CREATE TABLE IF NOT EXISTS opportunity_applications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  artist_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending',
  custom_answers  jsonb NOT NULL DEFAULT '{}',
  artwork_id      uuid REFERENCES artworks(id) ON DELETE SET NULL,
  highres_asset_url text DEFAULT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, artist_id)
);

ALTER TABLE opportunity_applications ENABLE ROW LEVEL SECURITY;

-- Artists see/manage their own applications
CREATE POLICY "artists manage own applications" ON opportunity_applications
  USING (artist_id = auth.uid()) WITH CHECK (artist_id = auth.uid());

-- Partners see applications for their opportunities
CREATE POLICY "partners view submissions" ON opportunity_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = opportunity_id AND o.profile_id = auth.uid()
    )
  );

-- Partners can update status
CREATE POLICY "partners update status" ON opportunity_applications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM opportunities o
      WHERE o.id = opportunity_id AND o.profile_id = auth.uid()
    )
  );
