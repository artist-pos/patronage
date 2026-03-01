-- Migration 010: city field for opportunities + submissions
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE opportunity_submissions
  ADD COLUMN IF NOT EXISTS city TEXT;
