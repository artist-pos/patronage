-- Migration 117: structured medium classification for artworks
-- Adds medium_category (multi-select) and surface_or_substrate (single-select)
-- alongside the existing free-text medium field.

ALTER TABLE artworks
  ADD COLUMN IF NOT EXISTS medium_category      text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS surface_or_substrate text   DEFAULT NULL;

-- One-time conservative auto-classification from free-text medium.
-- Only classifies when the pattern is unambiguous.
-- Uncertain artworks are left NULL for manual review.

-- Painting
UPDATE artworks
SET medium_category = ARRAY['Painting']
WHERE medium_category IS NULL
  AND medium IS NOT NULL
  AND medium ~* '(acrylic|oil paint|watercolou?r|gouache|tempera|fresco)';

-- Drawing (exclude if also contains painting media)
UPDATE artworks
SET medium_category = ARRAY['Drawing']
WHERE medium_category IS NULL
  AND medium IS NOT NULL
  AND medium ~* '(pencil|charcoal|graphite|chalk crayon)'
  AND medium !~* '(acrylic|oil paint|watercolou?r|gouache)';

-- Photography
UPDATE artworks
SET medium_category = ARRAY['Photography']
WHERE medium_category IS NULL
  AND medium IS NOT NULL
  AND medium ~* '(photograph|photo print|c-print|archival print|silver gelatin|cibachrome|darkroom print)';

-- Printmaking
UPDATE artworks
SET medium_category = ARRAY['Printmaking']
WHERE medium_category IS NULL
  AND medium IS NOT NULL
  AND medium ~* '(etching|lithograph|screenprint|screen print|woodcut|linocut|linoprint|engraving|aquatint|monotype|monoprint|giclee|giclée|relief print)';

-- Ceramic
UPDATE artworks
SET medium_category = ARRAY['Ceramic']
WHERE medium_category IS NULL
  AND medium IS NOT NULL
  AND medium ~* '(ceramic|pottery|porcelain|stoneware|earthenware|terracotta|raku)';

-- Textile
UPDATE artworks
SET medium_category = ARRAY['Textile']
WHERE medium_category IS NULL
  AND medium IS NOT NULL
  AND medium ~* '(textile|weaving|woven |embroidery|embroidered|fibre art|fiber art|tapestry|needlepoint)';

-- Mixed Media (explicit term only)
UPDATE artworks
SET medium_category = ARRAY['Mixed Media']
WHERE medium_category IS NULL
  AND medium IS NOT NULL
  AND medium ~* 'mixed media';

-- Digital
UPDATE artworks
SET medium_category = ARRAY['Digital']
WHERE medium_category IS NULL
  AND medium IS NOT NULL
  AND medium ~* '(digital print|digital painting|digital art|generative art|algorithmic art|ai.generated|ai generated)';

-- Video
UPDATE artworks
SET medium_category = ARRAY['Video']
WHERE medium_category IS NULL
  AND medium IS NOT NULL
  AND medium ~* '(video art|video installation|single.channel video|moving image)';

-- Surface/substrate — only "on [surface]" phrasing to avoid false positives
UPDATE artworks
SET surface_or_substrate = 'Canvas'
WHERE surface_or_substrate IS NULL
  AND medium IS NOT NULL
  AND medium ~* ' on canvas';

UPDATE artworks
SET surface_or_substrate = 'Paper'
WHERE surface_or_substrate IS NULL
  AND medium IS NOT NULL
  AND medium ~* ' on (paper|card)';

UPDATE artworks
SET surface_or_substrate = 'Board'
WHERE surface_or_substrate IS NULL
  AND medium IS NOT NULL
  AND medium ~* ' on board';

UPDATE artworks
SET surface_or_substrate = 'Wood'
WHERE surface_or_substrate IS NULL
  AND medium IS NOT NULL
  AND medium ~* ' on (wood|timber|panel)';

UPDATE artworks
SET surface_or_substrate = 'Metal'
WHERE surface_or_substrate IS NULL
  AND medium IS NOT NULL
  AND medium ~* ' on (metal|steel|alumini.m|copper|zinc)';

UPDATE artworks
SET surface_or_substrate = 'Glass'
WHERE surface_or_substrate IS NULL
  AND medium IS NOT NULL
  AND medium ~* ' on glass';
