-- Migration 066: Backfill any artist/owner profiles not yet in subscribers.
-- Catches artists created after migration 041, and owner-role users missed by
-- the artist-only WHERE clause in that migration.
INSERT INTO subscribers (email)
SELECT u.email
FROM auth.users u
JOIN profiles p ON p.id = u.id
WHERE p.role IN ('artist', 'owner')
  AND u.email IS NOT NULL
ON CONFLICT (email) DO NOTHING;
