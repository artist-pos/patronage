-- ============================================================
-- Migration 106: Attribution claims + pending artists (Phase 2)
--
-- Adds the artist-confirmation loop for holder-uploaded works:
--   - pending_artists: stubs for artists who aren't on Patronage yet,
--     each with a claim token and outreach metadata.
--   - holder_attribution_claims: links a holder's collection_membership
--     row to either an existing artist profile or a pending_artists
--     stub. Status drives the public trust tier.
--
-- pending_ownership_claims (migration 098) is for buyer-initiated
-- claims and is NOT extended here — its row shape (claimer_name,
-- claimer_email, no holder/target) doesn't fit the holder-uploaded
-- case cleanly, and its existing flow is in active use. Keep them
-- separate; the unified token panel (vw_claim_tokens) joins both.
-- ============================================================

-- ── 1. pending_artists ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pending_artists (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL,
  -- Lowercase + trimmed + accent-folded. Postgres has unaccent() in the
  -- unaccent extension; we set name_normalised at insert time in app code
  -- to avoid a hard dependency on the extension being enabled.
  name_normalised          TEXT NOT NULL,
  email                    TEXT,
  claim_token              UUID NOT NULL DEFAULT gen_random_uuid(),
  created_by_holder_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Outreach metadata, mirroring opportunities.claim_invite_* columns
  claim_invite_sent_at     TIMESTAMPTZ,
  claim_invite_email       TEXT,
  claim_link_opened_at     TIMESTAMPTZ,
  claim_link_open_count    INT NOT NULL DEFAULT 0,
  last_outreach_at         TIMESTAMPTZ,
  outreach_status          TEXT CHECK (outreach_status IN ('unattempted', 'emailed', 'phoned', 'unreachable')),
  outreach_notes           TEXT,
  -- Set when the artist successfully claims this stub.
  claimed_by_profile_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  claimed_at               TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stub deduplication: when a holder provides BOTH a name and an email, we
-- want to point at an existing stub rather than create a duplicate. Without
-- email we accept duplicates — common names collide and we don't want to
-- merge two unrelated artists.
CREATE UNIQUE INDEX IF NOT EXISTS pending_artists_name_email_idx
  ON pending_artists (name_normalised, email)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS pending_artists_name_norm_idx     ON pending_artists(name_normalised);
CREATE UNIQUE INDEX IF NOT EXISTS pending_artists_token_idx  ON pending_artists(claim_token);
CREATE INDEX IF NOT EXISTS pending_artists_claimed_by_idx
  ON pending_artists(claimed_by_profile_id) WHERE claimed_by_profile_id IS NOT NULL;

ALTER TABLE pending_artists ENABLE ROW LEVEL SECURITY;

-- Public reads: the public collection page renders artist names directly
-- from artworks.attributed_artist_text (free text). Stubs are internal —
-- no public read policy. All access goes through admin client.

-- ── 2. artworks.attributed_pending_artist_id ────────────────────

ALTER TABLE artworks
  ADD COLUMN IF NOT EXISTS attributed_pending_artist_id UUID
    REFERENCES pending_artists(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS artworks_attributed_pending_idx
  ON artworks(attributed_pending_artist_id) WHERE attributed_pending_artist_id IS NOT NULL;

-- Sanity check: an artwork can have at most one attribution route — either
-- a real profile or a stub, not both. Skip the constraint so this migration
-- is forgiving of legacy rows; the app-side createCollectionEntry enforces
-- exclusivity.

-- ── 3. holder_attribution_claims ────────────────────────────────

CREATE TABLE IF NOT EXISTS holder_attribution_claims (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id                  UUID NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  holder_id                   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Exactly one of these is set; the other is null. Enforced in app code.
  target_profile_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_pending_artist_id    UUID REFERENCES pending_artists(id) ON DELETE SET NULL,
  status                      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'declined', 'unknown', 'resolved_by_patronage')),
  decline_reason              TEXT,
  decline_appealed_at         TIMESTAMPTZ,
  decline_appeal_evidence     TEXT, -- storage path in artwork-source-documents bucket
  decline_appeal_message      TEXT,
  resolved_by_admin_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at                 TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One claim per (artwork, holder) pair — re-uploading shouldn't double up.
  UNIQUE (artwork_id, holder_id)
);

CREATE INDEX IF NOT EXISTS hac_artwork_idx          ON holder_attribution_claims(artwork_id);
CREATE INDEX IF NOT EXISTS hac_holder_idx           ON holder_attribution_claims(holder_id);
CREATE INDEX IF NOT EXISTS hac_target_profile_idx
  ON holder_attribution_claims(target_profile_id) WHERE target_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS hac_target_pending_idx
  ON holder_attribution_claims(target_pending_artist_id) WHERE target_pending_artist_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS hac_status_idx           ON holder_attribution_claims(status);

ALTER TABLE holder_attribution_claims ENABLE ROW LEVEL SECURITY;

-- Holder can read claims they initiated.
DROP POLICY IF EXISTS "hac_select_holder" ON holder_attribution_claims;
CREATE POLICY "hac_select_holder"
  ON holder_attribution_claims FOR SELECT
  USING (holder_id = auth.uid());

-- Targeted artist (existing profile) can read claims pointing at them.
DROP POLICY IF EXISTS "hac_select_target_artist" ON holder_attribution_claims;
CREATE POLICY "hac_select_target_artist"
  ON holder_attribution_claims FOR SELECT
  USING (target_profile_id = auth.uid());

