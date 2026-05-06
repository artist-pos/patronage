-- ============================================================
-- Migration 120: Stripe Connect Express for artist payouts
--
-- Artists who connect their bank get automatic payouts via
-- Stripe Connect. Those who don't fall back to manual queue.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id       TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_status   TEXT
    CHECK (stripe_connect_status IN ('pending', 'enabled', 'restricted'));

ALTER TABLE primary_sale_transactions
  ADD COLUMN IF NOT EXISTS payout_method TEXT NOT NULL DEFAULT 'manual'
    CHECK (payout_method IN ('manual', 'stripe_connect'));

CREATE INDEX IF NOT EXISTS pst_payout_method_idx
  ON primary_sale_transactions(payout_method);
