-- Migration 034: Add opens_at to opportunity_submissions
ALTER TABLE opportunity_submissions
  ADD COLUMN IF NOT EXISTS opens_at date;
