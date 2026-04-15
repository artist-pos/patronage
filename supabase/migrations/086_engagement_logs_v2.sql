-- Migration 086: Extend engagement_logs
-- Adds campaign_id for future attribution and expands the event_type
-- CHECK constraint to cover the full V1.5 event set.

-- campaign_id — nullable, reserved for future campaign attribution
ALTER TABLE public.engagement_logs
  ADD COLUMN IF NOT EXISTS campaign_id uuid;

CREATE INDEX IF NOT EXISTS idx_engagement_campaign ON engagement_logs(campaign_id);

-- Extend event_type to include the full V1.5 set.
-- Postgres requires DROP + ADD for CHECK constraints (no ALTER CONSTRAINT).
ALTER TABLE public.engagement_logs
  DROP CONSTRAINT IF EXISTS engagement_logs_event_type_check;

ALTER TABLE public.engagement_logs
  ADD CONSTRAINT engagement_logs_event_type_check
  CHECK (event_type IN (
    'view', 'play', 'enquiry', 'share',
    'scan', 'commerce_click', 'email_capture',
    'follow_click', 'profile_click', 'work_click'
  ));

-- Tighten INSERT policy: only allow valid work_ids (FK already enforces this
-- at the DB level but an explicit RLS check makes the intent clear).
DROP POLICY IF EXISTS "Anyone can log engagement" ON public.engagement_logs;

CREATE POLICY "Anyone can log engagement"
  ON public.engagement_logs FOR INSERT
  WITH CHECK (
    work_id IS NULL
    OR work_id IN (SELECT id FROM public.portfolio_images)
  );
