-- Migration 036: User saved opportunities (career dashboard)

CREATE TABLE IF NOT EXISTS user_saved_opportunities (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'saved',
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, opportunity_id)
);

ALTER TABLE user_saved_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own saves" ON user_saved_opportunities
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Save count view for popularity
CREATE OR REPLACE VIEW opportunity_save_counts AS
  SELECT opportunity_id, count(*) AS save_count
  FROM user_saved_opportunities
  GROUP BY opportunity_id;
