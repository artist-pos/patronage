-- Gallery layout preferences stored per profile
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gallery_row_height integer NOT NULL DEFAULT 280,
  ADD COLUMN IF NOT EXISTS gallery_gutter     integer NOT NULL DEFAULT 6;
