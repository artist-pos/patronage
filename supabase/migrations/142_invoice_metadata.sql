ALTER TABLE opportunity_applications
  ADD COLUMN IF NOT EXISTS invoice_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS invoice_paid_at TIMESTAMPTZ;
