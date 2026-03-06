-- Migration 039: Professional CV for non-artist users
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS professional_cv_url text DEFAULT NULL;
