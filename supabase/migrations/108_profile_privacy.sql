-- ============================================================
-- Migration 108: Profile-level privacy toggles (Phase 4)
--
-- Booleans that drive what the public profile/collection page shows.
-- Defaults reflect the "private by default, publishable by choice"
-- principle — except show_location, which is on by default to match
-- existing profile UX (city is currently public).
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_taste                 BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS show_follows               BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS show_location              BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_previously_collected  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS show_supporting            BOOLEAN NOT NULL DEFAULT FALSE;
