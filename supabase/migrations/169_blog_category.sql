-- 169: Blog post category (feature | data | essay)
-- The blog index card eyebrow was previously derived (featured artist →
-- FEATURE, otherwise ESSAY), which mislabels the data-journalism posts.
-- Posts left NULL keep the derived fallback in the UI.

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS category text
  CHECK (category IN ('feature', 'data', 'essay'));

-- Backfill the unambiguous cases
UPDATE blog_posts SET category = 'feature'
WHERE category IS NULL AND title ILIKE 'feature%';

UPDATE blog_posts SET category = 'data'
WHERE category IS NULL AND (
  slug ILIKE '%regional-arts-infrastructure%'
  OR slug ILIKE '%who-got-funded%'
  OR slug ILIKE '%how-arts-funding-works%'
  OR slug ILIKE '%underpaid-artists%'
);

UPDATE blog_posts SET category = 'essay'
WHERE category IS NULL AND slug ILIKE '%stopped-pitching-corporates%';
