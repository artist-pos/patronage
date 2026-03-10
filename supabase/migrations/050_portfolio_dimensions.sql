-- Add natural image dimensions to portfolio_images for justified layout
ALTER TABLE portfolio_images ADD COLUMN IF NOT EXISTS natural_width integer;
ALTER TABLE portfolio_images ADD COLUMN IF NOT EXISTS natural_height integer;
