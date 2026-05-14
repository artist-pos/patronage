-- Migration 129: selected provenance entry type + campaign public page

-- ── #1: Add 'selected' to artwork_provenance_ledger entry_type CHECK ──────────
-- Follows same drop/recreate pattern as migration 110 (which added 'reverted').
ALTER TABLE artwork_provenance_ledger
  DROP CONSTRAINT IF EXISTS artwork_provenance_ledger_entry_type_check;
ALTER TABLE artwork_provenance_ledger
  ADD CONSTRAINT artwork_provenance_ledger_entry_type_check
  CHECK (entry_type IN ('created', 'transferred', 'resold', 'reverted', 'selected'));

-- ── #2: Campaign public page — is_public column + public read RLS ─────────────
-- Default true so all existing auto-created campaigns are public immediately.
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'campaigns' AND policyname = 'campaigns_public_read'
  ) THEN
    CREATE POLICY "campaigns_public_read" ON campaigns
      FOR SELECT USING (is_public = true);
  END IF;
END $$;
