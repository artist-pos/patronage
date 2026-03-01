-- Migration 008: vertical focal point for the profile banner
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS banner_focus_y INTEGER NOT NULL DEFAULT 50;
