-- Migration 176: drop the creative_works FK on opportunity_applications/drafts
-- creative_work_id/creative_work_ids were built against the `creative_works`
-- table, but that table turned out to be dead — it's only ever written by
-- CreativeWorksPanel, rendered from StudioTab, which hasn't been reachable
-- from the profile UI since Studio was merged into the Work tab. Real
-- portfolio works live in `artworks` (is_available = false), same as
-- artwork_id. These columns now store artworks.id values instead, so the FK
-- to creative_works(id) must go (the array column was already unconstrained).
-- Column names are unchanged to avoid touching anything already migrated.

ALTER TABLE opportunity_applications
  DROP CONSTRAINT IF EXISTS opportunity_applications_creative_work_id_fkey;

ALTER TABLE opportunity_application_drafts
  DROP CONSTRAINT IF EXISTS opportunity_application_drafts_creative_work_id_fkey;
