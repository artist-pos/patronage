-- 171: Allow engagement logging from the public site
-- /api/log-engagement inserts fire-and-forget analytics rows with the caller's
-- (anon or authenticated) key, but engagement_logs had no INSERT policy — every
-- logged view/play/share since launch has been silently dropped with
-- "new row violates row-level security policy" (see Supabase error logs).

DROP POLICY IF EXISTS "Anyone can log engagement" ON engagement_logs;

CREATE POLICY "Anyone can log engagement"
  ON engagement_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
