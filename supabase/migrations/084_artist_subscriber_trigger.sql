-- Migration 084: Auto-add artists to subscribers via database trigger
-- This is more reliable than application-level code — fires on every profile
-- insert/update regardless of which auth flow (email, OAuth, admin) created the profile.

CREATE OR REPLACE FUNCTION sync_artist_to_subscribers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  -- Only act when role is (or becomes) 'artist' or 'owner'
  IF NEW.role NOT IN ('artist', 'owner') THEN
    RETURN NEW;
  END IF;

  -- Fetch email from auth.users (requires SECURITY DEFINER to read auth schema)
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = NEW.id;

  IF v_email IS NOT NULL THEN
    INSERT INTO public.subscribers (email)
    VALUES (lower(trim(v_email)))
    ON CONFLICT (email) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger fires on INSERT and on UPDATE when role changes to artist/owner
DROP TRIGGER IF EXISTS trg_artist_subscriber_sync ON public.profiles;
CREATE TRIGGER trg_artist_subscriber_sync
  AFTER INSERT OR UPDATE OF role
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_artist_to_subscribers();
