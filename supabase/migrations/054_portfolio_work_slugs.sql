-- Add slug column to portfolio_images for human-readable URLs
ALTER TABLE portfolio_images ADD COLUMN IF NOT EXISTS slug TEXT;

-- Unique per artist (profile_id + slug), allowing NULLs
CREATE UNIQUE INDEX IF NOT EXISTS portfolio_images_profile_slug_unique
  ON portfolio_images (profile_id, slug)
  WHERE slug IS NOT NULL;
