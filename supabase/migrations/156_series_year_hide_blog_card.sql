-- Add explicit year to series (previously inferred from created_at)
ALTER TABLE public.series
  ADD COLUMN IF NOT EXISTS year integer;

-- Allow artists to hide the "Featured on Patronage" blog card from their profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hide_blog_card boolean NOT NULL DEFAULT false;
