-- Artist tag + NZ-time scheduling for blog posts
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS featured_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
