-- Migration 133: editions table
-- A work (portfolio_images) has >= 1 edition. Each edition holds the price,
-- listing mode, and edition-specific metadata. The artworks table is kept in
-- sync via application logic until steps 4–7 migrate the display code.

CREATE TABLE editions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id        uuid        NOT NULL REFERENCES portfolio_images(id) ON DELETE CASCADE,
  type           text        NOT NULL DEFAULT 'original'
                             CHECK (type IN ('original', 'limited_edition', 'open_edition', 'product')),
  label          text        NOT NULL DEFAULT 'Original',
  edition_size   integer     CHECK (edition_size IS NULL OR edition_size > 0),
  edition_number integer     CHECK (edition_number IS NULL OR edition_number > 0),
  dimensions     text,
  substrate      text,
  price_cents    integer     CHECK (price_cents IS NULL OR price_cents >= 0),
  currency       text        NOT NULL DEFAULT 'NZD',
  poa            boolean     NOT NULL DEFAULT false,
  listing_mode   text        NOT NULL DEFAULT 'enquire'
                             CHECK (listing_mode IN ('direct', 'enquire')),
  listed         boolean     NOT NULL DEFAULT false,
  inventory      integer     CHECK (inventory IS NULL OR inventory >= 0),
  sort_order     integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX editions_work_id_idx  ON editions (work_id);
CREATE INDEX editions_listed_idx   ON editions (work_id, listed);

ALTER TABLE editions ENABLE ROW LEVEL SECURITY;

-- updated_at auto-maintenance
CREATE OR REPLACE FUNCTION set_editions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER editions_updated_at
  BEFORE UPDATE ON editions
  FOR EACH ROW EXECUTE FUNCTION set_editions_updated_at();

-- Public can read listed editions; artists can read all editions on their own works
CREATE POLICY "editions_select" ON editions FOR SELECT USING (
  listed = true
  OR EXISTS (
    SELECT 1 FROM portfolio_images
    WHERE portfolio_images.id = editions.work_id
      AND portfolio_images.profile_id = auth.uid()
  )
);

CREATE POLICY "editions_insert" ON editions FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM portfolio_images
    WHERE portfolio_images.id = work_id
      AND portfolio_images.profile_id = auth.uid()
  )
);

CREATE POLICY "editions_update" ON editions FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM portfolio_images
    WHERE portfolio_images.id = editions.work_id
      AND portfolio_images.profile_id = auth.uid()
  )
);

CREATE POLICY "editions_delete" ON editions FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM portfolio_images
    WHERE portfolio_images.id = editions.work_id
      AND portfolio_images.profile_id = auth.uid()
  )
);

-- Backfill: one 'original' edition per portfolio_images row.
-- If the row has a linked artworks record, copy price/currency/poa/listing_mode + availability.
-- Rows without a linked artwork get an unlisted original with no price.
INSERT INTO editions (
  work_id, type, label,
  price_cents, currency, poa,
  listing_mode, listed, sort_order
)
SELECT
  pi.id,
  'original',
  'Original',
  a.price_cents,
  COALESCE(a.price_currency, 'NZD'),
  COALESCE(a.is_poa, false),
  CASE WHEN a.listing_mode = 'direct_sale' THEN 'direct' ELSE 'enquire' END,
  COALESCE(a.is_available, false),
  0
FROM portfolio_images pi
LEFT JOIN artworks a ON a.id = pi.linked_artwork_id;
