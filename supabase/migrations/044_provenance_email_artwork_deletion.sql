-- Migration 044: provenance email invites + artwork soft-deletion
-- Run in Supabase SQL Editor

-- 1. Allow patron_id to be null (email-only invite before account creation)
ALTER TABLE provenance_links
  ALTER COLUMN patron_id DROP NOT NULL;

-- 2. Add email invite columns to provenance_links
ALTER TABLE provenance_links
  ADD COLUMN IF NOT EXISTS patron_email text,
  ADD COLUMN IF NOT EXISTS claim_token uuid DEFAULT gen_random_uuid() NOT NULL;

-- 3. Add 'invited' as valid status (if using check constraint, update it)
--    If status is plain text, no change needed.
--    Update existing pending rows to keep them valid.

-- 4. Soft-hide artwork from artist's profile without removing from patron's collection
ALTER TABLE artworks
  ADD COLUMN IF NOT EXISTS hidden_from_artist boolean NOT NULL DEFAULT false;

-- 5. Index for claim token lookup
CREATE UNIQUE INDEX IF NOT EXISTS provenance_links_claim_token_idx
  ON provenance_links (claim_token);

-- 6. Index for email lookup
CREATE INDEX IF NOT EXISTS provenance_links_patron_email_idx
  ON provenance_links (patron_email)
  WHERE patron_email IS NOT NULL;
