-- 1. New artworks table for marketplace items (available + sold)
CREATE TABLE artworks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  creator_id        uuid NOT NULL REFERENCES profiles(id),
  current_owner_id  uuid NOT NULL REFERENCES profiles(id),
  url               text NOT NULL,
  caption           text,
  price             text,
  description       text,
  is_available      boolean NOT NULL DEFAULT true,
  hide_available    boolean NOT NULL DEFAULT false,
  hide_from_archive boolean NOT NULL DEFAULT false,
  hide_price        boolean NOT NULL DEFAULT false,
  collection_visible boolean NOT NULL DEFAULT true,
  position          integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE artworks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "artworks_select" ON artworks FOR SELECT
  USING (is_available = true OR creator_id = auth.uid() OR current_owner_id = auth.uid());

CREATE POLICY "artworks_insert" ON artworks FOR INSERT
  WITH CHECK (creator_id = auth.uid() AND profile_id = auth.uid());

CREATE POLICY "artworks_update_creator" ON artworks FOR UPDATE
  USING (creator_id = auth.uid());

CREATE POLICY "artworks_update_owner" ON artworks FOR UPDATE
  USING (current_owner_id = auth.uid());

CREATE POLICY "artworks_delete" ON artworks FOR DELETE
  USING (creator_id = auth.uid() AND current_owner_id = auth.uid());

-- 2. Migrate available + sold rows from portfolio_images, preserving UUIDs.
-- Include any row ever referenced in messages (e.g. unlisted works) so the FK add succeeds.
INSERT INTO artworks (
  id, profile_id, creator_id, current_owner_id,
  url, caption, price, description,
  is_available, hide_available, hide_from_archive, hide_price, collection_visible,
  position, created_at
)
SELECT
  id, profile_id, creator_id, current_owner_id,
  url, caption, price, description,
  is_available, hide_available, hide_from_archive, hide_price, collection_visible,
  position, created_at
FROM portfolio_images
WHERE is_available = true
   OR current_owner_id != creator_id
   OR id IN (SELECT work_id FROM messages WHERE work_id IS NOT NULL);

-- 3. Fix messages FK: drop RESTRICT default, add SET NULL
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_work_id_fkey;
ALTER TABLE messages
  ADD CONSTRAINT messages_work_id_fkey
  FOREIGN KEY (work_id) REFERENCES artworks(id) ON DELETE SET NULL;

-- 4. Remove migrated rows from portfolio_images
DELETE FROM portfolio_images
WHERE is_available = true
   OR current_owner_id != creator_id
   OR id IN (SELECT work_id FROM messages WHERE work_id IS NOT NULL);
