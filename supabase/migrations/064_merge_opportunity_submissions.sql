-- 064: Merge opportunity_submissions into opportunities
--
-- opportunity_submissions was a staging table. After this migration:
--   status = 'pending'  → submitted by partner/public, awaiting admin review
--   status = 'rejected' → admin rejected the submission
--   status = 'draft_unclaimed' → admin created, no partner claimed yet
--   status = 'draft'    → partner claimed and is editing
--   status = 'published' → live on the site
--
-- 'approved' submissions already exist as published opportunities rows —
-- only 'pending' and 'rejected' rows need backfilling.

-- ── 1. Add submitter_email to opportunities ───────────────────────────────
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS submitter_email text DEFAULT NULL;

-- ── 2. Backfill pending/rejected submissions ──────────────────────────────
-- 'approved' rows were already copied to opportunities on admin approval,
-- so we skip them to avoid duplicates.
INSERT INTO opportunities (
  title, organiser, caption, full_description, type, country, city,
  opens_at, deadline, url, funding_amount, funding_range, sub_categories,
  grant_type, recipients_count, submitter_email, status, profile_id,
  entry_fee, artist_payment_type, travel_support, travel_support_details,
  routing_type, custom_fields, show_badges_in_submission, pipeline_config,
  is_featured, is_recurring, recurrence_pattern, recurrence_end_date,
  career_stage, tags, is_active, created_at
)
SELECT
  title, organiser, caption, full_description, type, country, city,
  opens_at, deadline, url, funding_amount, funding_range, sub_categories,
  grant_type, recipients_count, submitter_email, status, profile_id,
  entry_fee, artist_payment_type, travel_support, travel_support_details,
  routing_type, custom_fields, show_badges_in_submission, pipeline_config,
  is_featured, is_recurring, recurrence_pattern, recurrence_end_date,
  career_stage, tags, false, created_at
FROM opportunity_submissions
WHERE status != 'approved';

-- ── 3. RLS: allow profile owners to SELECT their own listings ─────────────
-- Previously missing — partners couldn't see their own draft/pending rows.
CREATE POLICY "opportunities_select_own"
  ON opportunities FOR SELECT
  USING (auth.uid() = profile_id);

-- ── 4. RLS: allow public INSERT for opportunity submissions ───────────────
-- Enforces status = 'pending' and is_active = false at the DB level.

-- Unauthenticated users (found an opportunity, no account)
CREATE POLICY "opportunities_insert_public_submission"
  ON opportunities FOR INSERT
  WITH CHECK (
    status = 'pending'
    AND is_active = false
    AND profile_id IS NULL
  );

-- Authenticated users who aren't partners (artists, patrons submitting opps)
-- Partners already have opportunities_insert_profile_owner from migration 025.
CREATE POLICY "opportunities_insert_authenticated_submission"
  ON opportunities FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending'
    AND is_active = false
    AND profile_id = auth.uid()
  );

-- ── 5. Drop opportunity_submissions ──────────────────────────────────────
DROP TABLE opportunity_submissions;
