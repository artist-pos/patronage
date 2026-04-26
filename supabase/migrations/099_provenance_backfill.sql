-- ============================================================
-- Migration 099: Backfill ledger IDs for existing artworks
-- Assigns PTRN-YYYY-XXXX-XXXX IDs and creates initial 'created'
-- ledger entries for all artworks that don't have one yet.
-- Character pool: A-Z (minus O, I, L) + 2-9 (minus 0, 1) = 31 chars
-- ============================================================

CREATE OR REPLACE FUNCTION generate_ledger_id() RETURNS TEXT AS $$
DECLARE
  chars       TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  seg         TEXT := '';
  i           INT;
  year_part   TEXT;
BEGIN
  year_part := EXTRACT(YEAR FROM NOW())::TEXT;
  FOR i IN 1..8 LOOP
    seg := seg || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
  END LOOP;
  RETURN 'PTRN-' || year_part || '-' || substr(seg, 1, 4) || '-' || substr(seg, 5, 4);
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  art         RECORD;
  new_lid     TEXT;
  attempts    INT;
BEGIN
  FOR art IN
    SELECT id, creator_id, created_at FROM artworks WHERE ledger_id IS NULL
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

    -- Initial 'created' entry (only if one doesn't already exist)
    IF NOT EXISTS (
      SELECT 1 FROM artwork_provenance_ledger
      WHERE artwork_id = art.id AND entry_type = 'created'
    ) THEN
      INSERT INTO artwork_provenance_ledger (
        artwork_id, ledger_id, entry_type,
        from_owner_id, to_owner_id,
        transfer_method, transferred_at
      ) VALUES (
        art.id, new_lid, 'created',
        NULL, art.creator_id,
        'listing', art.created_at
      );
    END IF;
  END LOOP;
END $$;
