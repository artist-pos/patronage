-- Migration 033: Add opens_at date to opportunities
-- Allows tracking when an opportunity's application window opens,
-- so listings can show "Opens in X days" before they go live.

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS opens_at date;
