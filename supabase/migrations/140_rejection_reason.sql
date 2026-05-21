ALTER TABLE opportunity_applications
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reply_sent_at TIMESTAMPTZ;
