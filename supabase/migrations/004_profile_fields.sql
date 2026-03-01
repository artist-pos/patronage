-- =============================================================
-- Patronage — Migration 004: Extended Profile Fields + Portfolio Captions
-- Run in: Supabase SQL Editor
-- =============================================================

-- ── New profile columns ────────────────────────────────────────

alter table profiles
  add column if not exists featured_image_url text,
  add column if not exists website_url        text,
  add column if not exists instagram_handle   text;

-- ── Portfolio image captions ───────────────────────────────────

alter table portfolio_images
  add column if not exists caption text;

-- Owner can update their own portfolio image captions
create policy "portfolio_images_update_own"
  on portfolio_images for update
  using (auth.uid() = profile_id);

-- ── Storage: allow owner to overwrite (upsert) files ──────────

-- Portfolio: owner can update/overwrite their own files
create policy "portfolio_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'portfolio'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'portfolio'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
