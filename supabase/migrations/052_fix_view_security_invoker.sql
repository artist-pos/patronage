-- Migration 052: Fix opportunity_save_counts view security
--
-- Supabase flagged this view as SECURITY DEFINER (the default for views in Postgres),
-- meaning it runs with the view creator's permissions and bypasses RLS.
--
-- Fix: switch to SECURITY INVOKER so the view respects the querying user's RLS context.
--
-- Side effect: the existing RLS policy on user_saved_opportunities only allows users
-- to see their own rows (USING user_id = auth.uid()), which would make the aggregate
-- count return 1 or 0 per user instead of the true total across all users.
--
-- Resolution: add a separate SELECT-only policy allowing any authenticated or
-- anonymous user to read all rows for counting purposes. INSERT/UPDATE/DELETE
-- remain restricted to the owner via the existing "users manage own saves" policy.

ALTER VIEW public.opportunity_save_counts SET (security_invoker = on);

-- Allow any role to read save counts (rows contain opportunity_id + user_id only;
-- the view surfaces only aggregated counts, not individual user_ids).
CREATE POLICY "read save counts"
  ON user_saved_opportunities
  FOR SELECT
  USING (true);
