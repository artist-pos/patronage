-- Add partner marketing opt-in to opportunity applications
-- This is a separate, unchecked checkbox in the apply modal — never bundled with submit consent.
ALTER TABLE opportunity_applications
  ADD COLUMN IF NOT EXISTS partner_marketing_opt_in boolean NOT NULL DEFAULT false;
