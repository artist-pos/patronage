-- Migration 012: caption + full_description for opportunities
-- caption: short summary ≤160 chars (replaces truncated description on card)
-- full_description: expanded content revealed via accordion

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS caption          TEXT,
  ADD COLUMN IF NOT EXISTS full_description TEXT;

ALTER TABLE opportunity_submissions
  ADD COLUMN IF NOT EXISTS caption          TEXT,
  ADD COLUMN IF NOT EXISTS full_description TEXT;
