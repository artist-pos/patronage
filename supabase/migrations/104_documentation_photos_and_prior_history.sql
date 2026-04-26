-- ============================================================
-- Migration 104: Documentation photos + pre-platform history
--
-- Two new tables that hang off `artworks`:
--
--   artwork_documentation_photos — verso, signature, scale, detail
--   shots stored privately. Visible only to the creator and the
--   current owner of the work. Storage lives in the new bucket
--   "artwork-documentation" (private; create in dashboard before
--   running this migration).
--
--   artwork_prior_history — self-attested events that happened
--   before the artwork was registered on Patronage (exhibitions,
--   prior sales, commissions). Public, like the rest of the
--   provenance page.
--
-- MANUAL STEP REQUIRED: in the Supabase dashboard, create the
-- bucket "artwork-documentation" with Public: OFF before running
-- this migration. RLS policies for that bucket are defined below.
-- ============================================================

-- ── Documentation photos ────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE artwork_doc_photo_type AS ENUM ('verso', 'signature', 'scale', 'detail', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS artwork_documentation_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id    UUID NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  type          artwork_doc_photo_type NOT NULL,
  storage_path  TEXT NOT NULL,
  caption       TEXT,
  position      INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS adp_artwork_idx      ON artwork_documentation_photos(artwork_id);
CREATE INDEX IF NOT EXISTS adp_artwork_type_idx ON artwork_documentation_photos(artwork_id, type, position);

ALTER TABLE artwork_documentation_photos ENABLE ROW LEVEL SECURITY;

-- Read: only the artist (creator) or the current owner of the work.
DROP POLICY IF EXISTS "adp_read_creator_or_owner" ON artwork_documentation_photos;
CREATE POLICY "adp_read_creator_or_owner"
  ON artwork_documentation_photos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM artworks a
       WHERE a.id = artwork_id
         AND (a.creator_id = auth.uid() OR a.current_owner_id = auth.uid())
    )
  );

-- Write: only the artist (creator). Owners cannot edit.
DROP POLICY IF EXISTS "adp_write_creator" ON artwork_documentation_photos;
CREATE POLICY "adp_write_creator"
  ON artwork_documentation_photos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM artworks a
       WHERE a.id = artwork_id AND a.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artworks a
       WHERE a.id = artwork_id AND a.creator_id = auth.uid()
    )
  );

-- ── Storage bucket policies for "artwork-documentation" ──
-- Path convention: {creator_id}/{artwork_id}/{filename}

DROP POLICY IF EXISTS "Users can upload own doc photos" ON storage.objects;
CREATE POLICY "Users can upload own doc photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'artwork-documentation'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can read own doc photos" ON storage.objects;
CREATE POLICY "Users can read own doc photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'artwork-documentation'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own doc photos" ON storage.objects;
CREATE POLICY "Users can delete own doc photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'artwork-documentation'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
-- The provenance page resolves signed URLs server-side via the admin client,
-- so owners (who don't own the storage path) read through that route — no
-- bucket-level read policy needed for them.

-- ── Pre-platform / prior history ────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE artwork_prior_history_type AS ENUM (
    'exhibited', 'sold', 'gifted', 'commissioned', 'published', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS artwork_prior_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id   UUID NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  type         artwork_prior_history_type NOT NULL,
  description  TEXT NOT NULL,
  date_text    TEXT,         -- free-text date as written ("c. 1985", "Spring 2003")
  year_int     INT,          -- best-effort sortable year, may be null
  position     INT  NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aph_artwork_idx       ON artwork_prior_history(artwork_id);
CREATE INDEX IF NOT EXISTS aph_artwork_year_idx  ON artwork_prior_history(artwork_id, year_int, position);

ALTER TABLE artwork_prior_history ENABLE ROW LEVEL SECURITY;

-- Public read — provenance is a public record.
DROP POLICY IF EXISTS "aph_public_read" ON artwork_prior_history;
CREATE POLICY "aph_public_read"
  ON artwork_prior_history FOR SELECT USING (true);

-- Write: only the artist (creator).
DROP POLICY IF EXISTS "aph_write_creator" ON artwork_prior_history;
CREATE POLICY "aph_write_creator"
  ON artwork_prior_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM artworks a
       WHERE a.id = artwork_id AND a.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artworks a
       WHERE a.id = artwork_id AND a.creator_id = auth.uid()
    )
  );
