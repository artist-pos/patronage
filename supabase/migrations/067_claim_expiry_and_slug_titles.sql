-- Migration 067: Claim token expiry + regenerate slugs from titles

-- 1. Add expiry column for claim tokens
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS claim_token_expires_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Drop unique index before bulk update to avoid per-row constraint violations
DROP INDEX IF EXISTS opportunities_slug_idx;

-- 3. Regenerate ALL slugs from title only (no year suffix — avoids "title-2026-2026"
--    when the year is already in the title). Duplicate base slugs get a short ID suffix.
WITH base_slugs AS (
  SELECT
    id,
    created_at,
    LEFT(
      REGEXP_REPLACE(
        REGEXP_REPLACE(LOWER(TRIM(title)), '[^a-z0-9]+', '-', 'g'),
        '^-+|-+$', '', 'g'
      ),
      70
    ) AS base_slug
  FROM opportunities
),
ranked AS (
  SELECT
    id,
    base_slug,
    ROW_NUMBER() OVER (PARTITION BY base_slug ORDER BY created_at NULLS LAST) AS rn
  FROM base_slugs
)
UPDATE opportunities o
SET slug = CASE
  WHEN r.rn = 1 THEN r.base_slug
  ELSE r.base_slug || '-' || SUBSTRING(o.id::text, 1, 8)
END
FROM ranked r
WHERE o.id = r.id;

-- 4. Recreate unique index
CREATE UNIQUE INDEX opportunities_slug_idx ON opportunities (slug);

-- 5. Trigger: auto-generate slug on INSERT when none provided
CREATE OR REPLACE FUNCTION set_opportunity_slug_from_title()
RETURNS TRIGGER AS $$
DECLARE
  v_base      TEXT;
  v_candidate TEXT;
  v_counter   INT := 0;
BEGIN
  IF NEW.slug IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_base := LEFT(
    REGEXP_REPLACE(
      REGEXP_REPLACE(LOWER(TRIM(NEW.title)), '[^a-z0-9]+', '-', 'g'),
      '^-+|-+$', '', 'g'
    ),
    70
  );

  v_candidate := v_base;

  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM opportunities
      WHERE slug = v_candidate
        AND id IS DISTINCT FROM NEW.id
    );
    v_counter   := v_counter + 1;
    v_candidate := v_base || '-' || v_counter;
  END LOOP;

  NEW.slug := v_candidate;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_opportunity_slug_on_insert ON opportunities;
CREATE TRIGGER set_opportunity_slug_on_insert
  BEFORE INSERT ON opportunities
  FOR EACH ROW
  WHEN (NEW.slug IS NULL)
  EXECUTE FUNCTION set_opportunity_slug_from_title();
