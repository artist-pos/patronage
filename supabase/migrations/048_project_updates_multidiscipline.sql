-- =============================================================
-- Migration 048: Multi-discipline support for project_updates
--                and studio_posts
--
-- • image_url becomes nullable (existing rows unaffected — they
--   already have a value; the NOT NULL constraint is dropped).
-- • content_type drives rendering: image | audio | video |
--   text | document | embed.  Existing rows default to 'image'.
-- • New URL columns hold media depending on content_type.
-- • discipline is an optional tag.
-- =============================================================

-- Ensure the enums added in 047 exist before referencing them
-- (047 runs first; this migration is safe to apply independently
--  as long as 047 has already been applied).

-- ── project_updates ───────────────────────────────────────────

ALTER TABLE project_updates
  ALTER COLUMN image_url DROP NOT NULL;

ALTER TABLE project_updates
  ADD COLUMN IF NOT EXISTS content_type  content_type_enum  NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS discipline    discipline_enum,
  ADD COLUMN IF NOT EXISTS audio_url     text,
  ADD COLUMN IF NOT EXISTS video_url     text,
  ADD COLUMN IF NOT EXISTS text_content  text,
  ADD COLUMN IF NOT EXISTS embed_url     text,
  ADD COLUMN IF NOT EXISTS embed_provider text;

-- Back-fill: every existing row is an image post
UPDATE project_updates SET content_type = 'image' WHERE content_type IS NULL;

-- ── studio_posts ──────────────────────────────────────────────

ALTER TABLE studio_posts
  ALTER COLUMN image_url DROP NOT NULL;

ALTER TABLE studio_posts
  ADD COLUMN IF NOT EXISTS content_type  content_type_enum  NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS discipline    discipline_enum,
  ADD COLUMN IF NOT EXISTS audio_url     text,
  ADD COLUMN IF NOT EXISTS video_url     text,
  ADD COLUMN IF NOT EXISTS text_content  text,
  ADD COLUMN IF NOT EXISTS embed_url     text,
  ADD COLUMN IF NOT EXISTS embed_provider text;

UPDATE studio_posts SET content_type = 'image' WHERE content_type IS NULL;
