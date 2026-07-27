-- Migration 174: creative_work_ids array on opportunity_applications + drafts
-- Lets an artist submit multiple portfolio works per application (Step 3 "Portfolio
-- images" pick count, default 3), not just the single creative_work_id from
-- migration 147. creative_work_id is left in place and continues to hold the
-- first pick, for older single-work consumers.
-- No FK constraint on the array itself (Postgres can't FK individual array
-- elements without a junction table) — deleted creative_works simply become
-- stale ids here, same tradeoff already accepted for other array/jsonb columns.

ALTER TABLE opportunity_applications
  ADD COLUMN IF NOT EXISTS creative_work_ids uuid[];

ALTER TABLE opportunity_application_drafts
  ADD COLUMN IF NOT EXISTS creative_work_ids uuid[];
