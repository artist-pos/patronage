-- ── project_notes ─────────────────────────────────────────────────
-- Notes left by authenticated users on project updates.
-- artist_id is denormalised from project_updates for efficient RLS.

CREATE TABLE project_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id   UUID NOT NULL REFERENCES project_updates(id) ON DELETE CASCADE,
  artist_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  is_visible  BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON project_notes(update_id);
CREATE INDEX ON project_notes(artist_id);
CREATE INDEX ON project_notes(sender_id);

ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;

-- Public can read visible notes
CREATE POLICY "Public read visible notes"
  ON project_notes FOR SELECT
  USING (is_visible = true);

-- Artist can read ALL notes on their own updates (including hidden)
CREATE POLICY "Artist reads all own notes"
  ON project_notes FOR SELECT
  TO authenticated
  USING (artist_id = auth.uid());

-- Any authenticated user can post a note (as themselves)
CREATE POLICY "Authenticated users post notes"
  ON project_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- Artist can toggle is_visible on notes attached to their updates
CREATE POLICY "Artist toggles note visibility"
  ON project_notes FOR UPDATE
  TO authenticated
  USING (artist_id = auth.uid())
  WITH CHECK (artist_id = auth.uid());

-- Sender or artist can delete a note
CREATE POLICY "Sender or artist deletes note"
  ON project_notes FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid() OR artist_id = auth.uid());


-- ── follows ────────────────────────────────────────────────────────
-- Hidden follower graph. Count is queryable by the artist and admin
-- but the public UI must NEVER display a public follower number.

CREATE TABLE follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id)
);

CREATE INDEX ON follows(following_id);
CREATE INDEX ON follows(follower_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Users manage their own outbound follows
CREATE POLICY "User manages own follows"
  ON follows FOR ALL
  TO authenticated
  USING (follower_id = auth.uid())
  WITH CHECK (follower_id = auth.uid());

-- Artists can see who follows them (for their own analytics)
CREATE POLICY "Artist reads own followers"
  ON follows FOR SELECT
  TO authenticated
  USING (following_id = auth.uid());
