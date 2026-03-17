ALTER TABLE profiles ADD COLUMN verified_at timestamptz;

-- Backfill existing verified artists (bio + avatar + disciplines + >= 3 works)
-- Set verified_at = created_at as a conservative estimate
UPDATE profiles
SET verified_at = created_at
WHERE id IN (
  SELECT p.id
  FROM profiles p
  WHERE p.bio IS NOT NULL
    AND p.avatar_url IS NOT NULL
    AND array_length(COALESCE(p.disciplines, '{}'), 1) > 0
    AND (
      SELECT COUNT(*) FROM portfolio_images pi WHERE pi.profile_id = p.id
    ) + (
      SELECT COUNT(*) FROM artworks a WHERE a.profile_id = p.id
    ) >= 3
    AND (p.role = 'artist' OR p.role = 'owner')
);
