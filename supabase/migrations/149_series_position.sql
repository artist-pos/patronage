-- Migration 149: Add position to series for unified archival ordering
ALTER TABLE series ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 9999;
