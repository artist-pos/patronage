-- Migration 056: Fix messages INSERT policy — artist-to-artist messaging
--
-- The previous policy (022) used a blunt role gate:
--   "artists can only reply, never initiate"
-- This blocked artists from starting conversations with other artists, which
-- was never the intention.
--
-- Correct rules:
--   - Patrons, partners, admins, owners → can initiate with anyone
--   - Artists → can initiate with other artists/owners freely
--   - Artists → can only REPLY to patrons/partners (other person must have
--     sent a message first — enforced via has_prior_message())

-- Reuse the existing SECURITY DEFINER helper from migration 022.
-- Add a new one to look up the other participant's role without RLS recursion.
CREATE OR REPLACE FUNCTION other_participant_role(conv_id uuid, my_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT p.role
  FROM conversations c
  JOIN profiles p
    ON p.id = CASE
      WHEN c.participant_a = my_id THEN c.participant_b
      ELSE c.participant_a
    END
  WHERE c.id = conv_id
$$;

DROP POLICY IF EXISTS "messages_insert_participant" ON messages;

CREATE POLICY "messages_insert_participant" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Must be sending as yourself
    auth.uid() = sender_id

    -- Must be a participant in this conversation
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )

    -- Role gate
    AND (
      -- Non-artists (patron, partner, admin, owner) can always initiate
      (SELECT role FROM profiles WHERE id = auth.uid()) != 'artist'

      -- Artists can freely message other artists or owners
      OR other_participant_role(conversation_id, auth.uid()) IN ('artist', 'owner')

      -- Artists can reply to anyone who has already messaged them first
      OR has_prior_message(conversation_id, auth.uid())
    )
  );
