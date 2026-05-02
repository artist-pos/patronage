-- ============================================================
-- Migration 111: Primary sale (Phase 7.5b)
--
-- Buyer purchases an artist's available work directly. Mirrors
-- resale_transactions minus the artist royalty hold — the artist IS the
-- seller, so they receive the sticker amount; Patronage retains 10%.
-- ============================================================

CREATE TABLE IF NOT EXISTS primary_sale_transactions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id                  UUID NOT NULL REFERENCES artworks(id) ON DELETE RESTRICT,
  artist_id                   UUID NOT NULL REFERENCES profiles(id),  -- seller
  buyer_id                    UUID REFERENCES profiles(id),           -- null until claimed
  buyer_email                 TEXT NOT NULL,
  buyer_name                  TEXT,
  sale_price_cents            INT NOT NULL,
  currency                    TEXT NOT NULL DEFAULT 'NZD',
  patronage_commission_cents  INT NOT NULL,
  buyer_paid_total_cents      INT NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'reverted')),
  artist_payout_status        TEXT NOT NULL DEFAULT 'owed'
    CHECK (artist_payout_status IN ('owed', 'paid', 'cancelled')),
  stripe_session_id           TEXT UNIQUE,
  stripe_payment_intent       TEXT UNIQUE,
  paid_at                     TIMESTAMPTZ,
  reverted_at                 TIMESTAMPTZ,
  reverted_reason             TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pst_artwork_idx              ON primary_sale_transactions(artwork_id);
CREATE INDEX IF NOT EXISTS pst_artist_idx               ON primary_sale_transactions(artist_id);
CREATE INDEX IF NOT EXISTS pst_buyer_idx                ON primary_sale_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS pst_status_idx               ON primary_sale_transactions(status);
CREATE INDEX IF NOT EXISTS pst_payout_idx               ON primary_sale_transactions(artist_payout_status);

ALTER TABLE primary_sale_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pst_select_artist" ON primary_sale_transactions;
CREATE POLICY "pst_select_artist"
  ON primary_sale_transactions FOR SELECT
  USING (artist_id = auth.uid());

DROP POLICY IF EXISTS "pst_select_buyer" ON primary_sale_transactions;
CREATE POLICY "pst_select_buyer"
  ON primary_sale_transactions FOR SELECT
  USING (buyer_id = auth.uid());

-- Writes go through the admin client.
