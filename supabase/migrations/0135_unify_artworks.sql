-- Migration 135: Unify artworks — absorb portfolio_images into artworks
-- All works (archival + marketplace) now live in a single artworks table.
-- The editions.work_id FK is re-pointed from portfolio_images to artworks.
-- Run this in Supabase SQL editor. Steps are idempotent where possible.

-- ── 1. Add columns that exist on portfolio_images but not on artworks ─────────

ALTER TABLE artworks
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS collaborator_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS text_content text,
  ADD COLUMN IF NOT EXISTS embed_url text,
  ADD COLUMN IF NOT EXISTS embed_provider text,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS orientation text,
  ADD COLUMN IF NOT EXISTS natural_width integer,
  ADD COLUMN IF NOT EXISTS natural_height integer,
  ADD COLUMN IF NOT EXISTS location_text text,
  ADD COLUMN IF NOT EXISTS show_location_publicly boolean NOT NULL DEFAULT false;

-- Unique slug per profile (matches portfolio_images constraint)
CREATE UNIQUE INDEX IF NOT EXISTS artworks_slug_profile_id_idx
  ON artworks (profile_id, slug)
  WHERE slug IS NOT NULL;

-- ── 2. Migrate pure archival portfolio_images (no linked_artwork_id) ──────────
-- These don't have a corresponding artworks row yet. Insert them using the same
-- UUID so the editions.work_id FK remains valid after we move the FK.

INSERT INTO artworks (
  id, profile_id, creator_id, current_owner_id,
  url, caption, description, title, year, medium, dimensions,
  content_type, audio_url, video_url, text_content, embed_url, embed_provider,
  collaborator_ids, slug, is_featured, hide_from_archive, hide_available,
  hide_price, collection_visible, orientation, natural_width, natural_height,
  is_available, listing_mode, acquisition_mode, source,
  price_cents, is_poa, price_currency,
  position, created_at
)
SELECT
  pi.id,
  pi.profile_id,
  pi.creator_id,
  pi.current_owner_id,
  pi.url,
  pi.caption,
  pi.description,
  pi.title,
  pi.year,
  pi.medium,
  pi.dimensions,
  COALESCE(pi.content_type, 'image'),
  pi.audio_url,
  pi.video_url,
  pi.text_content,
  pi.embed_url,
  pi.embed_provider,
  COALESCE(pi.collaborator_ids, '{}'),
  pi.slug,
  COALESCE(pi.is_featured, false),
  COALESCE(pi.hide_from_archive, false),
  COALESCE(pi.hide_available, false),
  COALESCE(pi.hide_price, false),
  COALESCE(pi.collection_visible, true),
  pi.orientation,
  pi.natural_width,
  pi.natural_height,
  false,              -- is_available: archival works are not listed for sale
  'enquire_first',
  'enquire_first',
  'self_registered',
  null,               -- price_cents: not priced
  false,
  'NZD',
  COALESCE(pi.position, 0),
  pi.created_at
FROM portfolio_images pi
WHERE pi.linked_artwork_id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ── 3. Copy content/media fields from linked portfolio_images → artworks rows ──
-- For works that were published to sell, the artworks row already exists.
-- Copy over the display and content-type fields that only lived on portfolio_images.

UPDATE artworks a
SET
  content_type      = COALESCE(pi.content_type, 'image'),
  audio_url         = pi.audio_url,
  video_url         = pi.video_url,
  text_content      = pi.text_content,
  embed_url         = pi.embed_url,
  embed_provider    = pi.embed_provider,
  collaborator_ids  = COALESCE(pi.collaborator_ids, '{}'),
  slug              = COALESCE(a.slug, pi.slug),
  is_featured       = COALESCE(pi.is_featured, false),
  orientation       = pi.orientation,
  natural_width     = pi.natural_width,
  natural_height    = pi.natural_height
FROM portfolio_images pi
WHERE pi.linked_artwork_id = a.id;

-- ── 4. Re-point editions.work_id for linked portfolio_images ──────────────────
-- For editions on portfolio_images that had a linked_artwork_id, update work_id
-- to point at the artworks.id (the canonical ID going forward).

-- Drop the old FK first (constraint name is from migration 133)
ALTER TABLE editions DROP CONSTRAINT IF EXISTS editions_work_id_fkey;
-- Fallback in case of alternate naming convention:
DO $$ BEGIN
  ALTER TABLE editions DROP CONSTRAINT editions_work_id_portfolio_images_fkey;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Update work_id to point at artworks for linked rows
UPDATE editions e
SET work_id = pi.linked_artwork_id
FROM portfolio_images pi
WHERE e.work_id = pi.id
  AND pi.linked_artwork_id IS NOT NULL;

-- Add new FK constraint pointing at artworks
ALTER TABLE editions
  ADD CONSTRAINT editions_work_id_fkey
  FOREIGN KEY (work_id) REFERENCES artworks(id) ON DELETE CASCADE;

-- ── 5. Update work_images.portfolio_image_id → artwork_id ────────────────────

UPDATE work_images wi
SET
  artwork_id         = COALESCE(pi.linked_artwork_id, pi.id),
  portfolio_image_id = NULL
FROM portfolio_images pi
WHERE wi.portfolio_image_id = pi.id;

-- ── 6. RLS policies on artworks — ensure archival works are owner-visible ─────
-- Artworks already has public SELECT for is_available=true rows.
-- Add/replace a policy so owners can see their own is_available=false works too.

DROP POLICY IF EXISTS artworks_select_owner_archival ON artworks;
CREATE POLICY artworks_select_owner_archival ON artworks
  FOR SELECT
  USING (
    is_available = false
    AND auth.uid() = profile_id
  );

-- ── 7. Update editions RLS to reference artworks instead of portfolio_images ───
-- The editions_select policy from migration 133 checks portfolio_images, which will
-- not exist after the DROP below. Replace it with an artworks-based check.

DROP POLICY IF EXISTS editions_select ON editions;
CREATE POLICY editions_select ON editions
  FOR SELECT
  USING (
    listed = true
    OR EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = editions.work_id
        AND artworks.profile_id = auth.uid()
    )
  );

-- ── 8. Drop portfolio_images ──────────────────────────────────────────────────
-- Only run this line after verifying app code is fully updated and data looks correct.
-- Comment it out to run the migration in a dry-run first.

DROP TABLE IF EXISTS portfolio_images CASCADE;

-- ── Done ─────────────────────────────────────────────────────────────────────
-- Verify:
--   SELECT count(*) FROM artworks WHERE is_available = false;  -- should match old portfolio_images count
--   SELECT count(*) FROM editions;                             -- should be unchanged
--   SELECT * FROM editions WHERE work_id NOT IN (SELECT id FROM artworks); -- should return 0 rows
