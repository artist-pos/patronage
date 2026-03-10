-- Migration 049: image orientation field for predictable aspect-ratio grids
-- Run in Supabase SQL Editor

ALTER TABLE portfolio_images
  ADD COLUMN IF NOT EXISTS orientation text
  CHECK (orientation IN ('landscape', 'portrait', 'square'));

ALTER TABLE project_updates
  ADD COLUMN IF NOT EXISTS orientation text
  CHECK (orientation IN ('landscape', 'portrait', 'square'));
