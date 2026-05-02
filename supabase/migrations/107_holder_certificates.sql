-- ============================================================
-- Migration 107: Holder-uploaded certificates (Phase 3)
--
-- Lets holder_uploaded artworks generate a Patronage provenance
-- certificate. Adds 'imported' to the transfer_method CHECK so the
-- 'created' ledger entry for a holder upload reads truthfully.
-- generate_ledger_id() (from migration 099) is reused as-is.
-- ============================================================

-- ── 1. transfer_method 'imported' ───────────────────────────────
-- Existing CHECK was: ('listing', 'stripe', 'claim', 'direct').

ALTER TABLE artwork_provenance_ledger
  DROP CONSTRAINT IF EXISTS artwork_provenance_ledger_transfer_method_check;

ALTER TABLE artwork_provenance_ledger
  ADD CONSTRAINT artwork_provenance_ledger_transfer_method_check
  CHECK (transfer_method IN ('listing', 'stripe', 'claim', 'direct', 'imported'));

-- ── 2. Backfill ledger entries for any pre-existing holder_uploaded rows ──
-- Phase 1 (migration 105) didn't mint ledger IDs. Catch up now so any vault
-- works added between migration 105 and 107 still get certificates.

DO $$
DECLARE
  art         RECORD;
  new_lid     TEXT;
  attempts    INT;
BEGIN
  FOR art IN
    SELECT id, creator_id, created_at
    FROM artworks
    WHERE source = 'holder_uploaded' AND ledger_id IS NULL
  LOOP
    attempts := 0;
    LOOP
      new_lid := generate_ledger_id();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM artworks WHERE ledger_id = new_lid);
      attempts := attempts + 1;
      IF attempts > 20 THEN
        RAISE EXCEPTION 'Could not generate unique ledger ID for artwork %', art.id;
      END IF;
    END LOOP;

    UPDATE artworks SET ledger_id = new_lid WHERE id = art.id;

    INSERT INTO artwork_provenance_ledger (
      artwork_id, ledger_id, entry_type,
      from_owner_id, to_owner_id,
      transfer_method, transferred_at
    ) VALUES (
      art.id, new_lid, 'created',
      NULL, art.creator_id,
      'imported', art.created_at
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
