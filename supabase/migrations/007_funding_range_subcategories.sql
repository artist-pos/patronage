-- Migration 007: funding_range + sub_categories on opportunities + submissions

-- opportunities table
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS funding_range    TEXT,
  ADD COLUMN IF NOT EXISTS sub_categories  TEXT[];

-- opportunity_submissions table
ALTER TABLE opportunity_submissions
  ADD COLUMN IF NOT EXISTS funding_range    TEXT,
  ADD COLUMN IF NOT EXISTS sub_categories  TEXT[];
