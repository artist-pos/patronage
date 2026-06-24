-- 164: Multiple labelled application links per opportunity.
-- Each entry is { "label": string, "url": string } and renders as its own
-- button on the public listing. The legacy single `url` column stays populated
-- from the first link for cards, SEO, and schema.org — so existing rows (which
-- only have `url`) keep working with an empty array here.

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS application_links jsonb NOT NULL DEFAULT '[]'::jsonb;
