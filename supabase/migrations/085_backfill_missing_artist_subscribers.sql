-- Migration 085: Backfill any artists not yet in subscribers
-- Catches artists who joined after migration 066 but before the
-- trigger in 084 is live.
INSERT INTO public.subscribers (email)
SELECT lower(trim(au.email))
FROM auth.users au
JOIN public.profiles p ON p.id = au.id
WHERE p.role IN ('artist', 'owner')
  AND au.email IS NOT NULL
ON CONFLICT (email) DO NOTHING;
