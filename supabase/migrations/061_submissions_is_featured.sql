-- Migration 061: Add is_featured to opportunity_submissions
-- Mirrors the column added to opportunities in migration 042.

ALTER TABLE opportunity_submissions
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
