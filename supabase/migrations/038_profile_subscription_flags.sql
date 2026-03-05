-- Migration 038: Artist subscription flags
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS marketing_subscription boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekly_digest boolean NOT NULL DEFAULT false;