-- Public read for confirmed / resolved claims so the provenance page can
-- render the trust-tier chip without auth.
DROP POLICY IF EXISTS "hac_select_public_resolved" ON holder_attribution_claims;
CREATE POLICY "hac_select_public_resolved"
  ON holder_attribution_claims FOR SELECT
  USING (status IN ('confirmed', 'resolved_by_patronage'));

-- All writes go through the admin client (server actions enforce ownership).

-- ── 4. Trust tier function ──────────────────────────────────────
-- Returns the public trust-tier label for an artwork. Used by both the
-- provenance page and the public collection page (Phase 4).
--
-- Tier rules:
--   self_registered                                                   → recorded_by_artist
--   holder_uploaded + claim status = confirmed                        → confirmed_by_artist
--   holder_uploaded + claim status = resolved_by_patronage            → resolved_by_patronage
--   holder_uploaded + claim status = declined                         → disputed
--   holder_uploaded + (claim status pending/unknown OR no claim)      → recorded_by_holder

CREATE OR REPLACE FUNCTION artwork_trust_tier(p_artwork_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_source artwork_source;
  v_status TEXT;
BEGIN
  SELECT source INTO v_source FROM artworks WHERE id = p_artwork_id;
  IF v_source IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_source = 'self_registered' THEN
    RETURN 'recorded_by_artist';
  END IF;

  -- Pick the most-advanced status across all claims for this artwork.
  -- Order: confirmed > resolved_by_patronage > declined > pending/unknown.
  SELECT status INTO v_status
  FROM holder_attribution_claims
  WHERE artwork_id = p_artwork_id
  ORDER BY CASE status
    WHEN 'confirmed' THEN 0
    WHEN 'resolved_by_patronage' THEN 1
    WHEN 'declined' THEN 2
    WHEN 'pending' THEN 3
    WHEN 'unknown' THEN 4
    ELSE 5
  END
  LIMIT 1;

  IF v_status IS NULL THEN
    RETURN 'recorded_by_holder';
  END IF;
  IF v_status = 'confirmed'             THEN RETURN 'confirmed_by_artist'; END IF;
  IF v_status = 'resolved_by_patronage' THEN RETURN 'resolved_by_patronage'; END IF;
  IF v_status = 'declined'              THEN RETURN 'disputed'; END IF;
  RETURN 'recorded_by_holder';
END;
$$;

-- ── 5. vw_claim_tokens — unified token-panel view ───────────────
-- Joins three token sources (opportunities, provenance_links,
-- pending_artists) into one shape. The admin panel reads from this view;
-- per-source actions branch on token_kind.

CREATE OR REPLACE VIEW vw_claim_tokens AS
  SELECT
    'opportunity'::text                  AS token_kind,
    o.id                                 AS source_id,
    o.claim_token::text                  AS claim_token,
    o.title                              AS subject_label,
    o.organiser                          AS subject_detail,
    o.claim_invite_email                 AS contact_email,
    o.claim_invite_sent_at               AS invite_sent_at,
    o.claim_link_opened_at               AS link_opened_at,
    o.claim_link_open_count              AS link_open_count,
    NULL::timestamptz                    AS last_outreach_at,
    NULL::text                           AS outreach_status,
    NULL::text                           AS outreach_notes,
    o.claim_token IS NULL                AS is_claimed,
    o.created_at                         AS created_at
  FROM opportunities o
  WHERE o.claim_token IS NOT NULL OR o.claim_invite_email IS NOT NULL

  UNION ALL

  SELECT
    'provenance'::text                   AS token_kind,
    pl.id                                AS source_id,
    pl.claim_token::text                 AS claim_token,
    COALESCE(a.title, a.caption, 'Artwork') AS subject_label,
    pl.patron_email                      AS subject_detail,
    pl.patron_email                      AS contact_email,
    NULL::timestamptz                    AS invite_sent_at,
    NULL::timestamptz                    AS link_opened_at,
    0                                    AS link_open_count,
    NULL::timestamptz                    AS last_outreach_at,
    NULL::text                           AS outreach_status,
    NULL::text                           AS outreach_notes,
    pl.status = 'verified'               AS is_claimed,
    pl.created_at                        AS created_at
  FROM provenance_links pl
  LEFT JOIN artworks a ON a.id = pl.artwork_id

  UNION ALL

  SELECT
    'artist'::text                       AS token_kind,
    pa.id                                AS source_id,
    pa.claim_token::text                 AS claim_token,
    pa.name                              AS subject_label,
    pa.email                             AS subject_detail,
    COALESCE(pa.claim_invite_email, pa.email) AS contact_email,
    pa.claim_invite_sent_at              AS invite_sent_at,
    pa.claim_link_opened_at              AS link_opened_at,
    pa.claim_link_open_count             AS link_open_count,
    pa.last_outreach_at                  AS last_outreach_at,
    pa.outreach_status                   AS outreach_status,
    pa.outreach_notes                    AS outreach_notes,
    pa.claimed_by_profile_id IS NOT NULL AS is_claimed,
    pa.created_at                        AS created_at
  FROM pending_artists pa;

-- View runs as the caller — admin panel uses the admin client to read it.
ALTER VIEW vw_claim_tokens SET (security_invoker = on);
