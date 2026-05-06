-- Migration 118: store artwork price as integer cents
-- Replaces the free-text `price` column with:
--   price_cents integer    — null means no price set
--   is_poa boolean         — true = "Price on application"
--   price_parse_failed boolean — true = original text didn't parse; needs manual review

ALTER TABLE artworks
  ADD COLUMN IF NOT EXISTS price_cents        integer,
  ADD COLUMN IF NOT EXISTS is_poa             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_parse_failed boolean NOT NULL DEFAULT false;

-- Mark POA rows
UPDATE artworks
SET is_poa = true
WHERE price = 'POA';

-- Parse numeric prices (handles "1200", "1,200", "1200.50", "1,200.50", "  1200 ")
UPDATE artworks
SET price_cents = round(
  replace(replace(trim(price), ',', ''), ' ', '')::numeric * 100
)::integer
WHERE price IS NOT NULL
  AND price != 'POA'
  AND replace(replace(trim(price), ',', ''), ' ', '') ~ '^\d+(\.\d+)?$';

-- Flag anything that still didn't parse — needs manual review, not silently dropped
UPDATE artworks
SET price_parse_failed = true
WHERE price IS NOT NULL
  AND price != 'POA'
  AND is_poa = false
  AND price_cents IS NULL;

-- Drop the old text column
ALTER TABLE artworks DROP COLUMN IF EXISTS price;
