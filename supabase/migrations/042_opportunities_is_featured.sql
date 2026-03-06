-- Migration 042: Add is_featured flag to opportunities
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_opportunities_is_featured ON opportunities (is_featured) WHERE is_featured = true;
