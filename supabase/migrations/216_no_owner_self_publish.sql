-- 216: listing owners can no longer publish their own drafts.
--
-- 197 let an owner move a free (routing_type = 'external') listing from draft
-- straight to published. That skipped admin review entirely, and it was
-- reachable both from the "Save & Publish" button and from a direct API call.
-- The only owner transitions left are:
--   draft / draft_unclaimed -> pending   (submit for review)
--   published <-> unlisted               (delist / relist a listing admin approved)
-- Everything else needs an admin or the service role.
--
-- Run in the Supabase SQL Editor. Function body is otherwise identical to 197.

CREATE OR REPLACE FUNCTION protect_opportunity_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();
  IF caller_role IN ('admin', 'owner') THEN
    RETURN NEW;
  END IF;

  IF NEW.pipeline_paid_at IS DISTINCT FROM OLD.pipeline_paid_at THEN
    RAISE EXCEPTION 'pipeline_paid_at can only be set by Patronage';
  END IF;
  IF NEW.is_featured IS DISTINCT FROM OLD.is_featured THEN
    RAISE EXCEPTION 'is_featured can only be set by Patronage';
  END IF;
  IF NEW.featured_until IS DISTINCT FROM OLD.featured_until THEN
    RAISE EXCEPTION 'featured_until can only be set by Patronage';
  END IF;
  IF NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
    RAISE EXCEPTION 'profile_id cannot be changed';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status IN ('draft', 'draft_unclaimed') AND NEW.status = 'pending')
      OR (OLD.status = 'published' AND NEW.status = 'unlisted')
      OR (OLD.status = 'unlisted' AND NEW.status = 'published')
    ) THEN
      RAISE EXCEPTION 'status cannot be changed from % to % by the listing owner', OLD.status, NEW.status;
    END IF;
  END IF;

  IF NEW.is_active AND NOT COALESCE(OLD.is_active, false) AND NEW.status <> 'published' THEN
    RAISE EXCEPTION 'only published listings can be active';
  END IF;

  IF NEW.routing_type IS DISTINCT FROM OLD.routing_type AND OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'routing_type can only change while the listing is a draft';
  END IF;

  RETURN NEW;
END;
$$;
