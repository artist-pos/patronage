-- Migration 053: Add email column to profiles.
--
-- The 7 orphaned profiles created by migration 052 are being handled manually
-- (roles assigned via Supabase dashboard, users emailed directly).
-- No cleanup needed here.

-- ── Add email column ──────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

-- Backfill from auth.users
UPDATE public.profiles p
SET email = lower(trim(au.email))
FROM auth.users au
WHERE au.id = p.id
  AND p.email IS NULL;

-- Keep in sync when a user changes their email via Supabase auth
CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET email = lower(trim(NEW.email))
  WHERE id = NEW.id
    AND email IS DISTINCT FROM lower(trim(NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_email ON auth.users;
CREATE TRIGGER trg_sync_profile_email
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_profile_email();
