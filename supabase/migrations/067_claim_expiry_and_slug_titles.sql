-- Migration 067: Claim token expiry + regenerate slugs from titles

-- 1. Add expiry column for claim tokens
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS claim_token_expires_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Regenerate ALL opportunity slugs from titles (title + year where deadline exists).
--    Uses ROW_NUMBER to handle duplicate base slugs — second occurrence gets a short ID suffix.
WITH base_slugs AS (
  SELECT
    id,
    created_at,
    deadline,
    LEFT(
      REGEXP_REPLACE(
        REGEXP_REPLACE(LOWER(TRIM(title)), '[^a-z0-9]+', '-', 'g'),
        '^-+|-+$', '', 'g'
      ),
      70
    ) ||
    CASE
      WHEN deadline IS NOT NULL THEN '-' || EXTRACT(YEAR FROM deadline)::text
      ELSE ''
    END AS base_slug
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

-- 3. Trigger function: auto-generate slug on INSERT when none is provided
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

  IF NEW.deadline IS NOT NULL THEN
    v_base := v_base || '-' || EXTRACT(YEAR FROM NEW.deadline)::text;
  END IF;

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
