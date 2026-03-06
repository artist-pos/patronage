-- Migration 041: Backfill existing artist profiles into subscribers
-- Inserts any artist whose email is not already in the subscribers table.
INSERT INTO subscribers (email)
SELECT u.email
FROM auth.users u
JOIN profiles p ON p.id = u.id
WHERE p.role = 'artist'
  AND u.email IS NOT NULL
ON CONFLICT (email) DO NOTHING;
