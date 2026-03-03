-- Migration 019: Patron/partner features
-- 1. is_available + price on portfolio_images
-- 2. acquired_works on profiles
-- 3. Messages RLS: block artist cold-outreach

-- ── 1. Portfolio images — available works fields ───────────────────────────────
ALTER TABLE portfolio_images
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price TEXT;

-- ── 2. Profiles — acquired works placeholder ──────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS acquired_works UUID[] NOT NULL DEFAULT '{}';

-- ── 3. Messages RLS — no artist cold-outreach ────────────────────────────────
-- Replace the existing insert policy with one that prevents artists from
-- sending the first message in a thread (patrons/partners must initiate).
DROP POLICY IF EXISTS "messages_insert_participant" ON messages;

CREATE POLICY "messages_insert_participant" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Basic: sender must be the authenticated user
    auth.uid() = sender_id
    -- Basic: sender must be a participant in this conversation
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
    -- Role gate: non-artists can always initiate; artists can only reply
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) != 'artist'
      OR
      -- Artist is replying: at least one message from someone else exists
      EXISTS (
        SELECT 1 FROM messages m
        WHERE m.conversation_id = conversation_id
          AND m.sender_id != auth.uid()
      )
    )
  );
