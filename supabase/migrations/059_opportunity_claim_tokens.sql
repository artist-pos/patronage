ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS claim_token UUID UNIQUE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS claim_email TEXT DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS opportunities_claim_token_idx
  ON opportunities (claim_token) WHERE claim_token IS NOT NULL;
