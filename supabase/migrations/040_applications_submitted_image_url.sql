-- Migration 040: Add submitted_image_url to opportunity_applications
-- (was missing from original migration 037)
ALTER TABLE opportunity_applications
  ADD COLUMN IF NOT EXISTS submitted_image_url text DEFAULT NULL;
