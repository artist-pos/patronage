CREATE TABLE IF NOT EXISTS public.engagement_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id     uuid        REFERENCES portfolio_images(id) ON DELETE CASCADE,
  event_type  text        NOT NULL CHECK (event_type IN ('view', 'play', 'enquiry', 'share')),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_engagement_work_type ON engagement_logs(work_id, event_type);
CREATE INDEX IF NOT EXISTS idx_engagement_created ON engagement_logs(created_at);

ALTER TABLE engagement_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log engagement"
  ON engagement_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Work owners can read their engagement logs"
  ON engagement_logs FOR SELECT
  USING (
    work_id IN (
      SELECT id FROM portfolio_images WHERE creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );
