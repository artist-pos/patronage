-- ============================================================
-- Migration 113: Support tiers go live (Phase 7.5d)
--
-- support_subscriptions tracks who supports whom. One row per
-- (supporter, tier) pair for one-offs; recurring tiers re-use the row
-- via stripe_subscription_id.
--
-- support_tiers gets a stripe_price_id cache so we don't mint a new
-- Stripe Price on every checkout.
-- ============================================================

-- ── 1. support_subscriptions ────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id                  UUID NOT NULL REFERENCES support_tiers(id) ON DELETE RESTRICT,
  recipient_id             UUID NOT NULL REFERENCES profiles(id),  -- the artist
  supporter_id             UUID REFERENCES profiles(id),           -- null for shadow accounts pre-claim
  supporter_email          TEXT NOT NULL,
  supporter_name           TEXT,
  amount_cents             INT NOT NULL,
  currency                 TEXT NOT NULL DEFAULT 'NZD',
  patronage_commission_cents INT NOT NULL,
  buyer_paid_total_cents   INT NOT NULL,
  tier_type                TEXT NOT NULL CHECK (tier_type IN ('one_off', 'recurring')),
  status                   TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'past_due', 'canceled', 'one_off_paid', 'reverted')),
  stripe_session_id        TEXT UNIQUE,
  stripe_payment_intent    TEXT,
  stripe_customer_id       TEXT,
  stripe_subscription_id   TEXT UNIQUE,
  current_period_end       TIMESTAMPTZ,
  started_at               TIMESTAMPTZ,
  canceled_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ss_tier_idx          ON support_subscriptions(tier_id);
CREATE INDEX IF NOT EXISTS ss_recipient_idx     ON support_subscriptions(recipient_id);
CREATE INDEX IF NOT EXISTS ss_supporter_idx     ON support_subscriptions(supporter_id);
CREATE INDEX IF NOT EXISTS ss_status_idx        ON support_subscriptions(status);
CREATE INDEX IF NOT EXISTS ss_subscription_idx  ON support_subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

ALTER TABLE support_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ss_select_supporter" ON support_subscriptions;
CREATE POLICY "ss_select_supporter"
  ON support_subscriptions FOR SELECT
  USING (supporter_id = auth.uid());

DROP POLICY IF EXISTS "ss_select_recipient" ON support_subscriptions;
CREATE POLICY "ss_select_recipient"
  ON support_subscriptions FOR SELECT
  USING (recipient_id = auth.uid());

-- ── 2. support_tiers — cache Stripe Price id ────────────────────
-- Lazily minted on first checkout to avoid maintaining a sync job.

ALTER TABLE support_tiers
  ADD COLUMN IF NOT EXISTS stripe_price_id  TEXT,
  ADD COLUMN IF NOT EXISTS stripe_product_id TEXT;
