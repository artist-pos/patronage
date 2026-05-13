-- Migration 128: project slugs + chat message delete policy

-- ── Project slugs ─────────────────────────────────────────────────────────────

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS slug text;

-- Generate initial slug: [artist-username]-[sanitised-title]
UPDATE projects p
SET slug = (
  SELECT
    pr.username
    || '-'
    || TRIM(BOTH '-' FROM
         LOWER(REGEXP_REPLACE(TRIM(p.title), '[^a-zA-Z0-9]+', '-', 'g'))
       )
  FROM profiles pr
  WHERE pr.id = p.artist_id
)
WHERE p.slug IS NULL;

-- Fallback for any remaining nulls / empty strings
UPDATE projects
SET slug = 'project-' || SUBSTRING(id::text, 1, 8)
WHERE slug IS NULL OR slug = '' OR slug = '-';

-- De-duplicate: append -2, -3, … to later rows with the same slug
DO $$
DECLARE
  base_slug TEXT;
  counter   INT;
  dup_id    UUID;
BEGIN
  FOR base_slug IN (
    SELECT slug FROM projects GROUP BY slug HAVING COUNT(*) > 1
  ) LOOP
    counter := 2;
    FOR dup_id IN (
      SELECT id FROM projects WHERE slug = base_slug ORDER BY created_at OFFSET 1
    ) LOOP
      UPDATE projects SET slug = base_slug || '-' || counter WHERE id = dup_id;
      counter := counter + 1;
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE projects
  ADD CONSTRAINT projects_slug_unique UNIQUE (slug);

CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects (slug);

-- ── Chat message delete policy ────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chat_messages' AND policyname = 'chat_messages_delete_own'
  ) THEN
    CREATE POLICY "chat_messages_delete_own" ON chat_messages
      FOR DELETE USING (auth.uid() = sender_id);
  END IF;
END $$;
