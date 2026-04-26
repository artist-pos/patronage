-- ============================================================
-- Migration 102: Provenance certificate theme customisation
-- Lets artists customise within the locked preset (Minimal /
-- Editorial / Gallery): primary + accent colour, font pairing,
-- and page orientation. Background, layout, and footer stay
-- locked so certificates remain recognisably Patronage.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS provenance_primary_color TEXT,
  ADD COLUMN IF NOT EXISTS provenance_accent_color  TEXT,
  ADD COLUMN IF NOT EXISTS provenance_font_pair     TEXT
    DEFAULT 'classic'
    CHECK (provenance_font_pair IN (
      'classic',     -- serif heading, serif body
      'modern',      -- sans heading, sans body
      'mixed',       -- serif heading, sans body
      'inverse',     -- sans heading, serif body
      'editorial',   -- bold serif heading, light serif body
      'mono',        -- mono heading, sans body
      'condensed',   -- condensed sans heading, sans body
      'display'      -- display serif heading, sans body
    )),
  ADD COLUMN IF NOT EXISTS provenance_orientation   TEXT
    DEFAULT 'portrait'
    CHECK (provenance_orientation IN ('portrait', 'landscape'));

-- Sane defaults: primary = black, accent = mid-grey
UPDATE profiles
   SET provenance_primary_color = COALESCE(provenance_primary_color, '#000000'),
       provenance_accent_color  = COALESCE(provenance_accent_color,  '#888888')
 WHERE provenance_primary_color IS NULL
    OR provenance_accent_color  IS NULL;
