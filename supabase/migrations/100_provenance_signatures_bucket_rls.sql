-- Migration 100: RLS policies for the provenance-signatures private storage bucket
--
-- MANUAL STEP REQUIRED: Before running this migration, create the bucket in the
-- Supabase dashboard:
--   Storage → New bucket → Name: "provenance-signatures" → Public: OFF (disabled)
--
-- Once the bucket exists, run this migration in the SQL Editor.

CREATE POLICY "Users can read own signature"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'provenance-signatures'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload own signature"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'provenance-signatures'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can replace own signature"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'provenance-signatures'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own signature"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'provenance-signatures'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
