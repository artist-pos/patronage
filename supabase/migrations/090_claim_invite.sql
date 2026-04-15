-- 090: Claim invite email tracking columns on opportunities

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS claim_invite_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_invite_email text,
  ADD COLUMN IF NOT EXISTS claim_invite_scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS claim_invite_template text CHECK (claim_invite_template IN ('claim_only', 'claim_pipeline')),
  ADD COLUMN IF NOT EXISTS claim_link_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_link_open_count integer DEFAULT 0;

-- Ensure claim_token exists (added in migration 059, but guard anyway)
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS claim_token uuid DEFAULT gen_random_uuid();

-- Backfill any rows with null claim_token
UPDATE public.opportunities
  SET claim_token = gen_random_uuid()
  WHERE claim_token IS NULL;
