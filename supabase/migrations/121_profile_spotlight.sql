-- Adds is_spotlight flag to profiles for the weekly featured artist spotlight on the Artists page.
-- Set to true on one artist at a time via the Supabase dashboard or admin tooling.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_spotlight boolean NOT NULL DEFAULT false;
