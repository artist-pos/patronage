-- Add recurring schedule fields to opportunity_submissions so partners
-- can indicate recurrence when submitting a listing for review.

ALTER TABLE opportunity_submissions
  ADD COLUMN IF NOT EXISTS is_recurring        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_pattern  text
    CHECK (recurrence_pattern IN ('monthly','bimonthly','quarterly','biannual','annual','custom')),
  ADD COLUMN IF NOT EXISTS recurrence_end_date date;
