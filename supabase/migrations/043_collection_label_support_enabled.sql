-- Migration 043: collection_label on artworks, support_enabled on profiles, provenance_links table

ALTER TABLE artworks ADD COLUMN IF NOT EXISTS collection_label text DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS support_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS provenance_links (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id uuid NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  artist_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patron_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artwork_id, patron_id)
);
ALTER TABLE provenance_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "artists manage own provenance" ON provenance_links
  USING (artist_id = auth.uid());
CREATE POLICY "patrons view pending links" ON provenance_links
  FOR SELECT USING (patron_id = auth.uid());
