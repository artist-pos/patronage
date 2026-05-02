-- ============================================================
-- Migration 110: Resale + commerce primitives (Phase 7)
--
-- - resale_transactions: one row per Stripe Checkout completion
-- - royalty_holds: track 5% artist royalties pending payout
-- - artwork_provenance_ledger: + 'reverted' entry_type, content_hash
--   columns for future tamper-evidence anchoring
-- - artworks: structured edition fields alongside the existing
--   free-text 'edition' string
-- ============================================================

-- ── 1. Resale transactions ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS resale_transactions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id               UUID NOT NULL REFERENCES artworks(id) ON DELETE RESTRICT,
  seller_id                UUID NOT NULL REFERENCES profiles(id),
  buyer_id                 UUID REFERENCES profiles(id),     -- null until claimed
  buyer_email              TEXT NOT NULL,
  buyer_name               TEXT,
  -- Money is stored in minor units (cents) to avoid floating-point drift,
  -- mirroring Stripe's API surface.
  sale_price_cents         INT NOT NULL,
  currency                 TEXT NOT NULL DEFAULT 'NZD',
  patronage_commission_cents INT NOT NULL,
  artist_royalty_cents     INT NOT NULL,
  buyer_paid_total_cents   INT NOT NULL,
  -- Lifecycle
  status                   TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'reverted')),
  seller_payout_status     TEXT NOT NULL DEFAULT 'owed'
    CHECK (seller_payout_status IN ('owed', 'paid', 'cancelled')),
  royalty_status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (royalty_status IN ('pending', 'paid_to_artist', 'held', 'refunded_to_seller')),
  stripe_session_id        TEXT UNIQUE,
  stripe_payment_intent    TEXT UNIQUE,
  -- Idempotency: webhook may fire twice; same session id shouldn't double-write.
  paid_at                  TIMESTAMPTZ,
  reverted_at              TIMESTAMPTZ,
  reverted_reason          TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resale_artwork_idx       ON resale_transactions(artwork_id);
CREATE INDEX IF NOT EXISTS resale_seller_idx        ON resale_transactions(seller_id);
CREATE INDEX IF NOT EXISTS resale_buyer_idx         ON resale_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS resale_status_idx        ON resale_transactions(status);
CREATE INDEX IF NOT EXISTS resale_payout_status_idx ON resale_transactions(seller_payout_status);
CREATE INDEX IF NOT EXISTS resale_royalty_status_idx ON resale_transactions(royalty_status);

ALTER TABLE resale_transactions ENABLE ROW LEVEL SECURITY;

-- Seller and buyer can read their own rows; admin reads via service role.
DROP POLICY IF EXISTS "rt_select_seller" ON resale_transactions;
CREATE POLICY "rt_select_seller"
  ON resale_transactions FOR SELECT
  USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "rt_select_buyer" ON resale_transactions;
CREATE POLICY "rt_select_buyer"
  ON resale_transactions FOR SELECT
  USING (buyer_id = auth.uid());

-- Writes go through the admin client (server actions / webhook).

-- ── 2. Royalty holds ────────────────────────────────────────────
-- Earmarks the 5% for the artist. Status mirrors resale_transactions
-- but per-artist so unclaimed sums can be totalled cheaply.

CREATE TABLE IF NOT EXISTS royalty_holds (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resale_transaction_id  UUID NOT NULL REFERENCES resale_transactions(id) ON DELETE CASCADE,
  artwork_id             UUID NOT NULL REFERENCES artworks(id) ON DELETE RESTRICT,
  -- Artist might be on Patronage (artist_profile_id), still a stub
  -- (artist_pending_id), or just a name (artist_name_text). Exactly one of
  -- these is set; enforced in app code.
  artist_profile_id      UUID REFERENCES profiles(id),
  artist_pending_id      UUID REFERENCES pending_artists(id),
  artist_name_text       TEXT,
  amount_cents           INT NOT NULL,
  currency               TEXT NOT NULL DEFAULT 'NZD',
  status                 TEXT NOT NULL DEFAULT 'held'
    CHECK (status IN ('held', 'paid', 'refunded_to_seller')),
  outreach_count         INT NOT NULL DEFAULT 0,
  last_outreach_at       TIMESTAMPTZ,
  -- 90-day expiry: if still 'held' at expires_at, refund to seller. Avoids
  -- escrow / deposit-taking regulation.
  expires_at             TIMESTAMPTZ NOT NULL,
  paid_at                TIMESTAMPTZ,
  refunded_at            TIMESTAMPTZ,
  paid_via_note          TEXT,  -- free-text record of how payout happened
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rh_resale_idx    ON royalty_holds(resale_transaction_id);
CREATE INDEX IF NOT EXISTS rh_artist_idx    ON royalty_holds(artist_profile_id) WHERE artist_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rh_status_idx    ON royalty_holds(status);
CREATE INDEX IF NOT EXISTS rh_expiry_idx    ON royalty_holds(expires_at) WHERE status = 'held';

ALTER TABLE royalty_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_select_artist" ON royalty_holds;
CREATE POLICY "rh_select_artist"
  ON royalty_holds FOR SELECT
  USING (artist_profile_id = auth.uid());

-- ── 3. artwork_provenance_ledger — content_hash + reverted ──────

ALTER TABLE artwork_provenance_ledger
  ADD COLUMN IF NOT EXISTS content_hash  TEXT,
  ADD COLUMN IF NOT EXISTS hash_version  INT NOT NULL DEFAULT 1;

ALTER TABLE artwork_provenance_ledger
  DROP CONSTRAINT IF EXISTS artwork_provenance_ledger_entry_type_check;
ALTER TABLE artwork_provenance_ledger
  ADD CONSTRAINT artwork_provenance_ledger_entry_type_check
  CHECK (entry_type IN ('created', 'transferred', 'resold', 'reverted'));

-- ── 4. artworks: structured edition fields ──────────────────────
-- The existing `edition` text column stays as the display value. New
-- columns are populated by app code only when the parser is confident.

ALTER TABLE artworks
  ADD COLUMN IF NOT EXISTS edition_number INT,
  ADD COLUMN IF NOT EXISTS edition_total  INT,
  ADD COLUMN IF NOT EXISTS edition_type   TEXT
    CHECK (edition_type IS NULL OR edition_type IN ('unique', 'limited', 'open', 'AP', 'proof'));

CREATE INDEX IF NOT EXISTS artworks_edition_type_idx
  ON artworks(edition_type) WHERE edition_type IS NOT NULL;
