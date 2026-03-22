-- 065: Performance indexes
--
-- Covers the most common query patterns:
--   opportunities browser  → status, is_active, deadline, type, country
--   partner dashboard      → profile_id
--   slug lookups           → slug
--   claim token lookups    → claim_token
--   application queries    → opportunity_id, artist_id, status
--   message queries        → conversation_id, sender_id, is_read
--   feed / studio          → artist_id on project_updates
--   analytics              → event_type + created_at on analytics_events

-- ── opportunities ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_opportunities_status
  ON opportunities (status);

CREATE INDEX IF NOT EXISTS idx_opportunities_is_active
  ON opportunities (is_active);

CREATE INDEX IF NOT EXISTS idx_opportunities_profile_id
  ON opportunities (profile_id);

CREATE INDEX IF NOT EXISTS idx_opportunities_slug
  ON opportunities (slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_claim_token
  ON opportunities (claim_token)
  WHERE claim_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_deadline
  ON opportunities (deadline)
  WHERE deadline IS NOT NULL;

-- Composite: the main public browser query (active published opps by deadline)
CREATE INDEX IF NOT EXISTS idx_opportunities_active_published
  ON opportunities (is_active, status, deadline);

-- ── opportunity_applications ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_opp_apps_opportunity_id
  ON opportunity_applications (opportunity_id);

CREATE INDEX IF NOT EXISTS idx_opp_apps_artist_id
  ON opportunity_applications (artist_id);

CREATE INDEX IF NOT EXISTS idx_opp_apps_status
  ON opportunity_applications (status);

-- ── messages ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON messages (conversation_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id
  ON messages (sender_id);

CREATE INDEX IF NOT EXISTS idx_messages_is_read
  ON messages (is_read)
  WHERE is_read = false;

-- ── project_updates ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_project_updates_artist_id
  ON project_updates (artist_id);

-- ── analytics_events ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created
  ON analytics_events (event_type, created_at DESC);

-- ── user_saved_opportunities ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_saved_opps_user_id
  ON user_saved_opportunities (user_id);
