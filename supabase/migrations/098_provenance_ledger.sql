-- ============================================================
-- Migration 098: Provenance ledger system
-- - artwork_provenance_ledger table (chain of custody)
-- - pending_ownership_claims table (buyer-initiated claims)
-- - artworks: ledger_id, certificate_note columns
-- - profiles: provenance branding + account_status columns
-- ============================================================

-- 1a. Add provenance columns to artworks
ALTER TABLE artworks
  ADD COLUMN IF NOT EXISTS ledger_id       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS certificate_note TEXT;

-- 1b. Add provenance branding + shadow-account columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS provenance_logo_url       TEXT,
  ADD COLUMN IF NOT EXISTS provenance_signature_url  TEXT,
  ADD COLUMN IF NOT EXISTS provenance_template_theme TEXT DEFAULT 'minimal',
  ADD COLUMN IF NOT EXISTS account_status            TEXT DEFAULT 'active'
    CHECK (account_status IN ('active', 'shadow'));

-- 1c. Provenance ledger: one row per ownership event
CREATE TABLE IF NOT EXISTS artwork_provenance_ledger (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id      UUID        NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  ledger_id       TEXT        NOT NULL,
  entry_type      TEXT        NOT NULL CHECK (entry_type IN ('created', 'transferred', 'resold')),
  from_owner_id   UUID        REFERENCES profiles(id),
  to_owner_id     UUID        NOT NULL REFERENCES profiles(id),
  transfer_method TEXT        NOT NULL CHECK (transfer_method IN ('listing', 'stripe', 'claim', 'direct')),
  transaction_ref TEXT,
  price           NUMERIC,
  transferred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  certificate_url TEXT,
  notes           TEXT,
  -- Optional: populated when a transfer originates from a campaign (art fair, etc.)
  campaign_id     UUID        REFERENCES campaigns(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS apl_artwork_id_idx  ON artwork_provenance_ledger(artwork_id);
CREATE INDEX IF NOT EXISTS apl_ledger_id_idx   ON artwork_provenance_ledger(ledger_id);
CREATE INDEX IF NOT EXISTS apl_to_owner_id_idx ON artwork_provenance_ledger(to_owner_id);

ALTER TABLE artwork_provenance_ledger ENABLE ROW LEVEL SECURITY;
-- Public read (provenance page is unauthenticated)
CREATE POLICY "apl_public_read" ON artwork_provenance_ledger FOR SELECT USING (true);
-- All writes go through service role (admin client) — no direct client writes

-- 1d. Pending ownership claims (buyer-initiated, artist approves/declines)
CREATE TABLE IF NOT EXISTS pending_ownership_claims (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id  UUID        NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  claimer_name  TEXT      NOT NULL,
  claimer_email TEXT      NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  claimed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID        REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS poc_artwork_id_idx ON pending_ownership_claims(artwork_id);
CREATE INDEX IF NOT EXISTS poc_status_idx     ON pending_ownership_claims(status);

ALTER TABLE pending_ownership_claims ENABLE ROW LEVEL SECURITY;
-- Anyone can submit a claim (unauthenticated visitors on provenance page)
CREATE POLICY "poc_public_insert" ON pending_ownership_claims FOR INSERT WITH CHECK (true);
-- Claims are readable publicly (provenance page shows claim status)
CREATE POLICY "poc_public_read"   ON pending_ownership_claims FOR SELECT USING (true);
-- Status updates go through service role (admin client)
