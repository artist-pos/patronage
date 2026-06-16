-- Persisted thumbnails for grid/feed images.
--
-- Grids (portfolio, available works, studio feed) were loading full-resolution
-- originals — a profile measured ~7.5 MB of images, starving the LCP banner to
-- ~3.2s. We now generate a small thumbnail once at upload and store its URL, so
-- grids serve a static CDN file (free, fast) and the full image is only loaded
-- in detail/lightbox views.
--
-- thumb_url is nullable: rows uploaded before this (or where the thumb upload
-- failed) fall back to a read-time transform of the original at render time, so
-- there are never broken or full-res images. A one-off backfill populates
-- existing rows (see /api/admin/backfill-thumbs).

alter table public.artworks        add column if not exists thumb_url text;
alter table public.project_updates  add column if not exists thumb_url text;
