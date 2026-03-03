-- Migration 023: Provenance, Transfer & Privacy System
-- Run manually in Supabase SQL Editor

-- ── portfolio_images additions ──────────────────────────────────────────────

ALTER TABLE portfolio_images
  ADD COLUMN creator_id uuid REFERENCES profiles(id),
  ADD COLUMN current_owner_id uuid REFERENCES profiles(id),
  ADD COLUMN hide_from_archive boolean NOT NULL DEFAULT false,
  ADD COLUMN hide_price boolean NOT NULL DEFAULT false,
  ADD COLUMN collection_visible boolean NOT NULL DEFAULT true;

-- Backfill from existing profile_id
UPDATE portfolio_images SET creator_id = profile_id, current_owner_id = profile_id;

ALTER TABLE portfolio_images
  ALTER COLUMN creator_id SET NOT NULL,
  ALTER COLUMN current_owner_id SET NOT NULL;

-- ── messages additions ───────────────────────────────────────────────────────

ALTER TABLE messages
  ADD COLUMN message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN work_id uuid REFERENCES portfolio_images(id);

-- ── profiles additions ───────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN hide_sold_section boolean NOT NULL DEFAULT false,
  ADD COLUMN collection_public boolean NOT NULL DEFAULT true;
