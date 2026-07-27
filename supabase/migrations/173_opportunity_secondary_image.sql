-- Second image for pipeline/detail-page hero (e.g. a utility/context shot alongside the main poster).
-- Shown only on the opportunity detail page hero as a 2-frame carousel; cards stay single-image.
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS secondary_image_url text;
