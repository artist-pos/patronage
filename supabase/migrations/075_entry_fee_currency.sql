-- Migration 075: entry fee currency fields
-- entry_fee stays as the NZD equivalent (existing behaviour)
-- entry_fee_currency: ISO 4217 code of the original currency (default NZD)
-- entry_fee_local: original amount in entry_fee_currency (null when NZD)

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS entry_fee_currency text DEFAULT 'NZD',
  ADD COLUMN IF NOT EXISTS entry_fee_local numeric;
