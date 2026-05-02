-- Migration 114: listing_mode on artworks + negotiated_sale_transactions

-- 1. Listing mode controls whether a work shows a Buy button or enquire-only.
--    Default is direct_sale to preserve behaviour for existing priced works.
ALTER TABLE artworks
  ADD COLUMN IF NOT EXISTS listing_mode TEXT NOT NULL DEFAULT 'direct_sale';
-- Valid values: 'direct_sale' | 'enquire_first'

-- 2. Negotiated sale transactions — DM transfers where the artist sets a price
--    and the patron pays via Stripe before ownership transfers.
CREATE TABLE IF NOT EXISTS negotiated_sale_transactions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id                  UUID NOT NULL REFERENCES artworks(id),
  artist_id                   UUID NOT NULL REFERENCES profiles(id),
  buyer_id                    UUID REFERENCES profiles(id),
  buyer_email                 TEXT NOT NULL,
  conversation_id             UUID NOT NULL REFERENCES conversations(id),
  sale_price_cents            INT NOT NULL,
  currency                    TEXT NOT NULL DEFAULT 'NZD',
  patronage_commission_cents  INT NOT NULL DEFAULT 0,
  buyer_paid_total_cents      INT NOT NULL,
  stripe_session_id           TEXT,
  stripe_payment_intent       TEXT,
  status                      TEXT NOT NULL DEFAULT 'pending', -- pending | paid
  artist_payout_status        TEXT NOT NULL DEFAULT 'owed',   -- owed | paid
  paid_at                     TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE negotiated_sale_transactions ENABLE ROW LEVEL SECURITY;
-- All mutations happen server-side via the admin client; no direct client access.
CREATE POLICY "no_direct_client_access_negotiated_sale"
  ON negotiated_sale_transactions FOR ALL
  USING (false);
