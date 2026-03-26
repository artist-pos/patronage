-- Backfill slugs for portfolio_images that have a title but no slug.
-- Mirrors the JS generateWorkSlug / slugify logic: lowercase, strip non-alphanumeric,
-- replace spaces with hyphens, append year, deduplicate within profile_id.

DO $$
DECLARE
  rec RECORD;
  base_slug TEXT;
  candidate TEXT;
  counter INT;
BEGIN
  FOR rec IN
    SELECT id, profile_id, title, year
    FROM portfolio_images
    WHERE title IS NOT NULL AND title <> '' AND slug IS NULL
    ORDER BY profile_id, created_at
  LOOP
    -- Build base slug from title
    base_slug := trim(
      both '-' from
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(trim(rec.title)), '[^a-z0-9\s\-]', '', 'g'),
          '\s+', '-', 'g'
        ),
        '\-+', '-', 'g'
      )
    );

    -- Append year if present
    IF rec.year IS NOT NULL THEN
      base_slug := base_slug || '-' || rec.year::TEXT;
    END IF;

    IF base_slug = '' THEN
      CONTINUE;
    END IF;

    -- Resolve uniqueness within this artist's portfolio
    candidate := base_slug;
    counter := 2;
    WHILE EXISTS (
      SELECT 1 FROM portfolio_images
      WHERE profile_id = rec.profile_id AND slug = candidate
    ) LOOP
      candidate := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;

    UPDATE portfolio_images SET slug = candidate WHERE id = rec.id;
  END LOOP;
END $$;

-- ── Trigger: auto-update slug when title or year changes ─────────────────────
-- Only fires when the app has NOT already supplied a new slug value in the UPDATE,
-- acting as a safety net for direct SQL edits or future code paths.

CREATE OR REPLACE FUNCTION portfolio_images_auto_slug()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  counter INT;
BEGIN
  -- Skip if title is empty
  IF NEW.title IS NULL OR trim(NEW.title) = '' THEN
    RETURN NEW;
  END IF;

  -- Skip if title and year are unchanged
  IF OLD.title IS NOT DISTINCT FROM NEW.title
     AND OLD.year IS NOT DISTINCT FROM NEW.year THEN
    RETURN NEW;
  END IF;

  -- Skip if the app already provided an updated slug
  IF OLD.slug IS DISTINCT FROM NEW.slug THEN
    RETURN NEW;
  END IF;

  -- Generate base slug
  base_slug := trim(
    both '-' from
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(trim(NEW.title)), '[^a-z0-9\s\-]', '', 'g'),
        '\s+', '-', 'g'
      ),
      '\-+', '-', 'g'
    )
  );

  IF NEW.year IS NOT NULL THEN
    base_slug := base_slug || '-' || NEW.year::TEXT;
  END IF;

  IF base_slug = '' THEN
    RETURN NEW;
  END IF;

  -- Resolve uniqueness within this artist's portfolio
  candidate := base_slug;
  counter := 2;
  WHILE EXISTS (
    SELECT 1 FROM portfolio_images
    WHERE profile_id = NEW.profile_id AND slug = candidate AND id <> NEW.id
  ) LOOP
    candidate := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS portfolio_images_slug_trigger ON portfolio_images;

CREATE TRIGGER portfolio_images_slug_trigger
  BEFORE UPDATE ON portfolio_images
  FOR EACH ROW
  EXECUTE FUNCTION portfolio_images_auto_slug();
