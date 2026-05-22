-- Migration 052: Create artist profiles for confirmed auth users who never completed onboarding.
--
-- These users clicked "Create a free account" on the homepage, verified their email,
-- but were redirected to /profile/edit → /studio without ever hitting /onboarding/role.
-- They have auth.users rows but no profiles rows, so no role, no onboarding, no subscriber entry.
--
-- We create minimal artist profiles for them. The sync_artist_to_subscribers trigger
-- (migration 084) will fire on INSERT and automatically add their emails to subscribers.
-- They will need a separate nudge email to complete their profile.

INSERT INTO public.profiles (id, username, role, is_active)
SELECT
  au.id,
  -- username: sanitised email prefix + 6 hex chars from UUID to avoid collisions
  lower(regexp_replace(split_part(au.email, '@', 1), '[^a-z0-9]', '_', 'g'))
    || '_' || substring(replace(au.id::text, '-', ''), 1, 6) AS username,
  'artist' AS role,
  true     AS is_active
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
  AND au.email IS NOT NULL
  AND au.email_confirmed_at IS NOT NULL
ON CONFLICT (id) DO NOTHING;
