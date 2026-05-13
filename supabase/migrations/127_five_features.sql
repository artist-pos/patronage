-- Migration 127: Five-feature build
-- Run this entire file in Supabase SQL Editor before enabling new app features.

-- ── Feature 1: campaigns additions ──────────────────────────────────────────
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cover_image_url text;

-- ── Feature 2: artwork acquisition mode ─────────────────────────────────────
ALTER TABLE artworks
  ADD COLUMN IF NOT EXISTS acquisition_mode text DEFAULT 'enquire_first';

-- ── Feature 2: projects columns ──────────────────────────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS artwork_id uuid REFERENCES artworks(id) ON DELETE SET NULL;

-- Race-safe unique constraint for pipeline project upsert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'projects_artist_opportunity_unique'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_artist_opportunity_unique
      UNIQUE (artist_id, opportunity_id);
  END IF;
END $$;

-- ── Feature 2: project_updates tag + title ────────────────────────────────
ALTER TABLE project_updates
  ADD COLUMN IF NOT EXISTS update_tag text DEFAULT 'update',
  ADD COLUMN IF NOT EXISTS title text;

-- ── Feature 2: provenance ledger — selected entry type ───────────────────
ALTER TABLE artwork_provenance_ledger
  ADD COLUMN IF NOT EXISTS source_opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL;

-- ── Feature 4: artwork physical dimensions for justified grid ────────────
ALTER TABLE artworks
  ADD COLUMN IF NOT EXISTS width_mm integer,
  ADD COLUMN IF NOT EXISTS height_mm integer;

-- ── Feature 4: embed config on profiles ──────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS patron_embed_config jsonb;

-- ── Feature 5: community chat tables ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_channels (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text        UNIQUE NOT NULL,
  name        text        NOT NULL,
  description text,
  sort_order  integer     DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id      uuid        REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_id       uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  body            text,
  attachment_type text,
  attachment_id   uuid,
  attachment_meta jsonb,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_channel_created
  ON chat_messages(channel_id, created_at DESC);

ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_channels' AND policyname = 'chat_channels_public_read'
  ) THEN
    CREATE POLICY "chat_channels_public_read" ON chat_channels FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'chat_messages_public_read'
  ) THEN
    CREATE POLICY "chat_messages_public_read" ON chat_messages FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'chat_messages_auth_insert'
  ) THEN
    CREATE POLICY "chat_messages_auth_insert" ON chat_messages FOR INSERT
      WITH CHECK (auth.uid() = sender_id);
  END IF;
END $$;

-- Seed regional channels
INSERT INTO chat_channels (slug, name, description, sort_order) VALUES
  ('general',      'General',      'Open to everyone on Patronage',      1),
  ('auckland',     'Auckland',     'Tāmaki Makaurau',                    2),
  ('waikato',      'Waikato',      'Kirikiriroa Hamilton and surrounds', 3),
  ('wellington',   'Wellington',   'Te Whanganui-a-Tara',                4),
  ('christchurch', 'Christchurch', 'Ōtautahi',                           5)
ON CONFLICT (slug) DO NOTHING;
