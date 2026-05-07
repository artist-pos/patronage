-- Add spotlight_until to blog_posts so that writing an artist feature post
-- automatically surfaces that artist in the spotlight section of the Artists page
-- until the chosen date.
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS spotlight_until date;
