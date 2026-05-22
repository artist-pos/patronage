-- Migration 147: creative_work_id on opportunity_applications + drafts
-- Allows artists to attach any creative_work (image/audio/video/text/embed) to an application,
-- not just artworks (which are image-only in the upload UI).

ALTER TABLE opportunity_applications
  ADD COLUMN IF NOT EXISTS creative_work_id uuid REFERENCES creative_works(id) ON DELETE SET NULL;

ALTER TABLE opportunity_application_drafts
  ADD COLUMN IF NOT EXISTS creative_work_id uuid REFERENCES creative_works(id) ON DELETE SET NULL;
