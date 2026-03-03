-- Migration 021: Add description field to portfolio_images
-- Used for "Description / Inquiry Context" on available works.
-- Automatically appended to patron enquiry messages.
ALTER TABLE portfolio_images
  ADD COLUMN IF NOT EXISTS description TEXT;
