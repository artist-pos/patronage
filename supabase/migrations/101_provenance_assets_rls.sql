-- Migration 101: RLS policies for the provenance-assets storage bucket (logos)
--
-- The provenance-assets bucket stores artist logos for certificates.
-- It should be PUBLIC (public access ON) so certificate PDFs can embed the logo URL.
-- Files are stored at {userId}/logo.{ext} — ownership checked via name LIKE pattern.

DROP POLICY IF EXISTS "Artists can upload own provenance logo" ON storage.objects;
DROP POLICY IF EXISTS "Artists can replace own provenance logo" ON storage.objects;
DROP POLICY IF EXISTS "Artists can delete own provenance logo" ON storage.objects;

CREATE POLICY "provenance_assets_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'provenance-assets'
    AND name LIKE (auth.uid()::text || '/%')
  );

CREATE POLICY "provenance_assets_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'provenance-assets'
    AND name LIKE (auth.uid()::text || '/%')
  );

CREATE POLICY "provenance_assets_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'provenance-assets'
    AND name LIKE (auth.uid()::text || '/%')
  );
