-- Migration 068: Restore published status for opportunities that were incorrectly
-- downgraded to draft_unclaimed when a claim token was generated.
--
-- Distinguishing logic:
--   - createDraftUnclaimedListing() always sets is_active=false (intentional blank drafts)
--   - generateClaimToken() (old code) only set status=draft_unclaimed, never touched is_active
-- Therefore: draft_unclaimed + is_active=true → was previously published, needs restoring.

UPDATE opportunities
SET status = 'published'
WHERE status = 'draft_unclaimed'
  AND is_active = true;
