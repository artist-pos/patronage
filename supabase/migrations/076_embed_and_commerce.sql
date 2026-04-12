-- portfolio_images: add embed support
ALTER TABLE portfolio_images
  ADD COLUMN IF NOT EXISTS embed_url      text,
  ADD COLUMN IF NOT EXISTS embed_provider text;

-- artworks: add commerce format
ALTER TABLE artworks
  ADD COLUMN IF NOT EXISTS commerce_format text
    CHECK (commerce_format IN ('Original', 'Digital Download', 'Print', 'Commission', 'Other'));
