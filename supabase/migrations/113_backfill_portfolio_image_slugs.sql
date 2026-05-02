-- Backfill slugs for portfolio_images that have a title but no slug yet.
-- Generates slug as: slugify(title) + optional -year suffix.
-- Handles duplicates within the same profile by appending -2, -3, etc.

WITH base AS (
  SELECT
    id,
    profile_id,
    lower(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            trim(title),
            '[^a-z0-9\s-]', '', 'gi'
          ),
          '\s+', '-', 'g'
        ),
        '-+', '-', 'g'
      )
    ) || CASE WHEN year IS NOT NULL THEN '-' || year::text ELSE '' END AS base_slug
  FROM portfolio_images
  WHERE title IS NOT NULL AND title <> '' AND (slug IS NULL OR slug = '')
),
ranked AS (
  SELECT
    b.id,
    b.profile_id,
    b.base_slug,
    ROW_NUMBER() OVER (PARTITION BY b.profile_id, b.base_slug ORDER BY b.id) AS rn
  FROM base b
)
UPDATE portfolio_images pi
SET slug = CASE
  WHEN r.rn = 1 THEN r.base_slug
  ELSE r.base_slug || '-' || r.rn::text
END
FROM ranked r
WHERE pi.id = r.id;
