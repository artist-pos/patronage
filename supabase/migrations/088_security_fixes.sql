-- Migration 088: Security fixes
-- H1: Token-based unsubscribe (replaces email-based query param)
-- H5: Fix collective_email_invitations RLS (token lookups use admin client)

-- ── H1: subscribers.unsubscribe_token ───────────────────────────────────────

ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS unsubscribe_token uuid DEFAULT gen_random_uuid();

-- Backfill any rows that somehow got a NULL (defensive)
UPDATE public.subscribers
  SET unsubscribe_token = gen_random_uuid()
  WHERE unsubscribe_token IS NULL;

ALTER TABLE public.subscribers
  ALTER COLUMN unsubscribe_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_unsubscribe_token
  ON public.subscribers(unsubscribe_token);

-- ── H5: collective_email_invitations — restrict SELECT to inviter only ───────
-- Token-based claim lookups are performed server-side via admin client;
-- they do not rely on RLS. Remove the open USING (true) policy.

DROP POLICY IF EXISTS "Public token lookup" ON public.collective_email_invitations;

CREATE POLICY "Inviters can read own invitations"
  ON public.collective_email_invitations FOR SELECT
  USING (invited_by = auth.uid());
