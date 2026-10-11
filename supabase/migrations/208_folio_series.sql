-- School folios as series. A Year 13 tri-fold becomes a series whose cover is the
-- whole folio and whose panels sit inside it.
--
-- Panels live in their own table, not in `artworks`: artworks is the marketplace
-- table, and a folio's panels must never count toward Verified, be sellable, or
-- appear in the shop, feed or directory.
ALTER TABLE series
  ADD COLUMN IF NOT EXISTS series_type text NOT NULL DEFAULT 'standard'
    CHECK (series_type IN ('standard', 'folio')),
  ADD COLUMN IF NOT EXISTS folio_subject text
    CHECK (folio_subject IS NULL OR folio_subject IN ('art', 'design', 'photography', 'other')),
  ADD COLUMN IF NOT EXISTS identifiers_cleared boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS people_consent boolean NOT NULL DEFAULT false;

-- A folio cannot exist without both confirmations: candidate numbers, school
-- names and grades are covered, and nobody identifiable is shown without agreeing.
ALTER TABLE series DROP CONSTRAINT IF EXISTS series_folio_confirmed;
ALTER TABLE series ADD CONSTRAINT series_folio_confirmed
  CHECK (series_type <> 'folio' OR (identifiers_cleared AND people_consent));

CREATE TABLE IF NOT EXISTS series_folio_images (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id  uuid NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  url        text NOT NULL,
  kind       text NOT NULL DEFAULT 'panel' CHECK (kind IN ('panel', 'detail')),
  position   int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS series_folio_images_series_idx ON series_folio_images (series_id, position);

ALTER TABLE series_folio_images ENABLE ROW LEVEL SECURITY;

-- Readable like the series it belongs to (the page itself decides who reaches it).
-- Writes happen only through server actions with the service role.
DROP POLICY IF EXISTS "series_folio_images_select" ON series_folio_images;
CREATE POLICY "series_folio_images_select" ON series_folio_images FOR SELECT USING (true);
