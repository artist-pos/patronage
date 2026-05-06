-- ============================================================
-- Migration 119: Sale revert infrastructure
--
-- 1. primary_sale_transactions: add reverted_by (admin who actioned it)
-- 2. artwork_provenance_ledger: add metadata jsonb + extend entry_type
--    CHECK to include 'reverted'
-- ============================================================

-- 1. Track which admin reverted a primary sale
ALTER TABLE primary_sale_transactions
  ADD COLUMN IF NOT EXISTS reverted_by UUID REFERENCES profiles(id);

-- 2. Add metadata JSONB to provenance ledger (stores reverted_by_admin_id,
--    reverted_reason, etc. for the 'reverted' entry type)
ALTER TABLE artwork_provenance_ledger
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 3. Extend the entry_type CHECK constraint to include 'reverted'
ALTER TABLE artwork_provenance_ledger
  DROP CONSTRAINT IF EXISTS artwork_provenance_ledger_entry_type_check;

ALTER TABLE artwork_provenance_ledger
  ADD CONSTRAINT artwork_provenance_ledger_entry_type_check
  CHECK (entry_type IN ('created', 'transferred', 'resold', 'reverted'));
