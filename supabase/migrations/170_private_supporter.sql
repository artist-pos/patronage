-- 170: Private supporter mode for patron profiles
-- When enabled, the public patron profile masks the patron's identity:
-- neutral cover, name shown as "Private supporter", bio/taste/social links/
-- collected works hidden. The Following list stays public (the relationship
-- is public, the identity is private). Owner always sees their real profile.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS private_supporter boolean NOT NULL DEFAULT false;
