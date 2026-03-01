-- Analytics events table: tracks grant engagements, click-throughs, and medium filter usage
CREATE TABLE IF NOT EXISTS analytics_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT        NOT NULL,
  payload     JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_type_idx       ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events(created_at);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can insert events
CREATE POLICY "Public insert"
  ON analytics_events FOR INSERT
  WITH CHECK (true);

-- Only authenticated users (admins) can read
CREATE POLICY "Auth select"
  ON analytics_events FOR SELECT
  USING (auth.role() = 'authenticated');
