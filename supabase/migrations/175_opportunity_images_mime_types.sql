-- Migration 175: widen opportunity-images bucket MIME allowlist
-- The bucket was created image-only (migration 009), but several features already
-- upload non-image files into it and assume it accepts them:
--   - PartnerDocumentsUploader ("Assessor documents", briefs/ prefix) — PDF/Word
--   - ApplyModal file_upload question answers (answers/ prefix) — PDF/Word/tiff/mp4/mp3
--   - TermsUploader (terms/ prefix, new) — PDF
-- All three have been rejected by Supabase Storage with "mime type not supported"
-- for anything but jpeg/png/webp. Widen the allowlist to match what the UI already
-- claims to accept.

UPDATE storage.buckets
SET allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'video/mp4',
  'audio/mpeg'
]
WHERE id = 'opportunity-images';
