CREATE TABLE IF NOT EXISTS project_updates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_url  TEXT        NOT NULL,
  caption    TEXT        CHECK (char_length(caption) <= 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_updates_artist_id_idx  ON project_updates(artist_id);
CREATE INDEX IF NOT EXISTS project_updates_created_at_idx ON project_updates(created_at DESC);

ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;

-- Anyone can view updates from active profiles
CREATE POLICY "Public select"
  ON project_updates FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = artist_id AND is_active = true)
  );

-- Artists can insert/delete their own updates
CREATE POLICY "Artist insert"
  ON project_updates FOR INSERT
  WITH CHECK (auth.uid() = artist_id);

CREATE POLICY "Artist delete"
  ON project_updates FOR DELETE
  USING (auth.uid() = artist_id);
