-- Metadata on portfolio_images
ALTER TABLE portfolio_images
  ADD COLUMN IF NOT EXISTS title      text,
  ADD COLUMN IF NOT EXISTS year       int4,
  ADD COLUMN IF NOT EXISTS medium     text,
  ADD COLUMN IF NOT EXISTS dimensions text,
  -- tracks the artworks row created when artist lists this work for sale
  ADD COLUMN IF NOT EXISTS linked_artwork_id uuid REFERENCES artworks(id) ON DELETE SET NULL;

-- Metadata on artworks
ALTER TABLE artworks
  ADD COLUMN IF NOT EXISTS title      text,
  ADD COLUMN IF NOT EXISTS year       int4,
  ADD COLUMN IF NOT EXISTS medium     text,
  ADD COLUMN IF NOT EXISTS dimensions text,
  ADD COLUMN IF NOT EXISTS edition    text;  -- e.g. "1/5", "AP 2/3", "unique"

-- Additional images per work (supports both portfolio_images and artworks)
CREATE TABLE IF NOT EXISTS work_images (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_image_id   uuid        REFERENCES portfolio_images(id) ON DELETE CASCADE,
  artwork_id           uuid        REFERENCES artworks(id) ON DELETE CASCADE,
  url                  text        NOT NULL,
  caption              text,
  position             integer     NOT NULL DEFAULT 0,
  is_primary           boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_images_single_source CHECK (
    (portfolio_image_id IS NULL) != (artwork_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS work_images_portfolio_image_id_idx ON work_images(portfolio_image_id);
CREATE INDEX IF NOT EXISTS work_images_artwork_id_idx ON work_images(artwork_id);

ALTER TABLE work_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work_images_select" ON work_images FOR SELECT USING (true);
CREATE POLICY "work_images_insert_portfolio" ON work_images FOR INSERT WITH CHECK (
  portfolio_image_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM portfolio_images WHERE id = portfolio_image_id AND creator_id = auth.uid()
  )
);
CREATE POLICY "work_images_insert_artwork" ON work_images FOR INSERT WITH CHECK (
  artwork_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM artworks WHERE id = artwork_id AND creator_id = auth.uid()
  )
);
CREATE POLICY "work_images_update" ON work_images FOR UPDATE USING (
  (portfolio_image_id IS NOT NULL AND EXISTS (SELECT 1 FROM portfolio_images WHERE id = portfolio_image_id AND creator_id = auth.uid()))
  OR (artwork_id IS NOT NULL AND EXISTS (SELECT 1 FROM artworks WHERE id = artwork_id AND creator_id = auth.uid()))
);
CREATE POLICY "work_images_delete" ON work_images FOR DELETE USING (
  (portfolio_image_id IS NOT NULL AND EXISTS (SELECT 1 FROM portfolio_images WHERE id = portfolio_image_id AND creator_id = auth.uid()))
  OR (artwork_id IS NOT NULL AND EXISTS (SELECT 1 FROM artworks WHERE id = artwork_id AND creator_id = auth.uid()))
);
