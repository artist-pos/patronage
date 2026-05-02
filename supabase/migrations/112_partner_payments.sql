-- ============================================================
-- Migration 112: Partner-side commerce (Phase 7.5c)
--
-- Two Patronage-direct surfaces:
--   - pipeline_entry_payments: partner pays to use Patronage's pipeline
--     submission infrastructure for an opportunity.
--   - featured_listing_payments: partner pays to feature an opportunity
--     for a fixed window.
--
-- Both are buyer = partner, seller = Patronage. No commission split.
-- ============================================================

-- ── 1. pipeline_entry_payments ──────────────────────────────────

CREATE TABLE IF NOT EXISTS pipeline_entry_payments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id       UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  partner_id           UUID NOT NULL REFERENCES profiles(id),
  amount_cents         INT NOT NULL,
  currency             TEXT NOT NULL DEFAULT 'NZD',
  status               TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'reverted')),
  stripe_session_id    TEXT UNIQUE,
  stripe_payment_intent TEXT UNIQUE,
  paid_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pep_opportunity_idx ON pipeline_entry_payments(opportunity_id);
CREATE INDEX IF NOT EXISTS pep_partner_idx     ON pipeline_entry_payments(partner_id);
CREATE INDEX IF NOT EXISTS pep_status_idx      ON pipeline_entry_payments(status);

ALTER TABLE pipeline_entry_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pep_select_partner" ON pipeline_entry_payments;
CREATE POLICY "pep_select_partner"
  ON pipeline_entry_payments FOR SELECT
  USING (partner_id = auth.uid());

-- ── 2. featured_listing_payments ────────────────────────────────

CREATE TABLE IF NOT EXISTS featured_listing_payments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id       UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  partner_id           UUID NOT NULL REFERENCES profiles(id),
  amount_cents         INT NOT NULL,
  currency             TEXT NOT NULL DEFAULT 'NZD',
  feature_days         INT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'reverted')),
  stripe_session_id    TEXT UNIQUE,
  stripe_payment_intent TEXT UNIQUE,
  paid_at              TIMESTAMPTZ,
  feature_until        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flp_opportunity_idx ON featured_listing_payments(opportunity_id);
CREATE INDEX IF NOT EXISTS flp_partner_idx     ON featured_listing_payments(partner_id);
CREATE INDEX IF NOT EXISTS flp_status_idx      ON featured_listing_payments(status);

ALTER TABLE featured_listing_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flp_select_partner" ON featured_listing_payments;
CREATE POLICY "flp_select_partner"
  ON featured_listing_payments FOR SELECT
  USING (partner_id = auth.uid());

-- ── 3. opportunities — derived flags ────────────────────────────
-- pipeline_paid_at: convenience flag for "this opportunity has paid pipeline
-- access". Listed-pipeline opportunities only render their pipeline
-- application form when this is set.
-- featured_until: timestamp the paid-placement boost expires. Combined with
-- the existing is_featured boolean, the rendering check becomes
-- "is_featured AND (featured_until IS NULL OR featured_until > now())".

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS pipeline_paid_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS featured_until    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS opps_featured_until_idx
  ON opportunities(featured_until) WHERE featured_until IS NOT NULL;
