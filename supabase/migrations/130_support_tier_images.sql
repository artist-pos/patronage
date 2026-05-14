ALTER TABLE support_tiers
  ADD COLUMN IF NOT EXISTS tier_image_url text;
