-- Migration 030: Scraper review queue
-- Adds status (pending/published/rejected) and source_url to opportunities.
-- Changes country from enum to text so scraped opps can use UK, US, EU, etc.
-- Updates RLS so only published items are public; adds admin SELECT policy.

-- 1. Add status column (existing rows default to 'published' so nothing breaks)
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS source_url text;

-- 2. Change country from country_enum to text (allows any country string)
ALTER TABLE opportunities
  ALTER COLUMN country TYPE text USING country::text;

-- 3. Update public SELECT policy to only show published items
DROP POLICY IF EXISTS "opportunities_select_public" ON opportunities;
CREATE POLICY "opportunities_select_public" ON opportunities FOR SELECT
  USING (
    status = 'published'
    AND is_active = true
    AND (deadline IS NULL OR deadline >= current_date)
  );

-- 4. Add admin SELECT policy so admins can see all statuses
DROP POLICY IF EXISTS "opportunities_select_admin" ON opportunities;
CREATE POLICY "opportunities_select_admin" ON opportunities FOR SELECT
  USING (is_admin());
