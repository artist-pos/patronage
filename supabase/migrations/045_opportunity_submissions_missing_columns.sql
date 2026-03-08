-- Migration 045: Add missing columns to opportunity_submissions
-- These were added to opportunities in 035 but never mirrored to submissions.

ALTER TABLE opportunity_submissions ADD COLUMN IF NOT EXISTS entry_fee numeric DEFAULT NULL;
ALTER TABLE opportunity_submissions ADD COLUMN IF NOT EXISTS artist_payment_type text DEFAULT NULL;
ALTER TABLE opportunity_submissions ADD COLUMN IF NOT EXISTS travel_support boolean DEFAULT NULL;
ALTER TABLE opportunity_submissions ADD COLUMN IF NOT EXISTS travel_support_details text DEFAULT NULL;
ALTER TABLE opportunity_submissions ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL DEFAULT NULL;
