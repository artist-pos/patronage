-- =============================================================
-- Migration 047: Multi-discipline content system
-- Safe additive migration — no drops, no breaking changes.
--
-- 1. New enums: discipline_enum, content_type_enum
-- 2. New table: creative_works (unified multi-discipline content)
-- 3. profiles: add disciplines discipline_enum[]
-- 4. opportunities: add disciplines, recurring, region, employment_type
-- 5. Lift character limits on projects.description,
--    project_updates.caption, project_notes.content,
--    studio_posts.caption
-- =============================================================


-- ── 1. Enums ─────────────────────────────────────────────────

CREATE TYPE discipline_enum AS ENUM (
  'visual_art',
  'music',
  'poetry',
  'writing',
  'dance',
  'film',
  'photography',
  'craft',
  'performance',
  'other'
);

CREATE TYPE content_type_enum AS ENUM (
  'image',
  'audio',
  'video',
  'text',
  'document',
  'embed'
);


-- ── 2. creative_works ─────────────────────────────────────────
-- Unified content table for all disciplines.
-- Mirrors the privacy + provenance pattern from portfolio_images/artworks.
-- At least one of image_url / audio_url / video_url / text_content /
-- embed_url should be populated depending on content_type.

CREATE TABLE creative_works (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  creator_id        uuid        NOT NULL REFERENCES profiles(id),
  current_owner_id  uuid        NOT NULL REFERENCES profiles(id),

  -- Discipline & content type
  discipline        discipline_enum   NOT NULL,
  content_type      content_type_enum NOT NULL DEFAULT 'image',

  -- Core metadata
  title             text,
  caption           text,
  description       text,
  year_created      integer,
  medium_detail     text,          -- e.g. "oil on canvas", "field recording", "16mm film"
  duration_seconds  integer,       -- for audio / video / performance

  -- Content URLs (one or more depending on content_type)
  image_url         text,
  audio_url         text,
  video_url         text,
  text_content      text,          -- for poetry / prose stored inline
  embed_url         text,          -- for SoundCloud, Vimeo, YouTube, etc.
  embed_provider    text,          -- e.g. "soundcloud", "vimeo", "youtube", "bandcamp"

  -- Marketplace / collection
  price             text,
  is_available      boolean NOT NULL DEFAULT false,
  hide_available    boolean NOT NULL DEFAULT false,

  -- Privacy toggles (same pattern as artworks)
  hide_from_archive boolean NOT NULL DEFAULT false,
  hide_price        boolean NOT NULL DEFAULT false,
  collection_visible boolean NOT NULL DEFAULT true,

  -- Ordering
  position          integer NOT NULL DEFAULT 0,

  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON creative_works(profile_id);
CREATE INDEX ON creative_works(creator_id);
CREATE INDEX ON creative_works(current_owner_id);
CREATE INDEX ON creative_works(discipline);
CREATE INDEX ON creative_works(content_type);
CREATE INDEX ON creative_works(created_at DESC);

ALTER TABLE creative_works ENABLE ROW LEVEL SECURITY;

-- Public can see works that are available, or that belong to the viewer
CREATE POLICY "creative_works_select"
  ON creative_works FOR SELECT
  USING (
    is_available = true
    OR creator_id = auth.uid()
    OR current_owner_id = auth.uid()
    OR (
      hide_from_archive = false
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE id = profile_id AND is_active = true
      )
    )
  );

-- Creator inserts as themselves
CREATE POLICY "creative_works_insert"
  ON creative_works FOR INSERT
  WITH CHECK (creator_id = auth.uid() AND profile_id = auth.uid());

-- Creator can update their own works (metadata, privacy, etc.)
CREATE POLICY "creative_works_update_creator"
  ON creative_works FOR UPDATE
  USING (creator_id = auth.uid());

-- Current owner can update their own privacy / collection settings
CREATE POLICY "creative_works_update_owner"
  ON creative_works FOR UPDATE
  USING (current_owner_id = auth.uid());

-- Creator can delete only while they still own the work
CREATE POLICY "creative_works_delete"
  ON creative_works FOR DELETE
  USING (creator_id = auth.uid() AND current_owner_id = auth.uid());

-- Admin full access
CREATE POLICY "creative_works_admin"
  ON creative_works FOR ALL
  USING (is_admin());


-- ── 2a. Storage buckets for new content types ─────────────────

-- Audio bucket (public read, 50 MB limit, common audio formats)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio',
  'audio',
  true,
  52428800, -- 50 MB
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/x-m4a']
) ON CONFLICT (id) DO NOTHING;

-- Video bucket (public read, 200 MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'video',
  'video',
  true,
  209715200, -- 200 MB
  ARRAY['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
) ON CONFLICT (id) DO NOTHING;

-- Documents bucket (public read, 20 MB, PDFs + common doc types)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  20971520, -- 20 MB
  ARRAY['application/pdf', 'text/plain', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;

-- Audio storage RLS
CREATE POLICY "audio_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio');

CREATE POLICY "audio_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "audio_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Video storage RLS
CREATE POLICY "video_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'video');

CREATE POLICY "video_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'video'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "video_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'video'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Documents storage RLS
CREATE POLICY "documents_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents');

CREATE POLICY "documents_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "documents_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ── 3. profiles: disciplines ──────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS disciplines discipline_enum[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS profiles_disciplines_idx
  ON profiles USING gin(disciplines);


-- ── 4. opportunities: disciplines, recurring, region, employment ──

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS disciplines      discipline_enum[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_recurring     boolean            NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_pattern text,            -- e.g. 'monthly', 'quarterly', 'annual'
  ADD COLUMN IF NOT EXISTS recurrence_note  text,             -- human-readable note, e.g. "Opens first Monday of each month"
  ADD COLUMN IF NOT EXISTS next_opens_at    date,             -- next known open date for recurring opps
  ADD COLUMN IF NOT EXISTS region           text,             -- sub-national region, e.g. "Auckland", "Victoria"
  ADD COLUMN IF NOT EXISTS employment_type  text;             -- for Job type: 'Full-time', 'Part-time', 'Contract', 'Casual'

CREATE INDEX IF NOT EXISTS opportunities_disciplines_idx
  ON opportunities USING gin(disciplines);

CREATE INDEX IF NOT EXISTS opportunities_is_recurring_idx
  ON opportunities(is_recurring);


-- ── 5. Lift character limits ───────────────────────────────────
-- PostgreSQL auto-names unnamed CHECK constraints as
-- {table}_{column}_check. We drop and do not replace them,
-- relying on application-layer validation instead.

-- projects.description (was <= 280)
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_description_check;

-- project_updates.caption (was <= 120)
ALTER TABLE project_updates
  DROP CONSTRAINT IF EXISTS project_updates_caption_check;

-- project_notes.content (was 1–500)
ALTER TABLE project_notes
  DROP CONSTRAINT IF EXISTS project_notes_content_check;

-- studio_posts.caption (was <= 120)
ALTER TABLE studio_posts
  DROP CONSTRAINT IF EXISTS studio_posts_caption_check;
