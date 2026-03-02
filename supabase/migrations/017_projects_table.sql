-- ── projects ───────────────────────────────────────────────────────
-- Named project threads that group related project_updates together.
-- A project has a title and a 280-character lead/description.

CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description TEXT CHECK (char_length(description) <= 280),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON projects(artist_id);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Public can read all projects
CREATE POLICY "Public read projects"
  ON projects FOR SELECT USING (true);

-- Artist manages their own projects
CREATE POLICY "Artist manages own projects"
  ON projects FOR ALL
  TO authenticated
  USING (artist_id = auth.uid())
  WITH CHECK (artist_id = auth.uid());


-- ── project_updates: add project_id FK ────────────────────────────

ALTER TABLE project_updates
  ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX ON project_updates(project_id);

-- Allow artist to update project_id on their own updates
CREATE POLICY "Artist updates own project_updates"
  ON project_updates FOR UPDATE
  TO authenticated
  USING (artist_id = auth.uid())
  WITH CHECK (artist_id = auth.uid());
