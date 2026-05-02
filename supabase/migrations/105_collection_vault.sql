-- ============================================================
-- Migration 105: Collection vault (Phase 1)
--
-- Adds the role-agnostic "vault" — a workspace where any holder
-- (patron, partner, or artist) can register works they own but did
-- not necessarily create. Existing artworks are migrated to source
-- = 'self_registered'. New holder uploads use 'holder_uploaded'.
--
-- MANUAL STEP REQUIRED: in the Supabase dashboard, create the
-- bucket "artwork-source-documents" with Public: OFF before running
-- this migration. Path convention: {uploaded_by}/{artwork_id}/{filename}.
--
-- Notes on creator_id semantics:
--   - For self_registered works: creator_id is the artist (existing).
--   - For holder_uploaded works where the artist isn't on Patronage:
--     creator_id is set to the holder_id as a placeholder so existing
--     RLS (artworks_select / artworks_update_creator) keeps working.
--     The actual attribution lives in attributed_artist_text and
--     attributed_artist_id. Phase 2 (confirmation loop) updates
--     creator_id to the real artist when they confirm.
-- ============================================================

-- ── 1. artwork_source enum ──────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE artwork_source AS ENUM ('self_registered', 'holder_uploaded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. artworks columns ─────────────────────────────────────────

ALTER TABLE artworks
  ADD COLUMN IF NOT EXISTS source artwork_source NOT NULL DEFAULT 'self_registered',
  ADD COLUMN IF NOT EXISTS attributed_artist_text TEXT,
  ADD COLUMN IF NOT EXISTS attributed_artist_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS artworks_source_idx ON artworks(source);
CREATE INDEX IF NOT EXISTS artworks_attributed_artist_id_idx
  ON artworks(attributed_artist_id) WHERE attributed_artist_id IS NOT NULL;

-- ── 3. collection_membership ────────────────────────────────────

CREATE TABLE IF NOT EXISTS collection_membership (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_id                UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  artwork_id               UUID NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  is_public                BOOLEAN NOT NULL DEFAULT FALSE,
  position                 INT NOT NULL DEFAULT 0,
  date_acquired_text       TEXT,
  source_type              TEXT, -- 'directly_from_artist' | 'gallery' | 'auction' | 'gift' | 'inheritance' | 'other'
  source_name              TEXT,
  price_paid_amount        NUMERIC,
  price_paid_currency      TEXT,
  location_text            TEXT,
  show_location_publicly   BOOLEAN NOT NULL DEFAULT FALSE,
  certificate_statement    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (holder_id, artwork_id)
);

CREATE INDEX IF NOT EXISTS cm_holder_idx       ON collection_membership(holder_id);
CREATE INDEX IF NOT EXISTS cm_artwork_idx      ON collection_membership(artwork_id);
CREATE INDEX IF NOT EXISTS cm_holder_position  ON collection_membership(holder_id, position);
CREATE INDEX IF NOT EXISTS cm_holder_public    ON collection_membership(holder_id, is_public);

ALTER TABLE collection_membership ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cm_select_holder"      ON collection_membership;
DROP POLICY IF EXISTS "cm_select_public"      ON collection_membership;
DROP POLICY IF EXISTS "cm_insert_holder"      ON collection_membership;
DROP POLICY IF EXISTS "cm_update_holder"      ON collection_membership;
DROP POLICY IF EXISTS "cm_delete_holder"      ON collection_membership;

-- Holder can read their own rows (private dashboard).
CREATE POLICY "cm_select_holder"
  ON collection_membership FOR SELECT
  USING (holder_id = auth.uid());

-- Public read for is_public rows — Phase 4 reads via this. Safe to add now;
-- there are no public consumers yet.
CREATE POLICY "cm_select_public"
  ON collection_membership FOR SELECT
  USING (is_public = TRUE);

CREATE POLICY "cm_insert_holder"
  ON collection_membership FOR INSERT
  WITH CHECK (holder_id = auth.uid());

CREATE POLICY "cm_update_holder"
  ON collection_membership FOR UPDATE
  USING (holder_id = auth.uid())
  WITH CHECK (holder_id = auth.uid());

CREATE POLICY "cm_delete_holder"
  ON collection_membership FOR DELETE
  USING (holder_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_collection_membership_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cm_set_updated_at ON collection_membership;
CREATE TRIGGER cm_set_updated_at
  BEFORE UPDATE ON collection_membership
  FOR EACH ROW
  EXECUTE FUNCTION set_collection_membership_updated_at();

-- ── 4. artwork_source_documents ─────────────────────────────────

CREATE TABLE IF NOT EXISTS artwork_source_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id    UUID NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  uploaded_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  document_type TEXT NOT NULL, -- 'certificate' | 'invoice' | 'receipt' | 'other'
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS asd_artwork_idx     ON artwork_source_documents(artwork_id);
CREATE INDEX IF NOT EXISTS asd_uploaded_by_idx ON artwork_source_documents(uploaded_by);

ALTER TABLE artwork_source_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asd_select_uploader" ON artwork_source_documents;
DROP POLICY IF EXISTS "asd_insert_uploader" ON artwork_source_documents;
DROP POLICY IF EXISTS "asd_delete_uploader" ON artwork_source_documents;

-- Strictly private. Only the uploader can read/write/delete.
CREATE POLICY "asd_select_uploader"
  ON artwork_source_documents FOR SELECT
  USING (uploaded_by = auth.uid());

CREATE POLICY "asd_insert_uploader"
  ON artwork_source_documents FOR INSERT
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "asd_delete_uploader"
  ON artwork_source_documents FOR DELETE
  USING (uploaded_by = auth.uid());

-- ── 5. Storage policies for "artwork-source-documents" bucket ───
-- Path convention: {uploaded_by}/{artwork_id}/{filename}

DROP POLICY IF EXISTS "Users can upload own source docs" ON storage.objects;
CREATE POLICY "Users can upload own source docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'artwork-source-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can read own source docs" ON storage.objects;
CREATE POLICY "Users can read own source docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'artwork-source-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own source docs" ON storage.objects;
CREATE POLICY "Users can delete own source docs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'artwork-source-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── 6. Extend artwork_documentation_photos write policy ─────────
-- Existing policy (migration 104) limited writes to creator_id. For
-- holder_uploaded works, the registered owner is also a legitimate
-- writer. Add a parallel policy that allows the current_owner_id to
-- write when the artwork is holder_uploaded.

DROP POLICY IF EXISTS "adp_write_holder_owner" ON artwork_documentation_photos;
CREATE POLICY "adp_write_holder_owner"
  ON artwork_documentation_photos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM artworks a
       WHERE a.id = artwork_id
         AND a.source = 'holder_uploaded'
         AND a.current_owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artworks a
       WHERE a.id = artwork_id
         AND a.source = 'holder_uploaded'
         AND a.current_owner_id = auth.uid()
    )
  );

-- ── 7. Extend artwork_prior_history write policy ────────────────

DROP POLICY IF EXISTS "aph_write_holder_owner" ON artwork_prior_history;
CREATE POLICY "aph_write_holder_owner"
  ON artwork_prior_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM artworks a
       WHERE a.id = artwork_id
         AND a.source = 'holder_uploaded'
         AND a.current_owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artworks a
       WHERE a.id = artwork_id
         AND a.source = 'holder_uploaded'
         AND a.current_owner_id = auth.uid()
    )
  );
