-- 180: Fix "Application error" when a non-admin creates an opportunity.
--
-- set_opportunity_slug_from_title() (migration 067) picks a free slug by
-- probing the table:
--
--   EXIT WHEN NOT EXISTS (SELECT 1 FROM opportunities WHERE slug = v_candidate ...)
--
-- That SELECT runs as the *invoking* user, so it is filtered by the SELECT
-- policies on opportunities. The unique index behind it is not. An artist or
-- partner cannot see other people's drafts, so the probe reports every taken
-- slug as free, the trigger writes the colliding candidate, and the INSERT dies
-- with 23505 "duplicate key value violates unique constraint
-- opportunities_slug_idx".
--
-- It bites the listing wizard every time: /partner/opportunities/new inserts a
-- draft with title='' , the empty base slug collides with the '' / '-1' / '-2'
-- placeholder drafts other users already own, and createOpportunityDraft()
-- rethrows the error during the server render — the digest page the user sees.
-- Admins and owners never hit it because their SELECT policy shows every row.
-- The same collision can hit the partner submission form (src/app/partners/
-- actions.ts inserts with the user-scoped client) whenever the generated slug
-- matches a listing the submitter cannot see. Community tips are unaffected —
-- tip-action.ts inserts with the admin client, which bypasses RLS entirely.
--
-- Fix: run the probe with SECURITY DEFINER so it sees the same rows the unique
-- index does. search_path is pinned, as it must be for any definer function.
--
-- The '' / '-1' / '-2' shape of a blank-title slug is deliberate and kept:
-- isSlugBad() in src/lib/opportunity-slug.ts treats a slug starting with '-'
-- (or empty) as a placeholder and regenerates it from the real title when the
-- listing is published.
--
-- Run manually in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION set_opportunity_slug_from_title()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

    v_counter := v_counter + 1;

    -- Bounded: a pathological base (or a concurrent insert racing us between
    -- the probe and the index write) falls back to the row's own id, which is
    -- unique by construction. Still starts with '-' for a blank title, so
    -- isSlugBad() keeps treating it as a placeholder to regenerate.
    IF v_counter > 50 THEN
      NEW.slug := v_base || '-' || SUBSTRING(NEW.id::text, 1, 8);
      RETURN NEW;
    END IF;

    v_candidate := v_base || '-' || v_counter;
  END LOOP;

  NEW.slug := v_candidate;
  RETURN NEW;
END;
$$;

-- EXECUTE on a SECURITY DEFINER function is granted to PUBLIC by default; the
-- function is only reachable through the trigger, but revoke direct calls
-- anyway so it cannot be used to probe hidden slugs.
REVOKE ALL ON FUNCTION set_opportunity_slug_from_title() FROM PUBLIC;

-- The trigger itself is unchanged (migration 067); recreated here so the file
-- is self-contained if the function is ever restored from this migration.
DROP TRIGGER IF EXISTS set_opportunity_slug_on_insert ON opportunities;
CREATE TRIGGER set_opportunity_slug_on_insert
  BEFORE INSERT ON opportunities
  FOR EACH ROW
  WHEN (NEW.slug IS NULL)
  EXECUTE FUNCTION set_opportunity_slug_from_title();
