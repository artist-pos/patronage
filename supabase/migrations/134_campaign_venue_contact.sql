-- Add venue contact fields for café/venue display campaigns
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS venue_contact_name text,
  ADD COLUMN IF NOT EXISTS venue_contact_email text,
  ADD COLUMN IF NOT EXISTS venue_contact_phone text;
