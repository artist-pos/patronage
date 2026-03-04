-- Allow public reads of sold/transferred artworks unless the artist has
-- explicitly hidden them with hide_from_archive.
-- Available works were already public (is_available = true).
-- App-level flags (hide_sold_section, collection_public, collection_visible)
-- continue to control what's displayed in the UI.

DROP POLICY IF EXISTS "artworks_select" ON artworks;

CREATE POLICY "artworks_select" ON artworks FOR SELECT
  USING (
    is_available = true
    OR NOT hide_from_archive
    OR creator_id = auth.uid()
    OR current_owner_id = auth.uid()
  );
