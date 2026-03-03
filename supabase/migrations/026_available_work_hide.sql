-- Add hide_available flag so artists can soft-hide a listed work from public view
-- without fully unlisting it (is_available stays true).

ALTER TABLE portfolio_images
  ADD COLUMN hide_available boolean NOT NULL DEFAULT false;
