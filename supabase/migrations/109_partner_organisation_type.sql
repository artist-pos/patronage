-- ============================================================
-- Migration 109: Partner organisation type + donation CTA (Phase 6)
--
-- Distinguishes the three flavours of partner: charities, galleries,
-- and businesses. Charities can request a donation CTA on their
-- public profile (admin-gated, off-site link only — Patronage never
-- processes the donation itself).
-- ============================================================

DO $$ BEGIN
  CREATE TYPE organisation_type AS ENUM ('charity', 'gallery', 'business');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS organisation_type        organisation_type,
  ADD COLUMN IF NOT EXISTS charitable_registration  TEXT,
  ADD COLUMN IF NOT EXISTS donation_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS donation_url             TEXT;

CREATE INDEX IF NOT EXISTS profiles_org_type_idx
  ON profiles(organisation_type) WHERE organisation_type IS NOT NULL;

-- Donation can only be enabled for charities, and only after admin approval.
-- Enforce in app code rather than a CHECK so admin can fix bad rows directly.
