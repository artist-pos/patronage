-- Migration 018: Schema additions
-- 1. Role enum: add patron + partner
-- 2. studio_posts table (artist_id, image_url, caption ≤120, status, project_id, created_at)
-- 3. is_featured boolean on opportunities

-- ── 1. Role enum additions ──────────────────────────────────────────────────
-- NOTE: Postgres enum additions must be committed before they can be used in
-- the same transaction on some versions, so this is kept as separate statements.
ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'patron';
ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'partner';

-- ── 2. Studio posts ──────────────────────────────────────────────────────────
CREATE TYPE post_status_enum AS ENUM ('post', 'for_sale', 'sold');

CREATE TABLE studio_posts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_url  TEXT        NOT NULL,
  caption    TEXT        CHECK (char_length(caption) <= 120),
  status     post_status_enum NOT NULL DEFAULT 'post',
  project_id UUID        REFERENCES projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE studio_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads studio_posts"
  ON studio_posts FOR SELECT USING (true);

CREATE POLICY "Artist inserts own studio_posts"
  ON studio_posts FOR INSERT
  WITH CHECK (auth.uid() = artist_id);

CREATE POLICY "Artist updates own studio_posts"
  ON studio_posts FOR UPDATE
  USING (auth.uid() = artist_id);

CREATE POLICY "Artist deletes own studio_posts"
  ON studio_posts FOR DELETE
  USING (auth.uid() = artist_id);

-- ── 3. Featured flag on opportunities ────────────────────────────────────────
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
