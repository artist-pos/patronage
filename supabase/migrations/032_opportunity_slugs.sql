-- Migration 032: SEO-friendly slugs for opportunities
-- Slug format: title-shortid (e.g. "photoplace-gallery-open-call-195878cc")
-- Short UUID prefix guarantees uniqueness without extra round-trips.

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS slug text;

-- Populate slugs for all existing rows
UPDATE opportunities
SET slug =
  LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        TRIM(title) || '-' || SUBSTRING(id::text, 1, 8),
        '[^a-z0-9]+', '-', 'gi'
      ),
      '-{2,}', '-', 'g'
    )
  )
WHERE slug IS NULL;

-- Enforce uniqueness going forward
CREATE UNIQUE INDEX IF NOT EXISTS opportunities_slug_idx ON opportunities(slug);
