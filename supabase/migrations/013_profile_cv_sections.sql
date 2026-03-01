-- Migration 013: Exhibition History + Press/Bibliography on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS exhibition_history  JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS press_bibliography  JSONB NOT NULL DEFAULT '[]'::jsonb;
