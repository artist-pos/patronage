-- =============================================================
-- Migration 074: profiles.created_at backfill from auth.users
-- The created_at column already exists (added in migration 001).
-- This migration adds it with IF NOT EXISTS for safety, then
-- backfills all rows from auth.users.created_at so profile
-- timestamps accurately reflect when each account was created.
-- =============================================================

-- Add column if it somehow doesn't exist (no-op if already present)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Backfill: overwrite profiles.created_at with the authoritative
-- timestamp from auth.users so they stay in sync.
UPDATE profiles p
SET created_at = u.created_at
FROM auth.users u
WHERE p.id = u.id;
